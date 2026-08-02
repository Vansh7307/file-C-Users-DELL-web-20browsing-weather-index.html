/* ============================================================
   Weather Dashboard - AQI.in style
   Live data via OpenWeatherMap
   ============================================================ */

const DEFAULT_CITY = 'Karnal';
// Backend API base (served by the Node server in /server). If the backend
// is unreachable, falls back to direct OpenWeatherMap/Nominatim calls.
const API_BASE = (window.API_BASE || (window.location.port === '5000' ? '' : 'http://' + window.location.hostname + ':5000'));
const API_KEY = '929573d4f9cd2cf581b99af64ee069e8'; // fallback direct-API key
const GEO_PROXY = API_BASE + '/api/geo/search?q=';

// ---------- Cache of DOM elements ----------
const $ = (id) => document.getElementById(id);
const els = {
    cityInput: $('city-input'),
    searchResults: $('search-results'),
    locateBtn: $('locate-btn'),
    locateBtn2: $('locate-btn-2'),
    breadcrumbCity: $('breadcrumb-city'),
    cityName: $('city-name'),
    temp: $('temp'),
    tempHi: $('temp-hi'),
    tempLo: $('temp-lo'),
    tempLevelBadge: $('temp-level-badge'),
    weatherDesc: $('weather-desc'),
    weatherIconLg: $('weather-icon-lg'),
    feelsLike: $('feels-like'),
    rainChance: $('rain-chance'),
    humidity: $('humidity'),
    aqiValue: $('aqi-value'),
    aqiCategory: $('aqi-category'),
    aqiNeedle: $('aqi-needle'),
    hourlyScroll: $('hourly-scroll'),
    hourlyNote: $('hourly-note'),
    lastUpdated: $('last-updated'),
    paramCity: $('param-city'),
    windDeg: $('wind-deg'),
    windSpeed: $('wind-speed'),
    windDirLabel: $('wind-dir-label'),
    dialArrow: $('dial-arrow'),
    gustSpeed: $('gust-speed'),
    cloudCover: $('cloud-cover'),
    visibility: $('visibility'),
    precipitation: $('precipitation'),
    precipNote: $('precip-note'),
    pressure: $('pressure'),
    pressureNeedle: $('pressure-needle'),
    pressureIndicator: $('pressure-indicator'),
    uvIndex: $('uv-index'),
    uvLevel: $('uv-level'),
    uvIndicator: $('uv-indicator'),
    uvNote: $('uv-note'),
    forecastCity: $('forecast-city'),
    dayCarousel: $('day-carousel'),
    sunrise: $('sunrise'),
    sunset: $('sunset'),
    sunPosition: $('sun-position'),
    dayLength: $('day-length'),
    monthlyCity: $('monthly-city'),
    monthLabel: $('month-label'),
    monthStats: $('month-stats'),
    rankingsCard: $('rankings-card'),
    hamburger: $('hamburger'),
    themeToggle: $('theme-toggle'),
};

// ---------- Weather icon mapping (OpenWeatherMap code -> AQI.in SVG) ----------
const ICON_BASE = 'https://www.aqi.in/media/weather-icons/';
const WEATHER_ICONS = {
    '01d': 'sunny.svg', '01n': 'clear.svg',
    '02d': 'partly-cloudy.svg', '02n': 'partly-cloudy.svg',
    '03d': 'cloudy.svg', '03n': 'cloudy.svg',
    '04d': 'overcast.svg', '04n': 'overcast.svg',
    '09d': 'patchy-light-drizzle.svg', '09n': 'patchy-light-drizzle.svg',
    '10d': 'patchy-rain-possible.svg', '10n': 'patchy-rain-possible.svg',
    '11d': 'thundery-outbreaks-possible.svg', '11n': 'thundery-outbreaks-possible.svg',
    '13d': 'moderate-snow.svg', '13n': 'moderate-snow.svg',
    '50d': 'smoky-haze.svg', '50n': 'smoky-haze.svg',
};
function iconUrl(code) { return ICON_BASE + (WEATHER_ICONS[code] || 'partly-cloudy.svg'); }

// ---------- Wind direction ----------
const WIND_DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
function windDir(deg) { return WIND_DIRS[Math.round(deg / 22.5) % 16]; }

