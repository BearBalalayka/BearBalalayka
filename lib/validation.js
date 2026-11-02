const questions = require('../public/questions.json');

// Telegram username: латинские буквы, цифры, _, 5–32 символа, начало с буквы.
const usernamePattern = /^@?[a-zA-Z][a-zA-Z0-9_]{4,31}$/;

function validateSubmission(body) {
  const errors = {};
  const answers = {};
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const submittedAnswers = input.answers && typeof input.answers === 'object' && !Array.isArray(input.answers)
    ? input.answers
    : {};

  for (const question of questions) {
    const answer = submittedAnswers[question.id];
    const allowed = (question.options || [
      { value: 'yes', label: 'Да' },
      { value: 'no', label: 'Нет' },
    ]).map(({ value }) => value);

    if (question.type === 'multiple') {
      if (!Array.isArray(answer) || answer.length === 0 ||
          answer.length > allowed.length ||
          !answer.every((value) => typeof value === 'string' && allowed.includes(value)) ||
          new Set(answer).size !== answer.length ||
          (answer.includes('none') && answer.length !== 1)) {
        errors[question.id] = 'Выберите «Нет» или один/несколько проектов.';
      } else {
        answers[question.id] = answer;
      }
    } else if (typeof answer !== 'string' || !allowed.includes(answer)) {
      errors[question.id] = 'Выберите один из вариантов.';
    } else {
      answers[question.id] = answer;
    }
  }

  const rawUsername = typeof input.username === 'string' ? input.username.trim() : '';
  if (!rawUsername) {
    errors.username = 'Укажите ваш Telegram username.';
  } else if (!usernamePattern.test(rawUsername)) {
    errors.username = 'Введите username: @username (5–32 символа, латиница, цифры и _).';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    answers,
    username: rawUsername ? `@${rawUsername.replace(/^@/, '')}` : '',
  };
}

module.exports = { validateSubmission, questions };
