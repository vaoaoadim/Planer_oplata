import nodemailer from "nodemailer";

export default async function handler(req, res) {
  // =========================
  // CORS (чтобы fetch из лендинга работал)
  // =========================
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://tvoy-planer.vercel.app"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  // Ответ на preflight-запрос браузера
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Разрешаем только POST
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  // =========================
  // Проверка входных данных
  // =========================
  const { to } = req.body || {};

  if (!to) {
    return res.status(400).json({
      ok: false,
      error: "Email is required",
    });
  }

  // =========================
  // SMTP-транспорт (reg.ru)
  // =========================
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465, // true для 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // =========================
  // Тестовое письмо
  // =========================
  try {
    const info = await transporter.sendMail({
      from: `"Planer" <${process.env.SMTP_USER}>`,
      to,
      subject: "Тест: письмо Planer ✅",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Проверка отправки писем</h2>

          <p>Это тестовое письмо от Planer.</p>

          <p><b>Ваша ссылка на Planer:</b></p>
          <p>
            <a href="https://planer-eight.vercel.app/" target="_blank">
              https://planer-eight.vercel.app/
            </a>
          </p>

          <p>Рекомендуем:</p>
          <ul>
            <li>добавить Planer на экран «Домой» на телефоне</li>
            <li>закрепить вкладку в браузере</li>
          </ul>

          <p>Спасибо 💖</p>
        </div>
      `,
    });

    return res.status(200).json({
      ok: true,
      messageId: info.messageId,
    });
  } catch (error) {
    console.error("Email send error:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to send email",
    });
  }
}
