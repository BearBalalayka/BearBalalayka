import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createLocalServer } from '../local-server.mjs';

test('локальный сервер отдаёт страницу, вопросы и проверяет API', async (t) => {
  const server = createLocalServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  const page = await fetch(base + '/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /surveyForm/);

  const questions = await fetch(base + '/questions.json');
  assert.equal(questions.status, 200);
  assert.equal((await questions.json()).length, 6);

  const invalid = await fetch(base + '/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: { q1: 'yes' }, username: '' }),
  });
  assert.equal(invalid.status, 400);
  const data = await invalid.json();
  assert.ok(data.errors.username);
  assert.ok(data.errors.q5);
});
