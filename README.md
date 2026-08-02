# 🌦️ Weather Dashboard (AQI.in Style)

A fully responsive weather dashboard cloned from AQI.in's Karnal weather page, with live data from **OpenWeatherMap** and a **Firebase** backend for Follow, Rankings, Search History, and Settings.

![Stack](https://img.shields.io/badge/Stack-HTML%20%7C%20CSS%20%7C%20JS%20%7C%20Firebase-blue)

---

## ✨ Features

- **Live weather** — current conditions, hourly forecast (24h), 10-day forecast
- **Weather parameters** — wind dial, gust, cloud cover, visibility, precipitation, pressure gauge, UV index
- **Sunrise/Sunset** arc with daylight duration
- **Monthly averages** + **city rankings**
- **Search** — autocomplete any city (OpenStreetMap Nominatim)
- **Locate me** — geolocation-based weather
- **Firebase backend**:
  - ❤️ Follow locations (saved per-user)
  - 🔎 Search history
  - 🏆 City rankings (from DB, falls back to live API)
  - ⚙️ Settings (AQI standard / temp unit)
  - 🔐 Anonymous Auth (works out of the box)
  - 📦 **localStorage fallback** — everything works even without configuring Firebase

---

## 🚀 Quick Start (local)

Just open `index.html` in a browser. The site loads **Karnal** by default and works with the localStorage fallback.

## ☁️ Firebase Backend Setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com) (Spark plan = free).
2. **Add a Web App** → copy the config object.
3. Replace the placeholders in **`firebase-config.js`** with your real values.
4. Enable **Authentication → Sign-in method → Anonymous**.
5. Create **Firestore Database** and deploy rules:

```bash
npm install -g firebase-tools
firebase login
firebase use --add YOUR_PROJECT_ID
firebase deploy --only firestore:rules
```

> Collections are created automatically on first write.

## 🚢 Deploy to Firebase Hosting

```bash
firebase deploy --only hosting
```

### GitHub Actions auto-deploy
Add these **repository secrets** in GitHub → Settings → Secrets:
- `FIREBASE_TOKEN` — run `firebase login:ci` to get one
- `FIREBASE_PROJECT_ID` — your Firebase project id

Every push to `main` auto-deploys to Firebase Hosting.

---

## 📁 Project Structure

```
├── index.html          # Main page
├── style.css           # Styles (dark glass-morphism theme)
├── script1.js          # Weather logic + UI rendering
├── firebase-config.js  # Firebase init + backend API (localStorage fallback)
├── firebase.json       # Firebase hosting config
├── firestore.rules     # Security rules
├── firestore.indexes.json
└── .firebaserc         # Firebase project binding
```

## 🔑 Data Sources

- **OpenWeatherMap** — current weather + 5-day forecast (free tier)
- **OpenStreetMap Nominatim** — city search autocomplete
- **Firebase** — Follows, Search history, Rankings, Settings
- AQI, UV index, and gust speed are estimated from available weather data.

## 📄 License

MIT — free to use.

