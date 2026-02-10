// /api/create-payment.js
import crypto from "crypto";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { email } = req.body || {};
    const cleanEmail = String(email || "").trim();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;
    const planerLink = process.env.PLANER_LINK;
    const priceRub = Number(process.env.PRICE_RUB || 199);

    if (!shopId || !secretKey) {
      return res.status(500).json({ error: "YooKassa credentials are not set" });
    }
    if (!planerLink) {
      return res.status(500).json({ error: "PLANER_LINK is not set" });
    }

    // YooKassa принимает сумму в рублях строкой, но безопаснее передать как "690.00"
    const amountValue = `${priceRub}.00`;

    // Идемпотентность — чтобы при повторном клике не создавалось 10 платежей
    const idempotenceKey = crypto.randomUUID();

    // Куда вернуть пользователя после оплаты (не критично, письмо уйдет по webhook)
    const returnUrl = "https://tvoy-planer.vercel.app/?paid=1";

    const payload = {
      amount: { value: amountValue, currency: "RUB" },
      capture: true,
      confirmation: {
        type: "redirect",
        return_url: returnUrl
      },
      description: `Planer — полный доступ (${priceRub} ₽)`,
      metadata: {
        buyer_email: cleanEmail,
        product: "planer_full_access",
        planer_link: planerLink
      }
    };

    const auth = Buffer.from(`${shopId}:${secretKey}`).toString("base64");

    const ykRes = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
        "Idempotence-Key": idempotenceKey
      },
      body: JSON.stringify(payload)
    });

    const data = await ykRes.json();

    if (!ykRes.ok) {
      return res.status(500).json({
        error: "YooKassa payment create failed",
        details: data
      });
    }

    // confirmation_url — это куда редиректим на оплату
    const confirmationUrl = data?.confirmation?.confirmation_url;
    if (!confirmationUrl) {
      return res.status(500).json({ error: "No confirmation_url from YooKassa" });
    }

    return res.status(200).json({
      confirmation_url: confirmationUrl,
      payment_id: data.id
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error", message: String(e?.message || e) });
  }
}
