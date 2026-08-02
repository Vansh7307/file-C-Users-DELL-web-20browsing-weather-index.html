/* ============================================================
   Weather Dashboard - Backend API Server (Node.js + Express)
   ============================================================
   Provides:
     - /api/weather/current?q=...     proxy to OpenWeatherMap current
     - /api/weather/forecast?q=...    proxy to OpenWeatherMap 5-day forecast
     - /api/weather/rankings?q=...    live rankings for nearby cities
     - /api/geo/search?q=...          geocoding (Nominatim proxy)
     - /api/geo/reverse?lat=&lon=     reverse geocoding (Nominatim proxy)
     - /api/user/follows              GET/POST/DELETE followed locations
     - /api/user/history              GET/POST search history
     - /api/user/settings             GET/PUT settings

   Data is persisted to server/data.json (auto-created).
   Requires env var OPENWEATHER_API_KEY (or falls back to the
   bundled demo key) to proxy weather data.
   ============================================================ */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;

// ---------- Config ----------
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || '929573d4f9cd2cf581b99af64ee069e8';
const OW_BASE = 'https://api.openweathermap.org/data/2.5';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

const DATA_FILE = path.join(__dirname, 'data.json');
let db = { users: [], follows: [], history: [], settings: {} };

// ---------- Tiny JSON datastore ----------
function loadDB() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Failed to load data.json:', e.message);
        db = { users: [], follows: [], history: [], settings: {} };
    }
}
function saveDB() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error('Failed to save data.json:', e.message);
    }
}
loadDB();

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());

// Simple token from header or fallback to IP for per-user separation.
// If the request carries a valid Bearer session token, use the account id
// so data is tied to the logged-in user.
function userIdFrom(req) {
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) {
        const user = findUserByToken(auth.slice(7));
        if (user) return user.id;
    }
    const tok = req.headers['x-user-token'];
    if (tok) return String(tok).slice(0, 64);
    return 'ip:' + (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local');
}

// ---------- Helper: fetch with retry ----------
async function fetchJson(url, opts) {
    const res = await fetch(url, opts || {});
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { json = null; }
    return { status: res.status, ok: res.ok, json };
}

// ---------- Health ----------
app.get('/api/health', (req, res) => {
    res.json({ ok: true, name: 'weather-dashboard-backend', time: new Date().toISOString() });
});

// ============================================================
//   AUTH SYSTEM (register / login / logout / me)
//   Passwords are hashed with salted SHA-256. Sessions use
//   random tokens stored on the user record.
// ============================================================
function hashPassword(password, salt) {
    return crypto.createHash('sha256').update(salt + ':' + password).digest('hex');
}
function makeSalt() { return crypto.randomBytes(16).toString('hex'); }
function makeToken() { return crypto.randomBytes(24).toString('hex'); }

function findUserByToken(token) {
    if (!token) return null;
    return db.users.find(u => u.tokens && u.tokens.includes(token)) || null;
}

/** Middleware: require a valid bearer token. */
function requireAuth(req, res, next) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    const user = findUserByToken(token);
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }
    req.user = user;
    req.userToken = token;
    next();
}

// Register a new user
app.post('/api/auth/register', (req, res) => {
    const email = String(req.body && req.body.email || '').trim().toLowerCase();
    const password = String(req.body && req.body.password || '');
    const name = String(req.body && req.body.name || '').trim() || email.split('@')[0];

    if (!email || !email.includes('@')) return res.status(400).json({ error: 'A valid email is required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    if (db.users.some(u => u.email === email)) return res.status(409).json({ error: 'An account with this email already exists.' });

    const salt = makeSalt();
    const token = makeToken();
    const user = {
        id: 'u_' + crypto.randomBytes(8).toString('hex'),
        name,
        email,
        salt,
        passHash: hashPassword(password, salt),
        tokens: [token],
        createdAt: new Date().toISOString()
    };
    db.users.push(user);
    saveDB();
    res.status(201).json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email } });
});

// Login
app.post('/api/auth/login', (req, res) => {
    const email = String(req.body && req.body.email || '').trim().toLowerCase();
    const password = String(req.body && req.body.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const user = db.users.find(u => u.email === email);
    if (!user || user.passHash !== hashPassword(password, user.salt)) {
        return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const token = makeToken();
    user.tokens = user.tokens || [];
    user.tokens.push(token);
    saveDB();
    res.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email } });
});

// Get current user (requires auth)
app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ ok: true, user: { id: req.user.id, name: req.user.name, email: req.user.email } });
});

// Logout (invalidates the current token)
app.post('/api/auth/logout', requireAuth, (req, res) => {
    req.user.tokens = (req.user.tokens || []).filter(t => t !== req.userToken);
    saveDB();
    res.json({ ok: true });
});

// ---------- Weather proxies ----------
app.get('/api/weather/current', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'Missing q parameter' });
    const url = OW_BASE + '/weather?q=' + encodeURIComponent(q) + '&appid=' + OPENWEATHER_API_KEY + '&units=metric';
    const { status, json } = await fetchJson(url);
    if (json && json.cod && Number(json.cod) !== 200) {
        return res.status(404).json({ error: json.message || 'City not found' });
    }
    res.status(status).json(json);
});

