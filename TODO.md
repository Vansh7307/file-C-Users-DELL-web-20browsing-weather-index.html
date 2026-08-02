# Weather Website - AQI.in Clone Build Plan

## Steps
- [x] Analyze existing project and AQI.in reference page
- [x] Get user approval on plan
- [x] Rebuild `index.html` with AQI.in-style layout (header, sub-nav, breadcrumb, hero, hourly, parameters, 10-day forecast, sunrise/sunset, footer)
- [x] Rewrite `style.css` with dark glass-morphism theme and responsive layout
- [x] Rewrite `script1.js` with live weather data (OpenWeatherMap), search, geolocation, chart rendering
- [x] Fix API_BASE detection in `firebase-config.js` and `script1.js` for `file://` / static hosting
- [x] Improve search reliability with OpenWeatherMap geocoding + Nominatim fallback
- [x] Fix search-results rendering to use normalized `{name, region}` objects
- [x] Verify all element IDs referenced in script1.js exist in index.html
- [x] Verify Backend API surface in firebase-config.js matches script1.js usage
- [x] Push changes to GitHub (commit ab61135, origin/main)
- [ ] Verify by opening `index.html` in browser

