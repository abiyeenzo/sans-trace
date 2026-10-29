const test = require('node:test');
const assert = require('node:assert');

function call(handler, req) {
  return new Promise((resolve) => {
    const res = { code: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, end() { resolve(this.code); return this; }, json() { resolve(this.code); return this; } };
    handler(req, res);
  });
}

delete process.env.DATABASE_URL;
const feedback = require('../api/feedback.js');
const ok = { label: 'human', lang: 'fr', level: 'low', signals: 3, words: 120, helpful: true };
const req = (body, extra) => Object.assign({ method: 'POST', headers: { host: 'x.test' }, body }, extra);

test('feedback : accepte un retour valide', async () => {
  assert.strictEqual(await call(feedback, req(ok)), 204);
});

test('feedback : refuse GET, valeurs inconnues et origine etrangere', async () => {
  assert.strictEqual(await call(feedback, req(ok, { method: 'GET' })), 405);
  assert.strictEqual(await call(feedback, req({ ...ok, label: 'robot' })), 400);
  assert.strictEqual(await call(feedback, req({ ...ok, signals: -1 })), 400);
  assert.strictEqual(await call(feedback, req({ ...ok, words: 1e9 })), 400);
  assert.strictEqual(await call(feedback, req({ ...ok, text: 'secret' , level: 'enorme' })), 400);
  assert.strictEqual(await call(feedback, req(null)), 400);
  assert.strictEqual(await call(feedback, req(ok, { headers: { host: 'x.test', origin: 'https://evil.test' } })), 403);
});
