import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/submit.mjs';

const url = 'https://example.vercel.app/api/submit';
const validAnswers = { q1: 'yes', q2: 'no', q3: 'yes', q4: 'profit', q5: ['eos', 'bnb', 'vaulta'], q6: 'no' };
function request(value, options = {}) {
  return new Request(url, {
    method: options.method || 'POST',
    headers: { 'content-type': options.contentType || 'application/json' },
    body: JSON.stringify(value),
  });
}

test('rejects missing answers without contacting Telegram', async () => {
  const response = await handler.fetch(request({ answers: { q1: 'yes' }, username: '@tester' }));
  assert.equal(response.status, 400);
  assert.ok((await response.json()).errors.q5);
});

test('does not redirect if Telegram rejects message', async (t) => {
  const original = globalThis.fetch;
  const originalToken = process.env.BOT_TOKEN;
  const originalChatId = process.env.CHAT_ID;
  const originalRedirect = process.env.REDIRECT_URL;
  globalThis.fetch = async () => Response.json({ ok: false, description: 'chat not found' }, { status: 400 });
  process.env.BOT_TOKEN = 'fake-token';
  process.env.CHAT_ID = '123';
  process.env.REDIRECT_URL = 'https://t.me/+ExampleGroupLink';
  t.after(() => {
    globalThis.fetch = original;
    if (originalToken === undefined) delete process.env.BOT_TOKEN;
    else process.env.BOT_TOKEN = originalToken;
    if (originalChatId === undefined) delete process.env.CHAT_ID;
    else process.env.CHAT_ID = originalChatId;
    if (originalRedirect === undefined) delete process.env.REDIRECT_URL;
    else process.env.REDIRECT_URL = originalRedirect;
  });
  const response = await handler.fetch(request({ answers: validAnswers, username: '@tester' }));
  assert.equal(response.status, 502);
  assert.ok(!(await response.json()).redirectUrl);
});

test('returns redirect only after confirmed Telegram message', async (t) => {
  const original = globalThis.fetch;
  const originalToken = process.env.BOT_TOKEN;
  const originalChatId = process.env.CHAT_ID;
  const originalRedirect = process.env.REDIRECT_URL;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(body.chat_id, '123');
    assert.match(body.text, /@tester/);
    assert.match(body.text, /Только если сразу получу прибыль/);
    assert.match(body.text, /EOS, BNB, VAULTA/);
    assert.match(body.text, /Вы гражданин РФ\?/);
    assert.match(body.text, /От кого пришёл: partner_15/);
    return Response.json({ ok: true, result: { message_id: 1 } });
  };
  process.env.BOT_TOKEN = 'fake-token';
  process.env.CHAT_ID = '123';
  process.env.REDIRECT_URL = 'https://t.me/+ExampleGroupLink';
  t.after(() => {
    globalThis.fetch = original;
    if (originalToken === undefined) delete process.env.BOT_TOKEN;
    else process.env.BOT_TOKEN = originalToken;
    if (originalChatId === undefined) delete process.env.CHAT_ID;
    else process.env.CHAT_ID = originalChatId;
    if (originalRedirect === undefined) delete process.env.REDIRECT_URL;
    else process.env.REDIRECT_URL = originalRedirect;
  });
  const response = await handler.fetch(request({ answers: validAnswers, username: '@tester', referralCode: 'partner_15' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, redirectUrl: 'https://t.me/+ExampleGroupLink' });
});
