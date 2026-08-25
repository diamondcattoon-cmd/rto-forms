/**
 * rtoformsindia.com — PRO Feature Worker v2
 * Real ₹ wallet + Razorpay auto-payment + Gemini Vision extraction
 *
 * Requires (Worker → Settings → Variables and Secrets):
 *   GEMINI_API_KEY        (Secret)  — from aistudio.google.com/apikey
 *   RAZORPAY_KEY_ID       (Text)    — from Razorpay dashboard, e.g. rzp_test_xxxx
 *   RAZORPAY_KEY_SECRET   (Secret)  — from Razorpay dashboard
 *
 * Requires (Worker → Settings → Bindings → KV Namespace):
 *   WALLET   — bind to a KV namespace (create one called "rto-wallets")
 */

const ALLOWED_ORIGIN = "https://rtoformsindia.com";
const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_URL = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

const COST_PAISE = 500; // ₹5.00 per extraction — change here if you revise pricing

const PROMPTS = {
  aadhaar: `You are extracting fields from an Indian Aadhaar card. You may receive one or two images (front side and back side of the same card) — combine information from both if two are given.
Return ONLY valid JSON, no markdown, no explanation, in this exact shape:
{
  "name": "",
  "aadhaar_number": "",
  "dob": "",
  "gender": "",
  "address_line": "",
  "town": "",
  "district": "",
  "state": "",
  "pincode": "",
  "father_or_husband_name": ""
}
Rules:
- aadhaar_number: return the FULL 12-digit number exactly as printed, NOT masked, no spaces (digits only).
- dob: format DD/MM/YYYY. If only year of birth is printed, return "01/01/YYYY".
- The address is usually printed as one block (usually on the back side) — split it into its parts:
  - address_line: house/door number, street, locality, landmark (everything except town, district, state, pincode)
  - town: city / town / village name
  - district: district name (often after "Dist." or "Distt.")
  - state: state name
  - pincode: 6-digit PIN code
- If you cannot clearly separate a part, put the remaining text in address_line and leave that part empty — never guess.
- If a field is not visible/legible in any image provided, return empty string "" for it — never guess.`,

  pan: `You are extracting fields from an Indian PAN card image.
Return ONLY valid JSON, no markdown, no explanation, in this exact shape:
{
  "name": "",
  "pan_number": "",
  "father_name": "",
  "dob": ""
}
Rules:
- pan_number: exactly 10 characters as printed (5 letters, 4 digits, 1 letter), uppercase.
- dob: format DD/MM/YYYY.
- If a field is not visible/legible, return empty string "" for it — never guess.`,

  rc: `You are extracting fields from an Indian Vehicle Registration Certificate (RC) image.
Return ONLY valid JSON, no markdown, no explanation, in this exact shape:
{
  "owner_name": "",
  "registration_number": "",
  "chassis_number": "",
  "engine_number": "",
  "vehicle_class": "",
  "maker": "",
  "model": "",
  "colour": "",
  "rto_office": "",
  "registration_date": "",
  "expiry_date": "",
  "registered_as": "",
  "body_type": "",
  "cylinders": "",
  "cubic_capacity": "",
  "seating_capacity": "",
  "standing_capacity": "",
  "sleeper_capacity": "",
  "unladen_weight": "",
  "fuel_type": "",
  "address_line": "",
  "town": "",
  "district": "",
  "state": "",
  "pincode": ""
}
Rules:
- maker: the manufacturer only, e.g. "Maruti Suzuki", "Honda", "Tata Motors" — NOT the model name.
- model: the model name/variant only, e.g. "Swift VXi", "Activa 6G" — NOT the manufacturer name.
- registration_date, expiry_date: format DD/MM/YYYY. expiry_date is usually labelled "Regd Validity" or "Valid Upto".
- registered_as: e.g. "New", "Ex-Army", "Imported" (often left blank on the card — leave empty if not printed).
- body_type: e.g. "Saloon", "Sedan", "Hatchback", "SUV", "Motor Cycle".
- cylinders, seating_capacity, standing_capacity, sleeper_capacity: plain numbers only, no units.
- unladen_weight: number only, in kg, no units.
- cubic_capacity: as printed, e.g. "1197 cc" — keep the unit here.
- fuel_type: e.g. "Petrol", "Diesel", "CNG", "Electric".
- rto_office: the issuing RTO/DTO office name if printed.
- Split the owner's address into parts:
  - address_line: house/door number, street, locality, landmark
  - town: city / town / village name
  - district: district name
  - state: state name
  - pincode: 6-digit PIN code
- If you cannot clearly separate a part, put the remaining text in address_line and leave that part empty — never guess.
- If a field is not visible/legible, return empty string "" for it — never guess.`,
};

function cors() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors() },
  });
}

/* ── Wallet helpers (Cloudflare KV) ── */
async function getBalance(env, walletId) {
  const v = await env.WALLET.get("bal:" + walletId);
  return v ? parseInt(v, 10) : 0;
}
async function setBalance(env, walletId, paise) {
  await env.WALLET.put("bal:" + walletId, String(paise));
}

/* ── Razorpay signature verification (HMAC SHA-256) ── */
async function verifySignature(orderId, paymentId, signature, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(orderId + "|" + paymentId));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === signature;
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (err) {
      /* Without this catch, an unexpected crash returns Cloudflare's default error page
         with NO CORS headers — the browser then reports a generic "Failed to fetch"
         instead of the real error. This guarantees a proper JSON response either way. */
      return json({ error: "Unexpected server error", detail: String(err && err.stack || err) }, 500);
    }
  },
};