// ---------- AQI estimation ----------
function estimateAQI(weather) {
    let score = 40;
    score += (weather.main && weather.main.humidity != null ? weather.main.humidity : 50) * 0.4;
    if ((weather.wind && weather.wind.speed != null ? weather.wind.speed : 5) < 3) score += 20;
    if ((weather.clouds && weather.clouds.all != null ? weather.clouds.all : 20) > 80) score += 10;
    score += (Math.random() * 20 - 10);
    return Math.max(15, Math.min(400, Math.round(score)));
}
function aqiInfo(aqi) {
    if (aqi <= 50) return { cat: 'Good', tip: 'Air quality is satisfactory.', color: '#59b61f', pos: aqi / 50 * 20 };
    if (aqi <= 100) return { cat: 'Moderate', tip: 'Sensitive people should limit outdoor activity.', color: '#EEC732', pos: 20 + (aqi - 50) / 50 * 20 };
    if (aqi <= 150) return { cat: 'Poor', tip: 'Sensitive people affected.', color: '#EA8C34', pos: 40 + (aqi - 100) / 50 * 20 };
    if (aqi <= 200) return { cat: 'Unhealthy', tip: 'Everyone may experience health effects.', color: '#E95478', pos: 60 + (aqi - 150) / 50 * 20 };
    if (aqi <= 300) return { cat: 'Very Unhealthy', tip: 'Health alert - everyone may be affected.', color: '#B33FBA', pos: 80 + (aqi - 200) / 100 * 10 };
    return { cat: 'Hazardous', tip: 'Emergency conditions - avoid outdoors.', color: '#C92033', pos: 90 + Math.min(10, (aqi - 300) / 20) };
}

// ---------- Temperature level badge ----------
function tempBadge(t) {
    if (t >= 40) return { text: 'Extremely Hot', color: '#E95478' };
    if (t >= 35) return { text: 'Hot', color: '#F2644E' };
    if (t >= 30) return { text: 'Warm', color: '#EA8C34' };
    if (t >= 25) return { text: 'Mild', color: '#EEC732' };
    if (t >= 18) return { text: 'Pleasant', color: '#59b61f' };
    if (t >= 10) return { text: 'Cool', color: '#4BA9FF' };
    if (t >= 0)  return { text: 'Cold', color: '#3b9ae8' };
    return { text: 'Freezing', color: '#8ea4c4' };
}

// ---------- UV index estimation ----------
function estimateUV(weather) {
    const cloud = weather.clouds && weather.clouds.all != null ? weather.clouds.all : 0;
    const clear = 100 - cloud;
    const base = (weather.main && weather.main.temp != null ? weather.main.temp : 25) / 10;
    let uv = base * (0.5 + clear / 180);
    uv = Math.max(0.5, Math.min(11, uv));
    return Math.round(uv * 10) / 10;
}
function uvInfo(uv) {
    if (uv < 3) return { level: 'Low', pos: uv / 3 * 20, color: '#59b61f' };
    if (uv < 6) return { level: 'Moderate', pos: 20 + (uv - 3) / 3 * 20, color: '#EFD531' };
    if (uv < 8) return { level: 'High', pos: 60 + (uv - 6) / 2 * 15, color: '#EA8C34' };
    if (uv < 11) return { level: 'Very High', pos: 75 + (uv - 8) / 3 * 15, color: '#E95478' };
    return { level: 'Extreme', pos: 95, color: '#B33FBA' };
}

// ---------- Formatting helpers ----------
function fmtAMPM(unix, tzOffsetSec) {
    const d = new Date((unix + tzOffsetSec) * 1000);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' }).toUpperCase();
}
function rainChanceFrom(item) {
    if (item.pop != null) return Math.round(item.pop * 100);
    if (item.rain) return (item.rain['3h'] || item.rain['1h'] || 1) * 20;
    return 0;
}

// ---------- API helpers (backend first, direct API fallback) ----------
async function fetchCurrentWeather(city) {
    const backendUrl = API_BASE + '/api/weather/current?q=' + encodeURIComponent(city);
    try {
        const r = await fetch(backendUrl);
        if (r.ok) return await r.json();
    } catch (e) { /* fall back to direct API */ }
    const directUrl = 'https://api.openweathermap.org/data/2.5/weather?q=' + encodeURIComponent(city) + '&appid=' + API_KEY + '&units=metric';
    const r = await fetch(directUrl);
    if (!r.ok) throw new Error('City not found');
    return await r.json();
}

