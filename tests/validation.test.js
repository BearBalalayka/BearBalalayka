const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSubmission, questions } = require('../lib/validation');
const validAnswers = { q1: 'yes', q2: 'no', q3: 'yes', q4: 'profit', q5: ['eos', 'xrp'], q6: 'no' };

test('принимает 3-й вариант вопроса 4 и несколько проектов вопроса 5', () => {
  const result = validateSubmission({ answers: validAnswers, username: ' @Test_User ' });
  assert.equal(result.valid, true);
  assert.equal(result.username, '@Test_User');
  assert.equal(result.answers.q4, 'profit');
  assert.deepEqual(result.answers.q5, ['eos', 'xrp']);
});

test('принимает один ответ «Нет» для вопроса 5', () => {
  const result = validateSubmission({ answers: { ...validAnswers, q5: ['none'] }, username: '@tester' });
  assert.equal(result.valid, true);
});

test('требует ответ на каждый вопрос', () => {
  const result = validateSubmission({ answers: { q1: 'yes' }, username: '@username' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.q5);
});

test('пустой username запрещён', () => {
  const result = validateSubmission({ answers: validAnswers, username: ' ' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.username);
});

test('отклоняет несуществующий вариант вопроса 4 и короткий username', () => {
  const result = validateSubmission({ answers: { ...validAnswers, q4: 'maybe' }, username: 'abc' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.q4);
  assert.ok(result.errors.username);
});

test('отклоняет «Нет» вместе с названиями проектов', () => {
  const result = validateSubmission({ answers: { ...validAnswers, q5: ['none', 'bnb'] }, username: '@tester' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.q5);
});

test('отклоняет неподдерживаемые, повторяющиеся и пустые варианты', () => {
  for (const q5 of [[], ['scam'], ['eos', 'eos'], 'eos', [100]]) {
    const result = validateSubmission({ answers: { ...validAnswers, q5 }, username: '@tester' });
    assert.equal(result.valid, false, JSON.stringify(q5));
    assert.ok(result.errors.q5);
  }
});

test('список вопросов содержит опции для q4/q5', () => {
  assert.equal(questions[3].options.length, 3);
  assert.equal(questions[4].options.length, 6);
});

test('корректно обрабатывает некорректные данные', () => {
  assert.equal(validateSubmission(null).valid, false);
  assert.equal(validateSubmission({ answers: ['yes'], username: {} }).valid, false);
});


test('требует ответ на новый вопрос 6', () => {
  const { q6, ...answers } = validAnswers;
  const result = validateSubmission({ answers, username: '@tester' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.q6);
});


test('сохраняет идентификатор партнёра из ссылки', () => {
  const result = validateSubmission({ answers: validAnswers, username: '@tester', referralCode: 'partner_15' });
  assert.equal(result.valid, true);
  assert.equal(result.referralCode, 'partner_15');
});

test('пустая или некорректная метка источника не ломает анкету', () => {
  for (const referralCode of ['', '<script>', 'very-long-partner-name-that-exceeds-the-forty-eight-character-limit']) {
    const result = validateSubmission({ answers: validAnswers, username: '@tester', referralCode });
    assert.equal(result.valid, true);
    assert.equal(result.referralCode, '');
  }
});
