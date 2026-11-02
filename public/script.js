const form = document.querySelector('#surveyForm');
const questionsContainer = document.querySelector('#questions');
const usernameInput = document.querySelector('#username');
const usernameError = document.querySelector('#usernameError');
const submitButton = document.querySelector('#submitButton');
const submitText = document.querySelector('#submitText');
const formStatus = document.querySelector('#formStatus');
const progressText = document.querySelector('#progressText');
const progressBar = document.querySelector('#progressBar');
const progressFill = document.querySelector('#progressFill');
let questions = [];
let isSending = false;

// Персональные ссылки вида https://example.com/?ref=ivan
// Метка сохраняется в рамках вкладки до отправки анкеты.
const referralPattern = /^[a-zA-Z0-9_-]{1,48}$/;
const referralStorageKey = 'survey_referral_code';

function getReferralCode() {
  const urlValue = new URLSearchParams(window.location.search).get('ref');
  const fromUrl = urlValue && referralPattern.test(urlValue) ? urlValue : '';
  try {
    if (fromUrl) window.sessionStorage.setItem(referralStorageKey, fromUrl);
    const stored = window.sessionStorage.getItem(referralStorageKey) || '';
    return fromUrl || (referralPattern.test(stored) ? stored : '');
  } catch {
    // При заблокированном sessionStorage метка из ссылки всё равно работает.
    return fromUrl || '';
  }
}
const referralCode = getReferralCode();

const usernameRegex = /^@?[a-zA-Z][a-zA-Z0-9_]{4,31}$/;

function createQuestion(question, index) {
  const card = document.createElement('div');
  card.className = 'question-card';
  card.dataset.questionId = question.id;

  const heading = document.createElement('div');
  heading.className = 'question-heading';
  heading.id = `${question.id}-label`;
  const number = document.createElement('span');
  number.className = 'question-number';
  number.textContent = String(index + 1).padStart(2, '0');
  const headingText = document.createElement('span');
  headingText.textContent = question.text;
  heading.append(number, headingText);

  const isMultiple = question.type === 'multiple';
  const row = document.createElement('div');
  row.className = 'radio-row';
  row.setAttribute('role', isMultiple ? 'group' : 'radiogroup');
  row.setAttribute('aria-labelledby', heading.id);
  row.setAttribute('aria-describedby', `${question.id}-error`);

  const options = question.options || [
    { value: 'yes', label: 'Да' },
    { value: 'no', label: 'Нет' },
  ];

  for (const { value, label } of options) {
    const option = document.createElement('label');
    option.className = 'radio-option';
    const input = document.createElement('input');
    input.type = isMultiple ? 'checkbox' : 'radio';
    input.name = question.id;
    input.value = value;
    const text = document.createElement('span');
    text.textContent = label;
    option.append(input, text);
    row.append(option);
  }

  const error = document.createElement('p');
  error.className = 'error-text';
  error.id = `${question.id}-error`;
  error.setAttribute('aria-live', 'polite');
  card.append(heading, row, error);
  return card;
}

function updateProgress() {
  const completed = questions.filter((question) => form.querySelector(`input[name="${question.id}"]:checked`)).length;
  progressText.textContent = `${completed} из ${questions.length}`;
  progressBar.setAttribute('aria-valuenow', String(completed));
  progressBar.setAttribute('aria-valuemax', String(questions.length));
  progressFill.style.width = `${questions.length ? completed / questions.length * 100 : 0}%`;
}

function setQuestionError(id, message) {
  const card = questionsContainer.querySelector(`[data-question-id="${id}"]`);
  if (!card) return;
  card.classList.toggle('has-error', Boolean(message));
  card.querySelector('.error-text').textContent = message;
  card.querySelector('.radio-row').setAttribute('aria-invalid', String(Boolean(message)));
}

