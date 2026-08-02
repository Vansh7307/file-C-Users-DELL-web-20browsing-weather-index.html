/* ============================================================
   Backend Configuration
   ============================================================
   The Weather Dashboard uses a local Node.js + Express backend
   by default (see /server/server.js). Run it with:

       cd server
       npm install
       npm start

   The backend serves the static site AND provides APIs for
   follows, search history, settings, weather proxy, geocoding
   and rankings. If the backend is unreachable, this file falls
   back to localStorage so the site still works offline.

   To instead use Firebase:
   1. Go to https://console.firebase.google.com
   2. Create a project (Spark plan is free)
   3. Add a Web App to get the config object
   4. Replace the placeholder values below
   5. In Firestore Database create collections:
      - followed_locations
      - search_history
      - city_rankings
      - settings
   6. Deploy rules from /firestore.rules
   ============================================================ */

// ---------- Backend API base URL ----------
// Auto-detect: use local backend when served from the same origin/port,
// otherwise use the Node server port 5000 (during local development).
const API_BASE = (function () {
    if (window.__API_BASE__) return window.__API_BASE__;
    const host = window.location.hostname || 'localhost';
    const port = window.location.port;
    if (port && port === '5000') return '';
    return 'http://' + host + ':5000';
})();

// A per-browser token so the backend can keep user data separate
let _userToken = null;
function userToken() {
    if (_userToken) return _userToken;
    try {
        _userToken = localStorage.getItem('weather_user_token');
        if (!_userToken) {
            _userToken = 'u_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
            localStorage.setItem('weather_user_token', _userToken);
        }
    } catch (e) {
        _userToken = 'u_fallback_' + Math.random().toString(36).slice(2, 10);
    }
    return _userToken;
}

