/**
 * תומכי תורה – יצירת דף תשלום PayPlus
 *
 * Cloudflare Worker קטן שמקבל מהאתר את פרטי התרומה, פונה ל-PayPlus
 * עם המפתחות הסודיים (שלא נמצאים בקוד האתר) ומחזיר קישור לדף תשלום
 * שנפתח בתוך האתר (iframe).
 *
 * משתנים שמוגדרים ב-Cloudflare (ראו README.md):
 *   PAYPLUS_API_KEY        – סוד (secret)
 *   PAYPLUS_SECRET_KEY     – סוד (secret)
 *   PAYPLUS_PAGE_UID       – מזהה דף התשלום מהפאנל של PayPlus
 *   PAYPLUS_ENV            – "dev" לסביבת בדיקות, "prod" לחיוב אמיתי
 *   SITE_URL               – כתובת האתר, למשל https://www.tomcheitorah.com
 *   ALLOWED_ORIGINS        – כתובות מורשות מופרדות בפסיק
 */

const API = {
  prod: "https://restapi.payplus.co.il/api/v1.0/PaymentPages/generateLink",
  dev: "https://restapidev.payplus.co.il/api/v1.0/PaymentPages/generateLink",
};

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 100000;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || env.SITE_URL || "")
      .split(",")
      .map((s) => s.trim().replace(/\/$/, ""))
      .filter(Boolean);
    const originOk = allowed.includes(origin);

    const cors = {
      "Access-Control-Allow-Origin": originOk ? origin : allowed[0] || "",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
      });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (!originOk) return json({ error: "origin_not_allowed" }, 403);

    let d;
    try {
      d = await request.json();
    } catch {
      return json({ error: "bad_json" }, 400);
    }

    // ---- בדיקת קלט ----
    const str = (v, max = 120) => String(v ?? "").trim().slice(0, max);
    const amount = Math.round(Number(d.amount));
    const name = str(d.name);
    const phone = str(d.phone, 20).replace(/[^\d+]/g, "");
    const email = str(d.email, 120);
    const dedication = str(d.dedication, 200);
    const receiptType = d.receipt_type === "business" ? "business" : "individual";
    const receiptName = str(d.receipt_name) || name;
    const receiptId = str(d.receipt_id, 9).replace(/\D/g, "");

    if (!Number.isFinite(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT)
      return json({ error: "bad_amount" }, 400);
    if (!name) return json({ error: "missing_name" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "bad_email" }, 400);
    if (receiptType === "business" && receiptId.length !== 9)
      return json({ error: "bad_receipt_id" }, 400);

    // ---- בניית הבקשה ל-PayPlus ----
    const site = (env.SITE_URL || "").replace(/\/$/, "");
    const back = new URLSearchParams({ amount: String(amount) });
    if (dedication) back.set("dedication", dedication);

    const customer = {
      customer_name: receiptName,
      email,
    };
    if (phone) customer.phone = phone;
    if (receiptId) customer.vat_number = receiptId;

    const body = {
      payment_page_uid: env.PAYPLUS_PAGE_UID,
      amount,
      currency_code: "ILS",
      language_code: "he",
      sendEmailApproval: true,
      sendEmailFailure: false,
      customer,
      more_info: dedication || "-",
      more_info_2: receiptType,
      more_info_3: name,
      refURL_success: `${site}/success.html?${back}`,
      refURL_failure: `${site}/donate.html?payment=failed&amount=${amount}`,
      refURL_cancel: `${site}/donate.html?amount=${amount}`,
      expiry_datetime: "30",
    };

    const endpoint = env.PAYPLUS_ENV === "prod" ? API.prod : API.dev;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": env.PAYPLUS_API_KEY,
          "secret-key": env.PAYPLUS_SECRET_KEY,
        },
        body: JSON.stringify(body),
      });
      const out = await res.json().catch(() => ({}));
      const link = out?.data?.payment_page_link;
      if (!res.ok || !link) {
        console.log("PayPlus error", res.status, JSON.stringify(out));
        return json({ error: "payplus_error" }, 502);
      }
      return json({ link });
    } catch (e) {
      console.log("PayPlus fetch failed", String(e));
      return json({ error: "payplus_unreachable" }, 502);
    }
  },
};