async function handleRequest(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { headers: cors() });

    /* GET /balance?walletId=xxx */
    if (request.method === "GET" && url.pathname === "/balance") {
      const walletId = url.searchParams.get("walletId");
      if (!walletId) return json({ error: "walletId required" }, 400);
      const paise = await getBalance(env, walletId);
      return json({ walletId, balancePaise: paise, balanceRs: (paise / 100).toFixed(2) });
    }

    /* POST /order  { walletId, amountRs } → creates a Razorpay order */
    if (request.method === "POST" && url.pathname === "/order") {
      const body = await request.json().catch(() => null);
      if (!body || !body.walletId || !body.amountRs) return json({ error: "walletId and amountRs required" }, 400);
      const amountPaise = Math.round(Number(body.amountRs) * 100);
      if (!amountPaise || amountPaise < 100) return json({ error: "Minimum recharge is ₹1" }, 400);

      const auth = "Basic " + btoa(env.RAZORPAY_KEY_ID + ":" + env.RAZORPAY_KEY_SECRET);
      const rpRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth },
        body: JSON.stringify({
          amount: amountPaise,
          currency: "INR",
          receipt: body.walletId + "-" + Date.now(),
          notes: { walletId: body.walletId },
        }),
      });
      if (!rpRes.ok) {
        const t = await rpRes.text();
        return json({ error: "Razorpay order failed", detail: t }, 502);
      }
      const order = await rpRes.json();
      return json({ orderId: order.id, amountPaise, keyId: env.RAZORPAY_KEY_ID });
    }

    /* POST /verify  { walletId, razorpay_order_id, razorpay_payment_id, razorpay_signature } */
    if (request.method === "POST" && url.pathname === "/verify") {
      const body = await request.json().catch(() => null);
      if (!body) return json({ error: "Invalid body" }, 400);
      const { walletId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
      if (!walletId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return json({ error: "Missing verification fields" }, 400);
      }
      const valid = await verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, env.RAZORPAY_KEY_SECRET);
      if (!valid) return json({ error: "Signature verification failed" }, 400);

      /* Prevent double-crediting the same payment */
      const dedupeKey = "paid:" + razorpay_payment_id;
      const already = await env.WALLET.get(dedupeKey);
      if (already) {
        const paise = await getBalance(env, walletId);
        return json({ ok: true, alreadyCredited: true, balancePaise: paise, balanceRs: (paise / 100).toFixed(2) });
      }

      /* Fetch the order from Razorpay to get the exact paid amount (never trust client-sent amount) */
      const auth = "Basic " + btoa(env.RAZORPAY_KEY_ID + ":" + env.RAZORPAY_KEY_SECRET);
      const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, { headers: { Authorization: auth } });
      if (!orderRes.ok) return json({ error: "Could not confirm order with Razorpay" }, 502);
      const order = await orderRes.json();

      const current = await getBalance(env, walletId);
      const updated = current + order.amount; // order.amount is in paise
      await setBalance(env, walletId, updated);
      await env.WALLET.put(dedupeKey, "1");

      return json({ ok: true, credited: order.amount, balancePaise: updated, balanceRs: (updated / 100).toFixed(2) });
    }

    /* POST /extract  { walletId, docType, images:[{data,mimeType}, ...] } → deducts ₹5, calls Gemini */
    if (request.method === "POST" && url.pathname === "/extract") {
      if (!env.GEMINI_API_KEY) return json({ error: "Server not configured (missing API key)" }, 500);

      const body = await request.json().catch(() => null);
      if (!body) return json({ error: "Invalid JSON body" }, 400);
      const { walletId, docType, images } = body;

      if (!walletId) return json({ error: "walletId required" }, 400);
      if (!docType || !PROMPTS[docType]) return json({ error: "docType must be one of: aadhaar, pan, rc" }, 400);
      if (!Array.isArray(images) || images.length === 0) return json({ error: "images array required (1-2 items)" }, 400);
      if (images.length > 2) return json({ error: "Maximum 2 images per document" }, 400);

      const balance = await getBalance(env, walletId);
      if (balance < COST_PAISE) {
        return json({ error: "Insufficient balance", balancePaise: balance, balanceRs: (balance / 100).toFixed(2), required: COST_PAISE }, 402);
      }

      const parts = [{ text: PROMPTS[docType] }];
      for (const img of images) {
        if (!img.data) return json({ error: "Each image needs a data field" }, 400);
        const cleanBase64 = img.data.includes(",") ? img.data.split(",")[1] : img.data;
        parts.push({ inline_data: { mime_type: img.mimeType || "image/jpeg", data: cleanBase64 } });
      }
      const geminiBody = {
        contents: [{ parts }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      };

      let geminiRes;
      try {
        geminiRes = await fetch(GEMINI_URL(env.GEMINI_API_KEY), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiBody),
        });
      } catch (err) {
        return json({ error: "Gemini request failed", detail: String(err) }, 502);
      }
      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        return json({ error: "Gemini API error", detail: errText }, 502);
      }

      let geminiData;
      try {
        geminiData = await geminiRes.json();
      } catch (err) {
        return json({ error: "Could not parse Gemini response", detail: String(err) }, 502);
      }
      let extractedText;
      try {
        extractedText = geminiData.candidates[0].content.parts[0].text;
      } catch {
        return json({ error: "Unexpected Gemini response shape", raw: geminiData }, 502);
      }

      let extractedJson;
      try {
        extractedJson = JSON.parse(extractedText);
      } catch {
        return json({ error: "Gemini did not return valid JSON", raw: extractedText }, 502);
      }

      /* Deduct only after a successful extraction */
      const newBalance = balance - COST_PAISE;
      await setBalance(env, walletId, newBalance);

      return json({ docType, data: extractedJson, balancePaise: newBalance, balanceRs: (newBalance / 100).toFixed(2) });
    }

    return json({ error: "Not found" }, 404);
}
