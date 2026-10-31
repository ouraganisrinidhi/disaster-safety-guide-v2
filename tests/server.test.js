const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');

let server;
let origin;

test.before(async () => {
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise(resolve => server.close(resolve));
  await app.locals.closeDatabase();
});

test('serves the public application', async () => {
  const response = await fetch(`${origin}/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Disaster Safety Guide/);
});

test('reports offline-first health', async () => {
  const response = await fetch(`${origin}/api/health`);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.mode, 'offline-first');
});

test('does not expose administrator data anonymously', async () => {
  const response = await fetch(`${origin}/api/admin/dashboard`);
  assert.equal(response.status, 401);
});

test('validates feedback before database access', async () => {
  const response = await fetch(`${origin}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'other', message: 'short' })
  });
  assert.equal(response.status, 400);
});