async function api(path, options) {
    const url = API_BASE + path;
    const opts = Object.assign({ headers: {} }, options || {});
    opts.headers['x-user-token'] = userToken();
    if (opts.body && typeof opts.body === 'object') {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(url, opts);
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    return { status: res.status, ok: res.ok, data };
}

// ---------- Optional Firebase (when configured) ----------
const FIREBASE_CONFIG = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
const FIREBASE_READY = false; // set true only if you configure real keys AND prefer Firebase

// ---------- Local fallback store ----------
const localStore = {
    get(key, def) {
        try { const v = localStorage.getItem('weather_' + key); return v ? JSON.parse(v) : def; }
        catch (e) { return def; }
    },
    set(key, val) {
        try { localStorage.setItem('weather_' + key, JSON.stringify(val)); } catch (e) { /* ignore */ }
    },
    remove(key) {
        try { localStorage.removeItem('weather_' + key); } catch (e) { /* ignore */ }
    }
};

// ---------- Auth helpers (localStorage token) ----------
function authToken() {
    try { return localStorage.getItem('weather_auth_token'); } catch (e) { return null; }
}
function saveAuth(token, user) {
    try {
        if (token) localStorage.setItem('weather_auth_token', token);
        if (user) localStorage.setItem('weather_auth_user', JSON.stringify(user));
        if (!token) localStorage.removeItem('weather_auth_token');
        if (!user) localStorage.removeItem('weather_auth_user');
    } catch (e) { /* ignore */ }
}
function currentUser() {
    try { const u = localStorage.getItem('weather_auth_user'); return u ? JSON.parse(u) : null; } catch (e) { return null; }
}

// ---------- Backend API (Node backend first, localStorage fallback) ----------
const Backend = {
    ready: true,
    apiBase: API_BASE,

    /** Returns true if the backend is reachable (warmup check). */
    async ping() {
        try {
            const r = await api('/api/health');
            return r.ok;
        } catch (e) { return false; }
    },

    /** Returns the stored session token (or null if not logged in). */
    getToken() { return authToken(); },

    /** Returns the stored user object (or null). */
    getUser() { return currentUser(); },

    /** True if a user is currently logged in. */
    isLoggedIn() { return !!authToken(); },

    /** Register a new account. Returns {ok, token, user} or {ok:false,error}. */
    async register(name, email, password) {
        try {
            const r = await api('/api/auth/register', { method: 'POST', body: { name, email, password } });
            if (r.ok && r.data && r.data.token) {
                saveAuth(r.data.token, r.data.user);
                return { ok: true, token: r.data.token, user: r.data.user };
            }
            return { ok: false, error: (r.data && r.data.error) || 'Registration failed.' };
        } catch (e) {
            return { ok: false, error: 'Cannot reach backend. Please check if the server is running (npm start).' };
        }
    },

    /** Log in. Returns {ok, token, user} or {ok:false,error}. */
    async login(email, password) {
        try {
            const r = await api('/api/auth/login', { method: 'POST', body: { email, password } });
            if (r.ok && r.data && r.data.token) {
                saveAuth(r.data.token, r.data.user);
                return { ok: true, token: r.data.token, user: r.data.user };
            }
            return { ok: false, error: (r.data && r.data.error) || 'Login failed.' };
        } catch (e) {
            return { ok: false, error: 'Cannot reach backend. Please check if the server is running (npm start).' };
        }
    },

    /** Validate the stored token against the backend (returns user or null). */
    async me() {
        const tok = authToken();
        if (!tok) return null;
        try {
            const r = await api('/api/auth/me', { headers: { Authorization: 'Bearer ' + tok } });
            if (r.ok && r.data && r.data.user) {
                saveAuth(tok, r.data.user);
                return r.data.user;
            }
            // token invalid -> clear
            saveAuth(null, null);
            return null;
        } catch (e) {
            return currentUser();
        }
    },

    /** Log out (invalidates token on backend and clears locally). */
    async logout() {
        const tok = authToken();
        if (tok) {
            try { await api('/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + tok } }); }
            catch (e) { /* ignore */ }
        }
        saveAuth(null, null);
        return true;
    },

    /** Follow a location. */
    async followLocation(location) {
        try {
            const r = await api('/api/user/follows', { method: 'POST', body: { name: location } });
            if (r.ok) return true;
        } catch (e) { /* fall through */ }
        // Fallback to localStorage
        const list = localStore.get('followed', []);
        if (!list.some(x => x.name === location)) {
            list.push({ name: location, createdAt: new Date().toISOString() });
            localStore.set('followed', list);
        }
        return true;
    },

    /** Unfollow a location. */
    async unfollowLocation(location) {
        try {
            const r = await api('/api/user/follows', { method: 'DELETE', body: { name: location } });
            if (r.ok) return true;
        } catch (e) { /* fall through */ }
        localStore.set('followed', localStore.get('followed', []).filter(x => x.name !== location));
        return true;
    },

    /** Get followed locations. */
    async getFollowedLocations() {
        try {
            const r = await api('/api/user/follows');
            if (r.ok && Array.isArray(r.data)) return r.data;
        } catch (e) { /* fall through */ }
        return localStore.get('followed', []).map(x => x.name);
    },

    /** Record a search term. */
    async addSearchHistory(term) {
        try {
            const r = await api('/api/user/history', { method: 'POST', body: { term } });
            if (r.ok) return;
        } catch (e) { /* fall through */ }
        const list = localStore.get('history', []);
        list.unshift({ term, createdAt: new Date().toISOString() });
        localStore.set('history', list.slice(0, 30));
    },

    /** Get search history. */
    async getSearchHistory() {
        try {
            const r = await api('/api/user/history');
            if (r.ok && Array.isArray(r.data)) return r.data;
        } catch (e) { /* fall through */ }
        return localStore.get('history', []).slice(0, 10).map(x => x.term);
    },

    /** Save a setting. */
    async saveSetting(key, value) {
        try {
            const r = await api('/api/user/settings', { method: 'PUT', body: { [key]: value } });
            if (r.ok) return;
        } catch (e) { /* fall through */ }
        const s = localStore.get('settings', {});
        s[key] = value;
        localStore.set('settings', s);
    },

    /** Get a setting. */
    async getSetting(key) {
        try {
            const r = await api('/api/user/settings');
            if (r.ok && r.data && r.data[key] != null) return r.data[key];
        } catch (e) { /* fall through */ }
        const s = localStore.get('settings', {});
        return s[key] != null ? s[key] : null;
    },

    /** Fake login helper (backend doesn't require auth; kept for parity). */
    async ensureLogin() {
        try {
            const r = await api('/api/health');
            return r.ok;
        } catch (e) { return false; }
    },

    /** Current user id (used for backend separation). */
    async currentUserId() {
        return userToken();
    }
};

// Expose globally
window.Backend = Backend;
window.FIREBASE_READY = FIREBASE_READY;
window.FIREBASE_CONFIG = FIREBASE_CONFIG;
window.localStore = localStore;
window.API_BASE = API_BASE;