function setUsernameError(message) {
  usernameError.textContent = message;
  usernameInput.closest('.input-shell').classList.toggle('has-error', Boolean(message));
  usernameInput.setAttribute('aria-invalid', String(Boolean(message)));
}

function validateForm() {
  let firstInvalid = null;
  const answers = {};
  for (const question of questions) {
    const checked = [...form.querySelectorAll(`input[name="${question.id}"]:checked`)];
    if (!checked.length) {
      setQuestionError(question.id, 'Выберите хотя бы один вариант ответа.');
      firstInvalid ||= form.querySelector(`input[name="${question.id}"]`);
    } else {
      answers[question.id] = question.type === 'multiple'
        ? checked.map((input) => input.value)
        : checked[0].value;
      setQuestionError(question.id, '');
    }
  }

  const username = usernameInput.value.trim();
  if (!username) {
    setUsernameError('Введите ваш Telegram username.');
    firstInvalid ||= usernameInput;
  } else if (!usernameRegex.test(username)) {
    setUsernameError('Введите корректный username (пример: @myname123).');
    firstInvalid ||= usernameInput;
  } else {
    setUsernameError('');
  }

  if (firstInvalid) {
    firstInvalid.focus();
    return null;
  }
  return { answers, username, referralCode };
}

questionsContainer.addEventListener('change', (event) => {
  const input = event.target;
  if (!input.matches('input[type="radio"], input[type="checkbox"]')) return;

  // «Нет» в 5-м вопросе несовместимо с выбором конкретных проектов.
  if (input.type === 'checkbox' && input.checked) {
    const group = [...questionsContainer.querySelectorAll(`input[name="${input.name}"]`)];
    if (input.value === 'none') {
      group.filter((item) => item !== input).forEach((item) => { item.checked = false; });
    } else {
      const none = group.find((item) => item.value === 'none');
      if (none) none.checked = false;
    }
  }
  setQuestionError(input.name, '');
  formStatus.textContent = '';
  updateProgress();
});

usernameInput.addEventListener('input', () => {
  setUsernameError('');
  formStatus.textContent = '';
});

async function init() {
  try {
    const response = await fetch('/questions.json');
    if (!response.ok) throw new Error('Failed to fetch questions');
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('Expected at least one question');
    questions = data;
    questionsContainer.replaceChildren(...questions.map(createQuestion));
    document.querySelector('.username-title .question-number').textContent = String(questions.length + 1).padStart(2, '0');
    submitButton.disabled = false;
    updateProgress();
  } catch {
    questionsContainer.textContent = 'Не удалось загрузить вопросы. Обновите страницу.';
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (isSending) return;
  if (questions.length === 0) {
    formStatus.textContent = 'Вопросы пока не загрузились. Обновите страницу.';
    return;
  }
  formStatus.textContent = '';
  formStatus.classList.remove('success');

  const payload = validateForm();
  if (!payload) {
    formStatus.textContent = 'Заполните все вопросы и укажите Telegram username.';
    return;
  }

  isSending = true;
  submitButton.disabled = true;
  submitText.textContent = 'Отправляем…';
  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => {
      throw new Error('Сервер вернул некорректный ответ. Проверьте запуск API.');
    });
    if (!response.ok || !data.success) {
      if (data.errors) {
        for (const question of questions) setQuestionError(question.id, data.errors[question.id] || '');
        setUsernameError(data.errors.username || '');
      }
      throw new Error(data.message || 'Не удалось отправить анкету.');
    }
    formStatus.textContent = 'Анкета отправлена! Перенаправляем вас на сайт…';
    formStatus.classList.add('success');
    // Переходим ТОЛЬКО когда Telegram подтвердил доставку сообщения боту.
    window.location.assign(data.redirectUrl);
  } catch (error) {
    formStatus.textContent = error.message || 'Ошибка соединения. Попробуйте снова.';
    submitButton.disabled = false;
    submitText.textContent = 'Отправить анкету';
    isSending = false;
  }
});

init();