async function fetchForecast(city) {
    const backendUrl = API_BASE + '/api/weather/forecast?q=' + encodeURIComponent(city);
    try {
        const r = await fetch(backendUrl);
        if (r.ok) return await r.json();
    } catch (e) { /* fall back to direct API */ }
    const directUrl = 'https://api.openweathermap.org/data/2.5/forecast?q=' + encodeURIComponent(city) + '&appid=' + API_KEY + '&units=metric';
    const r = await fetch(directUrl);
    if (!r.ok) throw new Error('Forecast not found');
    return await r.json();
}

async function fetchByCoords(lat, lon) {
    const backendUrl = API_BASE + '/api/weather/current-by-coords?lat=' + lat + '&lon=' + lon;
    try {
        const r = await fetch(backendUrl);
        if (r.ok) return await r.json();
    } catch (e) { /* fall back to direct API */ }
    const directUrl = 'https://api.openweathermap.org/data/2.5/weather?lat=' + lat + '&lon=' + lon + '&appid=' + API_KEY + '&units=metric';
    const r = await fetch(directUrl);
    if (!r.ok) throw new Error('Location not found');
    return await r.json();
}

// ---------- Main render function ----------
async function fetchWeather(city) {
    try {
        const [cur, fc] = await Promise.all([
            fetchCurrentWeather(city),
            fetchForecast(city).catch(function () { return null; })
        ]);

        renderCurrent(cur);
        if (fc) {
            renderHourly(fc);
            renderDaily(fc);
        }
        renderMonthly(cur);
        renderRankings(cur);
    } catch (err) {
        console.error('Fetch error:', err);
        alert('Could not find that location. Please try another city name.');
    }
}

function renderCurrent(w) {
    const tz = w.timezone;
    const tempC = Math.round(w.main.temp);
    const name = w.name;
    const badge = tempBadge(tempC);
    const humidity = w.main.humidity;
    const rain = rainChanceFrom(w);
    const uv = estimateUV(w);
    const aqi = estimateAQI(w);
    const aq = aqiInfo(aqi);
    const uvInfoObj = uvInfo(uv);

    // Text values
    els.cityName.textContent = name;
    els.breadcrumbCity.textContent = name;
    els.paramCity.textContent = name;
els.forecastCity.textContent = name;
    els.monthlyCity.textContent = name;
    const climateCity = $('climate-city');
    if (climateCity) climateCity.textContent = name;
    document.title = name + ' Weather Conditions | Live Weather & 10 Days Forecast';
    els.temp.textContent = tempC;
    els.tempHi.textContent = Math.round(w.main.temp_max);
    els.tempLo.textContent = Math.round(w.main.temp_min);
    els.tempLevelBadge.textContent = badge.text;
    els.tempLevelBadge.style.background = badge.color;
    els.weatherDesc.textContent = w.weather[0].description;
    els.weatherIconLg.src = iconUrl(w.weather[0].icon);
    els.feelsLike.textContent = Math.round(w.main.feels_like);
    els.rainChance.textContent = rain;
    els.humidity.textContent = humidity;

    // AQI
    els.aqiValue.textContent = aqi;
    els.aqiCategory.textContent = aq.cat;
    els.aqiCategory.style.fill = aq.color;
    els.aqiNeedle.style.offsetDistance = aq.pos + '%';
    const aqiFooter = document.querySelector('.aqi-card .footer-text');
    if (aqiFooter) aqiFooter.textContent = aq.tip;

    // Wind
    const windKmh = Math.round((w.wind.speed || 0) * 3.6 * 10) / 10;
    els.windDeg.textContent = w.wind.deg;
    els.windSpeed.textContent = windKmh;
    els.windDirLabel.textContent = windDir(w.wind.deg);
    els.dialArrow.style.transform = 'rotate(' + w.wind.deg + 'deg)';

    // Gust
    const gust = Math.round((w.wind.speed || 0) * 1.6 * 10) / 10;
    els.gustSpeed.textContent = gust.toFixed(1);

    // Cloud / visibility
    els.cloudCover.textContent = w.clouds && w.clouds.all != null ? w.clouds.all : 0;
    const visKm = (w.visibility != null ? w.visibility : 10000) / 1000;
    els.visibility.textContent = visKm;

    // Precipitation
    const precip = w.rain ? (w.rain['1h'] || w.rain['3h'] || 0) : 0;
    els.precipitation.textContent = precip;
    els.precipNote.textContent = precip;

    // Pressure
    const pres = w.main.pressure;
    els.pressure.textContent = pres;
    const presPos = Math.max(5, Math.min(95, ((pres - 960) / (1040 - 960)) * 100));
    els.pressureNeedle.style.offsetDistance = presPos + '%';
    els.pressureIndicator.style.left = presPos + '%';

    // UV
    els.uvIndex.textContent = uv.toFixed(1);
    els.uvLevel.textContent = uvInfoObj.level;
    els.uvIndicator.style.left = uvInfoObj.pos + '%';
    els.uvIndicator.style.color = uvInfoObj.color;
    els.uvNote.textContent = uv.toFixed(1);

    // Sunrise / sunset
    const rise = fmtAMPM(w.sys.sunrise, tz);
    const set = fmtAMPM(w.sys.sunset, tz);
    els.sunrise.textContent = rise;
    els.sunset.textContent = set;
    const dayLen = (w.sys.sunset - w.sys.sunrise) / 3600;
    const h = Math.floor(dayLen);
    const m = Math.round((dayLen - h) * 60);
    els.dayLength.textContent = h + 'hrs ' + m + 'min';

    // Sun position arc
    const nowUnix = Math.floor(Date.now() / 1000);
    const elapsed = nowUnix - w.sys.sunrise;
    const pct = Math.max(0, Math.min(1, elapsed / (w.sys.sunset - w.sys.sunrise)));
    els.sunPosition.style.transform = 'translate(-50%, -50%) rotate(' + (-80 + pct * 160) + 'deg) translateY(-3.25rem)';

    // Last updated
    const now = new Date();
    els.lastUpdated.textContent = now.toLocaleString('en-IN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: true
    });

    // Hourly note
    els.hourlyNote.textContent = 'It may stay ' + w.weather[0].description + ' and ' + (tempC >= 32 ? 'warm' : 'comfortable') + '.';
}

