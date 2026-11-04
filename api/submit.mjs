import validation from "../lib/validation.js";

const { validateSubmission, questions } = validation;
const MAX_BODY_BYTES = 12 * 1024;

function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return json({ message: "Метод не поддерживается." }, 405, {
        Allow: "POST",
      });
    }
    if (
      !(request.headers.get("content-type") || "")
        .toLowerCase()
        .includes("application/json")
    ) {
      return json({ message: "Ожидается JSON." }, 415);
    }

    let body;
    try {
      const raw = await request.text();
      if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
        return json({ message: "Слишком большой запрос." }, 413);
      }
      body = JSON.parse(raw);
    } catch {
      return json({ message: "Некорректные данные." }, 400);
    }

    const result = validateSubmission(body);
    if (!result.valid) {
      return json(
        { message: "Заполните все поля.", errors: result.errors },
        400,
      );
    }

    const token = process.env.BOT_TOKEN;
    const chatId = process.env.CHAT_ID;
    const chatId2 = process.env.CHAT_ID2;
    const redirectUrl = process.env.REDIRECT_URL;
    if (
      !token ||
      !chatId ||
      !chatId2 ||
      !/^https:\/\//i.test(redirectUrl || "")
    ) {
      console.error("Missing BOT_TOKEN/CHAT_ID/REDIRECT_URL");
      return json({ message: "Отправка пока не настроена." }, 503);
    }

    function answerLabel(question) {
      const options = question.options || [
        { value: "yes", label: "Да" },
        { value: "no", label: "Нет" },
      ];
      const answer = result.answers[question.id];
      const values = Array.isArray(answer) ? answer : [answer];
      return values
        .map(
          (value) =>
            options.find((item) => item.value === value)?.label || value,
        )
        .join(", ");
    }

    const message = [
      "📩 Новая анкета с сайта",
      "",
      ...questions.flatMap((q, i) => [
        `${i + 1}. ${q.text}`,
        `Ответ: ${answerLabel(q)}`,
        "",
      ]),
      `👤 Telegram: ${result.username}`,
      `🕒 Дата: ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Kyiv" })}`,
    ].join("\n");

    try {
      for (const id of [chatId, chatId2]) {
        const response = await fetch(
          `https://api.telegram.org/bot${token}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: id, text: message }),
            signal: AbortSignal.timeout(8000),
          },
        );

        let data;
        try {
          data = await response.json();
        } catch {
          data = {};
        }

        if (!response.ok || data.ok !== true) {
          console.error(
            "Telegram API error:",
            response.status,
            data.description || "unknown error",
          );
          return json(
            {
              message:
                "Не удалось отправить ответы в Telegram. Попробуйте ещё раз.",
            },
            502,
          );
        }
      }
      return json({ success: true, redirectUrl });
    } catch (error) {
      console.error("Telegram request failed:", error.message);
      return json(
        { message: "Telegram сейчас недоступен. Попробуйте ещё раз." },
        502,
      );
    }
  },
};