app.get('/api/weather/current-by-coords', async (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return res.status(400).json({ error: 'Missing lat/lon' });
    const url = OW_BASE + '/weather?lat=' + lat + '&lon=' + lon + '&appid=' + OPENWEATHER_API_KEY + '&units=metric';
    const { status, json } = await fetchJson(url);
    res.status(status).json(json);
});

app.get('/api/weather/forecast', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'Missing q parameter' });
    const url = OW_BASE + '/forecast?q=' + encodeURIComponent(q) + '&appid=' + OPENWEATHER_API_KEY + '&units=metric';
    const { status, json } = await fetchJson(url);
    if (json && json.cod && Number(json.cod) !== 200) {
        return res.status(404).json({ error: json.message || 'City not found' });
    }
    res.status(status).json(json);
});

// ---------- Rankings (live, aggregated server-side) ----------
const NEARBY_CITIES = ['New Delhi', 'Chandigarh', 'Gurugram', 'Panipat', 'Kurukshetra', 'Ambala', 'Jind', 'Sonipat'];
app.get('/api/weather/rankings', async (req, res) => {
    const q = String(req.query.q || 'Karnal').trim();
    const cities = [q].concat(NEARBY_CITIES.filter(c => c !== q));
    const rows = [];
    for (const city of cities) {
        try {
            const url = OW_BASE + '/weather?q=' + encodeURIComponent(city) + '&appid=' + OPENWEATHER_API_KEY + '&units=metric';
            const { ok, json } = await fetchJson(url);
            if (ok && json && json.main) {
                rows.push({ name: json.name, temp: Math.round(json.main.temp), desc: json.weather && json.weather[0] ? json.weather[0].description : '' });
            }
        } catch (e) { /* skip */ }
    }
    rows.sort((a, b) => b.temp - a.temp);
    res.json(rows);
});

// ---------- Geocoding proxies ----------
app.get('/api/geo/search', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'Missing q parameter' });
    const url = NOMINATIM_BASE + '/search?format=json&limit=6&q=' + encodeURIComponent(q);
    const { status, json } = await fetchJson(url, {
        headers: { 'User-Agent': 'weather-dashboard/1.0' }
    });
    res.status(status).json(Array.isArray(json) ? json : []);
});

app.get('/api/geo/reverse', async (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return res.status(400).json({ error: 'Missing lat/lon' });
    const url = NOMINATIM_BASE + '/reverse?format=json&lat=' + lat + '&lon=' + lon;
    const { status, json } = await fetchJson(url, {
        headers: { 'User-Agent': 'weather-dashboard/1.0' }
    });
    res.status(status).json(json || {});
});

// ---------- Follows ----------
app.get('/api/user/follows', (req, res) => {
    const uid = userIdFrom(req);
    const list = db.follows.filter(f => f.uid === uid).map(f => f.name);
    res.json(list);
});

app.post('/api/user/follows', (req, res) => {
    const uid = userIdFrom(req);
    const name = String(req.body && req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Missing name' });
    const exists = db.follows.some(f => f.uid === uid && f.name.toLowerCase() === name.toLowerCase());
    if (!exists) {
        db.follows.push({ uid, name, createdAt: new Date().toISOString() });
        saveDB();
    }
    res.json({ ok: true });
});

app.delete('/api/user/follows', (req, res) => {
    const uid = userIdFrom(req);
    const name = String(req.body && req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Missing name' });
    db.follows = db.follows.filter(f => !(f.uid === uid && f.name.toLowerCase() === name.toLowerCase()));
    saveDB();
    res.json({ ok: true });
});

// ---------- Search history ----------
app.get('/api/user/history', (req, res) => {
    const uid = userIdFrom(req);
    const list = db.history
        .filter(h => h.uid === uid)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        .slice(0, 10)
        .map(h => h.term);
    res.json(list);
});

app.post('/api/user/history', (req, res) => {
    const uid = userIdFrom(req);
    const term = String(req.body && req.body.term || '').trim();
    if (!term) return res.status(400).json({ error: 'Missing term' });
    db.history.push({ uid, term, createdAt: new Date().toISOString() });
    // cap at 50 per user
    const userItems = db.history.filter(h => h.uid === uid);
    if (userItems.length > 50) {
        const oldest = userItems.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))[0];
        db.history = db.history.filter(h => h !== oldest);
    }
    saveDB();
    res.json({ ok: true });
});

// ---------- Settings ----------
app.get('/api/user/settings', (req, res) => {
    const uid = userIdFrom(req);
    res.json(db.settings[uid] || {});
});

app.put('/api/user/settings', (req, res) => {
    const uid = userIdFrom(req);
    db.settings[uid] = Object.assign({}, db.settings[uid], req.body || {});
    saveDB();
    res.json({ ok: true });
});

// ---------- Serve built front-end (optional; same repo parent) ----------
const publicDir = path.resolve(__dirname, '..');
app.use(express.static(publicDir, {
    index: 'index.html',
    extensions: ['html']
}));

// ---------- Start ----------
app.listen(PORT, () => {
    console.log('==========================================');
    console.log(' Weather Dashboard backend running');
    console.log('   URL:      http://localhost:' + PORT);
    console.log('   Weather:  OpenWeatherMap proxy enabled');
    console.log('   Storage:  ' + DATA_FILE);
    console.log('==========================================');
});