// ---------- Hourly ----------
function renderHourly(fc) {
    const tz = fc.city.timezone;
    const list = fc.list.slice(0, 24);
    els.hourlyScroll.innerHTML = '';

    list.forEach(function (item, i) {
        let hourLabel;
        if (i === 0) {
            hourLabel = 'Now';
        } else {
            hourLabel = new Date((item.dt + tz) * 1000).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true, timeZone: 'UTC' });
        }
        const rain = rainChanceFrom(item);
        const div = document.createElement('div');
        div.className = 'hour-item';
        div.innerHTML =
            '<span class="hour">' + hourLabel + '</span>' +
            '<img src="' + iconUrl(item.weather[0].icon) + '" alt="' + item.weather[0].description + '">' +
            '<span class="h-temp">' + Math.round(item.main.temp) + '&deg;</span>' +
            '<span class="h-rain">' +
            '<svg viewBox="0 0 14 14" fill="currentColor"><path d="M9.625 9.625H3.938C1.745 9.6.874 7.924.874 7c0-1.194 1.06-2.533 2.625-2.625-.014-1.778 1.086-3.5 3.063-3.5 1.5 0 2.493.919 2.851 2.193 2.023-.093 3.711 1.332 3.711 3.057 0 1.837-1.323 3.5-3.5 3.5z"/></svg>' +
            rain + '%</span>';
        els.hourlyScroll.appendChild(div);
    });
}

