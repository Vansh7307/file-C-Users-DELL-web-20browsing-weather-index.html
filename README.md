# Atmos Weather Intelligence

Production-oriented weather dashboard with a Node/Express API gateway and five demo-ready views: live conditions, forecast chart, radar layers, air quality, and system telemetry.

## Run locally

```bash
npm install
copy .env.example .env
# Set WEATHER_API_KEY in .env, then load it in your shell or deployment environment
npm start
```

Open `http://localhost:5000`. The API key never reaches the browser.

## API

- `GET /api/weather/current?q=New%20York` or `?lat=40.71&lon=-74.00`
- `GET /api/weather/forecast?...` — normalized 24-hour and 7-day data
- `GET /api/weather/air-quality?...` — AQI and PM2.5, PM10, CO, NO2, O3
- `GET /api/weather/alerts?lat=...&lon=...` — National Weather Service alerts
- `GET /api/health-check` — Render health probe and cache telemetry

Responses are cached in-memory for two minutes. Provider outages, invalid places, and missing configuration return structured JSON errors rather than server crashes.

## Deploy to Render

1. Push this repository and create a Blueprint from `render.yaml`, or create a Node Web Service with build command `npm ci && npm run build` and start command `npm start`.
2. Set `WEATHER_API_KEY` to an OpenWeather API key (Current Weather, 5 Day / 3 Hour Forecast, Air Pollution, and Weather Maps access).
3. Set `CORS_ORIGIN` to the exact public client origins, comma separated. If this service serves the included client, it can remain blank.
4. Render uses `/api/health-check` for health checks. Add the deployed URL to your uptime monitor to avoid free-tier cold starts during the demo.

Do not commit `.env` or an API key. `render.yaml` intentionally marks secrets as dashboard-supplied.
