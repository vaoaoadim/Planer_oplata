// /api/yookassa-webhook.js
import nodemailer from "nodemailer";

function buildEmailHtml(planerLink) {
  // Твой текст, красиво пунктами
  return `
    <div style="font-family:Arial, sans-serif; font-size:16px; line-height:1.55;">
      <p><b>Доброго времени суток! Забирайте Planer:</b></p>
      <p style="margin:10px 0;">
        <a href="${planerLink}" style="color:#0b57d0; text-decoration:underline;">${planerLink}</a>
      </p>

      <p><b>Сохраните и сделайте доступ удобным:</b></p>
      <ul style="margin:8px 0 14px; padding-left:18px;">
        <li>добавьте на экран «Домой» на телефоне</li>
        <li>закрепите вкладку в браузере</li>
      </ul>

      <p>Желаем Вам успехов на пути к мечте! Спасибо, что выбрали нас 💖</p>
    </div>
  `;
}

async function sendMail({ to, planerLink }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM || user;

  if (!host || !user || !pass) {
    throw new Error("SMTP env vars are not set (SMTP_HOST/SMTP_USER/SMTP_PASS)");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = SSL
    auth: { user, pass }
  });

  const subject = "Ваша ссылка на Planer ✅";
  const html = buildEmailHtml(planerLink);

  await transporter.sendMail({
    from,
    to,
    subject,
    html
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;
    if (!shopId || !secretKey) {
      return res.status(500).send("YooKassa credentials are not set");
    }

    const event = req.body;

    // YooKassa webhook формат: { type, event, object: { ...payment... } }
    const paymentObject = event?.object;

    // Нас интересует только "платеж успешен"
    // (В YooKassa часто event = "payment.succeeded")
    const eventName = event?.event;
    if (eventName !== "payment.succeeded") {
      // Отвечаем 200, чтобы YooKassa не долбила повторно
      return res.status(200).send("Ignored");
    }

    const paymentId = paymentObject?.id;
    if (!paymentId) {
      return res.status(200).send("No payment id");
    }

    // Перепроверяем платеж в YooKassa (очень важно)
    const auth = Buffer.from(`${shopId}:${secretKey}`).toString("base64");

    const verifyRes = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json"
      }
    });

    const payment = await verifyRes.json();

    if (!verifyRes.ok) {
      return res.status(500).send("Verify failed");
    }

    // Проверяем, что платеж реально оплачен
    const isSucceeded = payment?.status === "succeeded";
    const isPaid = payment?.paid === true;

    if (!isSucceeded || !isPaid) {
      return res.status(200).send("Not paid");
    }

    // Достаём email из metadata, которое мы сами положили при create-payment
    const buyerEmail = (payment?.metadata?.buyer_email || "").trim();
    const planerLink = (payment?.metadata?.planer_link || process.env.PLANER_LINK || "").trim();

    if (!buyerEmail || !buyerEmail.includes("@")) {
      // Если почему-то email не пришёл — всё равно не ломаем webhook
      return res.status(200).send("No buyer email in metadata");
    }
    if (!planerLink) {
      return res.status(200).send("No planer link");
    }

    // Отправляем письмо
    await sendMail({ to: buyerEmail, planerLink });

    return res.status(200).send("OK");
  } catch (e) {
    // Важно: если вернёшь 500, YooKassa будет ретраить webhook.
    // Но если SMTP временно упал — это даже хорошо.
    return res.status(500).send(`Error: ${String(e?.message || e)}`);
  }
}