// ---------- 10 day forecast ----------
function renderDaily(fc) {
    const tz = fc.city.timezone;
    const byDay = {};
    fc.list.forEach(function (item) {
        const key = new Date((item.dt + tz) * 1000).toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' });
        if (!byDay[key]) byDay[key] = item;
    });

    const days = [];
    for (const k in byDay) {
        if (byDay.hasOwnProperty(k)) days.push(byDay[k]);
    }
    const firstFive = days.slice(0, 5);

    // Extend to 10 using pattern
    const extended = firstFive.slice();
    for (let i = firstFive.length; i < 10; i++) {
        const src = firstFive[i % firstFive.length];
        const copy = JSON.parse(JSON.stringify(src));
        copy.dt = src.dt + i * 86400;
        copy.main.temp_min = Math.round(src.main.temp_min - 0.8 * i);
        copy.main.temp_max = Math.round(src.main.temp_max - 0.3 * i);
        copy.main.temp = (copy.main.temp_max + copy.main.temp_min) / 2;
        extended.push(copy);
    }

    els.dayCarousel.innerHTML = '';
    extended.forEach(function (d, idx) {
        const dt = new Date((d.dt + tz) * 1000);
        const isToday = idx === 0;
        const name = isToday ? 'Today' : dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
        const date = dt.toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' });
        const rain = rainChanceFrom(d);
        const div = document.createElement('div');
        div.className = 'day-card' + (isToday ? ' active' : '');
        div.innerHTML =
            '<div class="day-name"><span>' + name + '</span><span class="day-date">' + date + '</span></div>' +
            '<img src="' + iconUrl(d.weather[0].icon) + '" alt="' + d.weather[0].description + '">' +
            '<div class="day-temp">' + Math.round(d.main.temp_max) + '&deg; / ' + Math.round(d.main.temp_min) + '&deg;</div>' +
            '<div class="day-cond">' + d.weather[0].description + '</div>' +
            '<div class="day-rain">&#127783; ' + rain + '%</div>';
        els.dayCarousel.appendChild(div);
    });
}

// ---------- Monthly (demo) ----------
let monthOffset = 0;
function renderMonthly(weather) {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const monthName = target.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    els.monthLabel.textContent = monthName;

    const base = weather && weather.main && weather.main.temp != null ? weather.main.temp : 28;
    const avgHigh = Math.round(base + 4 + monthOffset * 0.8);
    const avgLow = Math.round(base - 6 + monthOffset * 0.5);
    const rainDays = Math.max(0, Math.round(6 + monthOffset * 0.7));
    const humidity = weather && weather.main ? weather.main.humidity : 50;

    els.monthStats.innerHTML =
        '<p>Average conditions for <b>' + monthName + '</b> based on current data.</p>' +
        '<div class="stat-grid">' +
        '<div class="stat"><b>' + avgHigh + '&deg;C</b><br><small>Avg High</small></div>' +
        '<div class="stat"><b>' + avgLow + '&deg;C</b><br><small>Avg Low</small></div>' +
        '<div class="stat"><b>' + rainDays + '</b><br><small>Rainy Days</small></div>' +
        '<div class="stat"><b>' + humidity + '%</b><br><small>Avg Humidity</small></div>' +
        '</div>';
}

// ---------- Rankings ----------
const NEARBY_CITIES = ['New Delhi', 'Chandigarh', 'Gurugram', 'Panipat', 'Kurukshetra', 'Ambala', 'Jind', 'Sonipat'];
async function renderRankings(current) {
    let rows = [];
    // Try backend endpoint first (aggregates server-side)
    try {
        const backendUrl = API_BASE + '/api/weather/rankings?q=' + encodeURIComponent(current.name);
        const r = await fetch(backendUrl);
        if (r.ok) rows = await r.json();
    } catch (e) { /* fall through */ }

    // Fallback: fetch each city directly
    if (!rows.length) {
        const items = [current.name].concat(NEARBY_CITIES);
        for (let i = 0; i < items.length; i++) {
            try {
                const r = await fetch('https://api.openweathermap.org/data/2.5/weather?q=' + encodeURIComponent(items[i]) + '&appid=' + API_KEY + '&units=metric');
                if (r.ok) {
                    const j = await r.json();
                    rows.push({ name: j.name, temp: Math.round(j.main.temp), desc: j.weather[0].description });
                }
            } catch (e) { /* skip */ }
        }
        rows.sort(function (a, b) { return b.temp - a.temp; });
    }
    let html = '';
    rows.forEach(function (row, idx) {
        html +=
            '<div class="rank-item">' +
            '<span class="rank-num">' + (idx + 1) + '</span>' +
            '<span class="rank-name">' + row.name + '</span>' +
            '<span class="rank-temp">' + row.temp + '&deg;C &nbsp; ' + row.desc + '</span>' +
            '</div>';
    });
    els.rankingsCard.innerHTML = html || '<p>No ranking data available.</p>';
}

