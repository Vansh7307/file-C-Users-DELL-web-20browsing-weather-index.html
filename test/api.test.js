const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server/server');
let server, base;
test.before(async () => { server = app.listen(0); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
test.after(() => server.close());
test('health check reports operational telemetry', async () => { const response = await fetch(base + '/api/health-check'); assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.ok, true); assert.equal(body.status, 'operational'); });
test('invalid weather input returns a clean client error', async () => { const response = await fetch(base + '/api/weather/current'); assert.equal(response.status, 400); assert.match((await response.json()).error, /valid city/i); });
test('missing provider configuration never causes a 500', async () => { const response = await fetch(base + '/api/weather/current?q=New%20York'); assert.notEqual(response.status, 500); });
