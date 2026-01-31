import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { to } = req.body || {};
    if (!to || !String(to).includes("@")) {
      return res.status(400).json({ ok: false, error: "Provide { to: email }" });
    }

    const SMTP_HOST = process.env.SMTP_HOST;
    const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
    const SMTP_USER = process.env.SMTP_USER;
    const SMTP_PASS = process.env.SMTP_PASS;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      return res.status(500).json({ ok: false, error: "Missing SMTP env vars" });
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // 465 true, 587 false
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    const planerLink = "https://planer-eight.vercel.app/";
    const text =
`Ваша ссылка на Planer:
${planerLink}

Пожалуйста, сохраните её:
• добавьте на экран «Домой» на телефоне
• закрепите вкладку в браузере, чтобы Planer всегда был рядом

Спасибо 💖`;

    const info = await transporter.sendMail({
      from: `Planer <${SMTP_USER}>`,
      to,
      subject: "Тест: письмо Planer ✅",
      text,
    });

    console.log("TEST EMAIL SENT:", info.messageId, "to:", to);
    return res.status(200).json({ ok: true, messageId: info.messageId });
  } catch (err) {
    console.error("TEST EMAIL ERROR:", err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