// ---------- Search ----------
let debounceTimer;
els.cityInput.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    const q = els.cityInput.value.trim();
    if (q.length < 2) {
        els.searchResults.classList.remove('show');
        return;
    }
    debounceTimer = setTimeout(async function () {
        try {
            const r = await fetch(GEO_PROXY + encodeURIComponent(q));
            const data = await r.json();
            if (!data.length) {
                els.searchResults.classList.remove('show');
                return;
            }
            els.searchResults.innerHTML = '';
            data.slice(0, 6).forEach(function (place) {
                const div = document.createElement('div');
                div.className = 'search-result-item';
                div.innerHTML = '<span>' + place.display_name.split(',')[0] + '</span><small>' + place.display_name.split(',').slice(0, 3).join(', ') + '</small>';
                div.addEventListener('click', function () {
                    els.cityInput.value = place.display_name.split(',')[0];
                    els.searchResults.classList.remove('show');
                    fetchWeather(place.display_name.split(',')[0]);
                });
                els.searchResults.appendChild(div);
            });
            els.searchResults.classList.add('show');
        } catch (e) {
            console.error('Search error:', e);
        }
    }, 350);
});

document.addEventListener('click', function (e) {
    if (!e.target.closest('.search-location')) els.searchResults.classList.remove('show');
});

// Enter key search
els.cityInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        const q = els.cityInput.value.trim();
        if (q) {
            els.searchResults.classList.remove('show');
            fetchWeather(q);
        }
    }
});

// ---------- Locate me ----------
function handleLocate() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
    }
    navigator.geolocation.getCurrentPosition(
        async function (pos) {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            const url = 'https://api.openweathermap.org/data/2.5/weather?lat=' + lat + '&lon=' + lon + '&appid=' + API_KEY + '&units=metric';
            try {
                const r = await fetch(url);
                const j = await r.json();
                if (j.name) {
                    els.cityInput.value = j.name;
                    fetchWeather(j.name);
                }
            } catch (e) {
                alert('Could not locate your position.');
            }
        },
        function () { alert('Location access denied.'); },
        { enableHighAccuracy: true, timeout: 8000 }
    );
}
els.locateBtn.addEventListener('click', handleLocate);
els.locateBtn2.addEventListener('click', handleLocate);

// ---------- Monthly navigation ----------
$('prev-month').addEventListener('click', function () {
    monthOffset -= 1;
    renderMonthly(null);
});
$('next-month').addEventListener('click', function () {
    monthOffset += 1;
    renderMonthly(null);
});

// ---------- Hamburger ----------
els.hamburger.addEventListener('click', function () {
    const nav = document.querySelector('.nav-links');
    const settings = document.querySelector('.header-settings');
    if (nav) nav.classList.toggle('open');
    if (settings) settings.classList.toggle('open');
});

/* ============================================================
   BACKEND + INTERACTIVE BUTTONS (Firebase / localStorage)
   ============================================================ */

// ---------- Track current weather location for buttons ----------
let currentCity = DEFAULT_CITY;
let currentCoords = null; // {lat, lon}
const FALLBACK_COORDS = { lat: 29.6885, lon: 76.9904 }; // Karnal, Haryana

// ---------- Map button (Leaflet modal) ----------
const mapModal = $('map-modal');
const mapCloseBtn = $('map-modal-close');
const mapCityName = $('map-city-name');
let mapInstance = null;

function openMap() {
    mapModal.hidden = false;
    mapCityName.textContent = currentCity;
    if (!window.L) {
        alert('Map library is still loading. Please try again in a moment.');
        return;
    }
    const coords = currentCoords || FALLBACK_COORDS;
    setTimeout(function () {
        if (!mapInstance) {
            mapInstance = L.map('map').setView([coords.lat, coords.lon], 10);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(mapInstance);
        } else {
            mapInstance.setView([coords.lat, coords.lon], 10);
        }
        // Refresh size when modal becomes visible
        setTimeout(function () { mapInstance.invalidateSize(); }, 50);
        L.marker([coords.lat, coords.lon]).addTo(mapInstance)
            .bindPopup('<b>' + currentCity + '</b>')
            .openPopup();
    }, 100);
}
$('map-btn').addEventListener('click', openMap);
mapCloseBtn.addEventListener('click', function () { mapModal.hidden = true; });
mapModal.addEventListener('click', function (e) {
    if (e.target === mapModal) mapModal.hidden = true;
});
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !mapModal.hidden) mapModal.hidden = true;
});

// ---------- AQI / Weather tab toggle ----------
const aqiWeatherTabs = document.querySelectorAll('.tabs-aqi-weather .tab');
aqiWeatherTabs.forEach(function (tab) {
    tab.addEventListener('click', function (e) {
        e.preventDefault();
        aqiWeatherTabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        const isAqi = tab.textContent.indexOf('AQI') > -1;
        const aqiCards = document.querySelector('.aqi-humidity-cards');
        if (aqiCards) {
            if (isAqi) {
                aqiCards.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                document.querySelector('#hash-current').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    });
});

// ---------- Follow button (Firebase + localStorage fallback) ----------
const followBtn = $('follow-btn');
let isFollowing = false;
let followingSet = new Set();

async function refreshFollowState() {
    try {
        const list = await Backend.getFollowedLocations();
        followingSet = new Set(list);
        isFollowing = followingSet.has(currentCity);
        followBtn.style.background = isFollowing ? 'rgba(233,84,120,0.3)' : '';
        followBtn.textContent = isFollowing ? '💗' : '❤️';
    } catch (e) { /* ignore */ }
}

followBtn.addEventListener('click', async function () {
    try {
        await Backend.ensureLogin();
        if (isFollowing) {
            await Backend.unfollowLocation(currentCity);
        } else {
            await Backend.followLocation(currentCity);
        }
        await refreshFollowState();
    } catch (e) {
        alert('Could not save your follow. Check Firebase config in firebase-config.js.');
    }
});

// ---------- Share button (copy link) ----------
$('share-btn').addEventListener('click', async function () {
    const url = location.href.split('#')[0] + '#hash-current?city=' + encodeURIComponent(currentCity);
    try {
        await navigator.clipboard.writeText(url);
        const shareBtn = this;
        shareBtn.textContent = '✅';
        setTimeout(function () { shareBtn.textContent = '↗️'; }, 1500);
    } catch (e) {
        alert('Copy failed. Copy this link manually: ' + url);
    }
});

// ---------- Header "Ranking" -> scroll to rankings ----------
document.querySelectorAll('.nav-links a[href="#"], .sub-nav a[href="#hash-rankings"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
        if (this.textContent.indexOf('Ranking') > -1 || this.getAttribute('href') === '#hash-rankings') {
            e.preventDefault();
            document.querySelector('#hash-rankings').scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// ============================================================
//   AUTH MODAL (login / register / logout via real backend)
// ============================================================
const authModal = $('auth-modal');
const authModalTitle = $('auth-modal-title');
const authLoginForm = $('auth-login-form');
const authRegisterForm = $('auth-register-form');
const authError = $('auth-error');
const authRegError = $('auth-reg-error');

function showAuthError(el, msg) {
    if (el) { el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }
}

function openAuthModal(mode) {
    if (authModal) authModal.hidden = false;
    const isLogin = mode !== 'register';
    if (authModalTitle) authModalTitle.textContent = isLogin ? 'Login' : 'Create Account';
    if (authLoginForm) authLoginForm.hidden = !isLogin;
    if (authRegisterForm) authRegisterForm.hidden = isLogin;
    showAuthError(authError, '');
    showAuthError(authRegError, '');
}

function closeAuthModal() {
    if (authModal) authModal.hidden = true;
}

function updateLoginBtn() {
    const btn = document.querySelector('.login-btn');
    if (!btn) return;
    const user = Backend.getUser();
    if (Backend.isLoggedIn() && user) {
        btn.textContent = user.name || user.email || 'Account';
        btn.classList.add('logged-in');
        btn.title = 'Logged in as ' + user.email + '. Click to logout.';
    } else {
        btn.textContent = 'Login';
        btn.classList.remove('logged-in');
        btn.title = 'Login';
    }
}

// Open modal when clicking Login
document.querySelector('.login-btn').addEventListener('click', function (e) {
    e.preventDefault();
    if (Backend.isLoggedIn()) {
        // Logged in -> offer logout
        if (confirm('Logged in as ' + (Backend.getUser() ? Backend.getUser().email : '') + '. Logout?')) {
            Backend.logout().then(function () {
                updateLoginBtn();
                renderHistory();
                refreshFollowState();
            });
        }
        return;
    }
    openAuthModal('login');
});

// Close modal
const authCloseBtn = $('auth-modal-close');
if (authCloseBtn) {
    authCloseBtn.addEventListener('click', closeAuthModal);
}
if (authModal) {
    authModal.addEventListener('click', function (e) {
        if (e.target === authModal) closeAuthModal();
    });
}

// Switch between login / register forms
const toRegister = $('auth-to-register');
const toLogin = $('auth-to-login');
if (toRegister) toRegister.addEventListener('click', function (e) {
    e.preventDefault();
    openAuthModal('register');
});
if (toLogin) toLogin.addEventListener('click', function (e) {
    e.preventDefault();
    openAuthModal('login');
});

// Login submit
authLoginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const email = $('auth-email').value.trim();
    const password = $('auth-password').value;
    showAuthError(authError, 'Logging in…');
    const res = await Backend.login(email, password);
    if (res.ok) {
        showAuthError(authError, '');
        closeAuthModal();
        authLoginForm.reset();
        updateLoginBtn();
        renderHistory();
        refreshFollowState();
    } else {
        showAuthError(authError, res.error || 'Login failed.');
    }
});

// Register submit
authRegisterForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const name = $('auth-name').value.trim();
    const email = $('auth-reg-email').value.trim();
    const password = $('auth-reg-password').value;
    showAuthError(authRegError, 'Creating account…');
    const res = await Backend.register(name, email, password);
    if (res.ok) {
        showAuthError(authRegError, '');
        closeAuthModal();
        authRegisterForm.reset();
        updateLoginBtn();
        renderHistory();
        refreshFollowState();
    } else {
        showAuthError(authRegError, res.error || 'Registration failed.');
    }
});

// Escape key closes auth modal too
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && authModal && !authModal.hidden) closeAuthModal();
});

// ---------- Search history ----------
const historyCard = $('history-card');
async function renderHistory() {
    const items = await Backend.getSearchHistory();
    if (!items || !items.length) {
        historyCard.innerHTML = '<p>No recent searches yet.</p>';
        return;
    }
    let html = '';
    items.forEach(function (term) {
        html += '<span class="history-chip" data-term="' + term + '">' + term + '<span class="clear">✕</span></span>';
    });
    historyCard.innerHTML = html;
    historyCard.querySelectorAll('.history-chip').forEach(function (chip) {
        chip.addEventListener('click', function (e) {
            if (e.target.classList.contains('clear')) return;
            fetchWeather(chip.getAttribute('data-term'));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

// Record a search on fetchWeather
const originalFetchWeather = fetchWeather;
fetchWeather = async function (city) {
    const clean = String(city).trim();
    if (clean) {
        currentCity = clean;
        Backend.addSearchHistory(clean);
        renderHistory();
        // Try to get coordinates for the map
        try {
            const r = await fetch(GEO_PROXY + encodeURIComponent(clean));
            const data = await r.json();
            if (data && data.length && data[0].lat && data[0].lon) {
                currentCoords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
            }
        } catch (e) { /* ignore */ }
    }
    await originalFetchWeather(clean);
    refreshFollowState();
};

// ---------- Theme toggle (light / dark) ----------
const themeToggle = $('theme-toggle');
const sunIcon = themeToggle.querySelector('.sun-icon');
const moonIcon = themeToggle.querySelector('.moon-icon');

function applyTheme(theme) {
    document.body.classList.toggle('light-theme', theme === 'light');
    if (sunIcon && moonIcon) {
        sunIcon.style.display = theme === 'light' ? 'none' : 'block';
        moonIcon.style.display = theme === 'light' ? 'block' : 'none';
    }
    try { localStorage.setItem('weather-theme', theme); } catch (e) { /* ignore */ }
}

function initTheme() {
    let saved = 'dark';
    try { saved = localStorage.getItem('weather-theme') || 'dark'; } catch (e) { /* ignore */ }
    applyTheme(saved);
}

themeToggle.addEventListener('click', function () {
    const isLight = document.body.classList.contains('light-theme');
    applyTheme(isLight ? 'dark' : 'light');
});

initTheme();

// ---------- Init ----------
(async function init() {
    await Backend.ensureLogin();
    // Validate any saved session and restore the login button label
    await Backend.me().catch(function () { return null; });
    updateLoginBtn();
    renderHistory();
    refreshFollowState();
    fetchWeather(DEFAULT_CITY);
})();

