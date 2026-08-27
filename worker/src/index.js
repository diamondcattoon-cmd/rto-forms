/**
 * rtoformsindia.com — PRO Feature Worker v2
 * Real ₹ wallet + Razorpay auto-payment + Gemini Vision extraction
 *
 * Wallet identity is a server-minted random token (walletId) — NOT a mobile
 * number. It's created the first time someone pays (see /order), held only
 * in the paying browser's localStorage, and used directly as the bearer
 * credential for /balance and /extract (no separate "session" layer — the
 * token IS the secret, same as an API key). This is deliberate: a mobile
 * number is guessable/typeable, so using it as the wallet identity (the
 * very first version of this Worker did) let anyone spend anyone else's
 * balance. A 256-bit random token has no such weakness regardless of who
 * generates it.
 *
 * A mobile number is still collected — Razorpay's own checkout UI asks for
 * it during payment (see /verify) — but only ever as a RECOVERY contact
 * (recoverycontact:<walletId> / recoverylookup:<mobile>), never as the
 * identity itself. If a user loses their token (cleared storage, new
 * device), /link/send + /link/claim/<token> lets them recover access via
 * that number: it mints a brand-new walletId, transfers the balance across,
 * and immediately invalidates the old one (so a lost/leaked old token can't
 * still be used after a recovery).
 *
 * Recovery-link token properties (KV-enforced, see /link/send and /link/claim):
 *   - 30-minute expiry (CLAIM_TTL_SECONDS, via KV expirationTtl)
 *   - single-use — the claim record is deleted the instant it's claimed
 *   - issuing a new link for the same mobile immediately supersedes the
 *     previous one (latestclaim:<mobile>), even if its 30 min hasn't elapsed
 *   - the token lives in the URL PATH (/w/<token>), never a query string —
 *     query params leak into browser history and Referer headers, path
 *     segments don't get forwarded the same way
 *
 * /order and /verify are NOT gated by an existing token — /order will mint
 * a brand-new walletId if the caller doesn't have one yet (first payment),
 * or credit an existing one if they do. Recharging a stranger's walletId
 * only costs the sender their own money and benefits the wallet owner, so
 * accepting a client-supplied walletId there isn't an exploit.
 *
 * Requires (Worker → Settings → Variables and Secrets):
 *   GEMINI_API_KEY         (Secret)  — from aistudio.google.com/apikey
 *   RAZORPAY_KEY_ID        (Text)    — from Razorpay dashboard, e.g. rzp_test_xxxx
 *   RAZORPAY_KEY_SECRET    (Secret)  — from Razorpay dashboard
 *   MSG91_AUTH_KEY         (Secret)  — from MSG91 dashboard → API keys
 *   MSG91_LINK_TEMPLATE_ID (Text)    — DLT-approved SMS template ID from MSG91
 *                                      with a URL/link variable
 *                                      (India requires DLT registration for
 *                                      transactional SMS — do this first)
 *
 * Requires (Worker → Settings → Bindings → KV Namespace):
 *   WALLET   — bind to a KV namespace (create one called "rto-wallets")
 *
 * NOTE: the exact MSG91 Flow API / Razorpay Payments API request/response
 * shapes below match their docs as of when this was written — re-check
 * control.msg91.com/api and razorpay.com/docs/api/payments before relying
 * on them, the same way JH_RATES in index.html is flagged as needing
 * verification.
 */

const ALLOWED_ORIGIN = "https://rtoformsindia.com";
const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_URL = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

const COST_PAISE = 500; // ₹5.00 per extraction — change here if you revise pricing

const LINK_RESEND_COOLDOWN_SECONDS = 60; // block repeat /link/send for the same mobile
const CLAIM_TTL_SECONDS = 30 * 60; // recovery link validity — 30 minutes

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
  "owner_type": "",
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
- owner_type: "individual" or "firm". The owner_name is a "firm" if it carries a business/organization marker — e.g. it starts with "M/S" or "M/s.", or contains "Pvt Ltd", "Private Limited", "LLP", "& Sons", "& Co", "& Company", "Enterprises", "Industries", "Trust", or "Society". An ordinary person's name (with or without a title like Shri/Smt/Kumari) is "individual". If you are unsure, default to "individual" — never guess "firm".
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

/* ── Identity / recovery helpers ── */
function normalizeMobile(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  /* Razorpay's payment.contact (see fetchPaymentContact) typically comes back
     with the +91 country code, e.g. "+919876543210" — strip it so this
     matches the same bare-10-digit form used everywhere else (mobile typed
     into /link/send, mobile typed into the old wallet-setup field, etc). */
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null; // 10-digit Indian mobile
}
function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* Razorpay's order `receipt` field must be <=40 characters and unique per
   order (docs: "Can have a maximum length of 40 characters and has to be
   unique"). walletId alone is already 64 hex characters (randomToken()),
   so using it raw — as this used to do — made every single order-creation
   call get rejected by Razorpay's API. Truncate the wallet id to a short,
   still-effectively-unique prefix and pair it with a millisecond timestamp
   (base36, to stay compact) — two different orders for the same wallet
   can't land on the same millisecond in practice (the browser round-trip
   to /order alone takes longer than that), and two different wallets
   colliding on both the truncated id AND the same millisecond is not a
   realistic concern for a receipt field that's just an internal reference,
   not a security-relevant identifier (the full walletId is still recorded
   in `notes`, verified in the frontend, and looked up during /verify). */
export function buildReceipt(walletId) {
  return String(walletId).slice(0, 20) + "-" + Date.now().toString(36);
}

/* ── MSG91 — plain SMS send (Flow API) carrying a DLT-approved template with
   a link variable. We generate/store/expire/single-use the claim token
   ourselves; MSG91's job here is only to deliver the SMS. ── */
async function msg91SendLink(env, mobile, link) {
  const res = await fetch("https://control.msg91.com/api/v5/flow/", {
    method: "POST",
    headers: { "Content-Type": "application/json", authkey: env.MSG91_AUTH_KEY },
    body: JSON.stringify({
      template_id: env.MSG91_LINK_TEMPLATE_ID,
      recipients: [{ mobiles: "91" + mobile, LINK: link }],
    }),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok && data && (data.type === "success" || data.status === "success"), detail: data };
}

/* Best-effort: look up the contact number Razorpay collected during
   checkout for a payment, so it can be stored as a recovery contact. Never
   throws — a failure here shouldn't undo an already-successful payment. */
async function fetchPaymentContact(env, paymentId, auth) {
  try {
    const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, { headers: { Authorization: auth } });
    if (!res.ok) return null;
    const payment = await res.json();
    return normalizeMobile(payment.contact);
  } catch {
    return null;
  }
}

/* Constant-time string comparison — a plain `a === b` short-circuits on the
   first differing character, which leaks (via response timing) how many
   leading characters of a guessed signature were correct. Cloudflare
   Workers has no Node `crypto.timingSafeEqual`, so this XOR-accumulate
   loop is the portable equivalent: every character gets compared no
   matter what, so the time taken depends only on the (public) length, not
   on where the mismatch is. Mismatched length is checked separately and
   is safe to return early on — it isn't secret-dependent. */
export function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
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
  return constantTimeEqual(hex, String(signature));
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

    /* POST /link/send  { mobile } → SMS a one-time recovery link for the
       wallet already linked to this mobile (via a past payment). */
    if (request.method === "POST" && url.pathname === "/link/send") {
      if (!env.MSG91_AUTH_KEY || !env.MSG91_LINK_TEMPLATE_ID) return json({ error: "Server not configured (missing MSG91 credentials)" }, 500);

      const body = await request.json().catch(() => null);
      const mobile = normalizeMobile(body && body.mobile);
      if (!mobile) return json({ error: "Valid 10-digit mobile number required" }, 400);

      const existingWalletId = await env.WALLET.get("recoverylookup:" + mobile);
      if (!existingWalletId) {
        return json({ error: "Is number se koi wallet linked nahi mila — pehle ek baar payment karo, tabhi recovery kaam karegi.", code: "NO_WALLET_FOUND" }, 404);
      }

      const cooldownKey = "linkcooldown:" + mobile;
      if (await env.WALLET.get(cooldownKey)) {
        return json({ error: "Link already sent — please wait before requesting another one", code: "LINK_COOLDOWN" }, 429);
      }

      const claimToken = randomToken();
      const link = `${ALLOWED_ORIGIN}/w/${claimToken}`;

      const { ok, detail } = await msg91SendLink(env, mobile, link);
      if (!ok) return json({ error: "Could not send recovery link", detail }, 502);

      /* Single-use + 30-min expiry (claim: record) and "newest link wins"
         (latestclaim: pointer) — claiming checks both, see /link/claim below. */
      await env.WALLET.put("claim:" + claimToken, JSON.stringify({ mobile, walletId: existingWalletId, createdAt: Date.now() }), { expirationTtl: CLAIM_TTL_SECONDS });
      await env.WALLET.put("latestclaim:" + mobile, claimToken, { expirationTtl: CLAIM_TTL_SECONDS });
      await env.WALLET.put(cooldownKey, "1", { expirationTtl: LINK_RESEND_COOLDOWN_SECONDS });

      return json({ ok: true, mobile, expiresInSeconds: CLAIM_TTL_SECONDS });
    }

    /* POST /link/claim/<token> — token lives in the path, never a query string.
       Verifies the claim is unexpired, unused, and still the latest one issued
       for its mobile, then ROTATES the wallet: mints a brand-new walletId,
       moves the balance across, and drops the old walletId entirely (so it
       can't still be used from wherever it was lost/leaked). */
    if (request.method === "POST" && url.pathname.startsWith("/link/claim/")) {
      const claimToken = url.pathname.slice("/link/claim/".length);
      if (!claimToken) return json({ error: "Link token required" }, 400);

      const raw = await env.WALLET.get("claim:" + claimToken);
      if (!raw) return json({ error: "This link has expired or was already used — request a new one", code: "LINK_INVALID" }, 400);
      const { mobile, walletId: oldWalletId } = JSON.parse(raw);

      const latest = await env.WALLET.get("latestclaim:" + mobile);
      if (latest !== claimToken) {
        return json({ error: "This link is no longer valid — a newer link was requested for this number", code: "LINK_SUPERSEDED" }, 400);
      }

      await env.WALLET.delete("claim:" + claimToken); // single-use, even on retry within the same millisecond

      const newWalletId = randomToken();
      const balance = await getBalance(env, oldWalletId);
      await setBalance(env, newWalletId, balance);
      await env.WALLET.delete("bal:" + oldWalletId); // old walletId is now worthless, wherever it's held
      await env.WALLET.put("recoverycontact:" + newWalletId, mobile);
      await env.WALLET.delete("recoverycontact:" + oldWalletId);
      await env.WALLET.put("recoverylookup:" + mobile, newWalletId);

      return json({ ok: true, walletId: newWalletId, balancePaise: balance, balanceRs: (balance / 100).toFixed(2) });
    }

    /* GET /balance?token=xxx — token IS the walletId (bearer credential),
       there's no separate session/auth layer on top of it. */
    if (request.method === "GET" && url.pathname === "/balance") {
      const walletId = url.searchParams.get("token");
      if (!walletId) return json({ error: "Wallet token required", code: "AUTH_REQUIRED" }, 401);
      const paise = await getBalance(env, walletId);
      return json({ walletId, balancePaise: paise, balanceRs: (paise / 100).toFixed(2) });
    }

    /* POST /order  { walletId?, amountRs } → creates a Razorpay order.
       walletId is optional: if the caller doesn't have one yet (first-ever
       payment), a fresh one is minted here and returned so the frontend can
       store it before the payment even completes. */
    if (request.method === "POST" && url.pathname === "/order") {
      const body = await request.json().catch(() => null);
      if (!body || !body.amountRs) return json({ error: "amountRs required" }, 400);
      const amountPaise = Math.round(Number(body.amountRs) * 100);
      if (!amountPaise || amountPaise < 100) return json({ error: "Minimum recharge is ₹1" }, 400);

      const walletId = body.walletId || randomToken();

      const auth = "Basic " + btoa(env.RAZORPAY_KEY_ID + ":" + env.RAZORPAY_KEY_SECRET);
      const rpRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth },
        body: JSON.stringify({
          amount: amountPaise,
          currency: "INR",
          receipt: buildReceipt(walletId),
          notes: { walletId },
        }),
      });
      if (!rpRes.ok) {
        const t = await rpRes.text();
        return json({ error: "Razorpay order failed", detail: t }, 502);
      }
      const order = await rpRes.json();
      return json({ orderId: order.id, amountPaise, keyId: env.RAZORPAY_KEY_ID, walletId });
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
        return json({ ok: true, alreadyCredited: true, walletId, balancePaise: paise, balanceRs: (paise / 100).toFixed(2) });
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

      /* Best-effort: capture the contact Razorpay collected during checkout
         as a RECOVERY number for this wallet — never the identity itself. */
      const contact = await fetchPaymentContact(env, razorpay_payment_id, auth);
      if (contact) {
        await env.WALLET.put("recoverycontact:" + walletId, contact);
        await env.WALLET.put("recoverylookup:" + contact, walletId);
      }

      return json({ ok: true, walletId, credited: order.amount, balancePaise: updated, balanceRs: (updated / 100).toFixed(2) });
    }

    /* POST /extract  { token, docType, images:[{data,mimeType}, ...] } → deducts ₹5, calls Gemini
       token IS the walletId — a bearer credential, no separate session lookup. */
    if (request.method === "POST" && url.pathname === "/extract") {
      if (!env.GEMINI_API_KEY) return json({ error: "Server not configured (missing API key)" }, 500);

      const body = await request.json().catch(() => null);
      if (!body) return json({ error: "Invalid JSON body" }, 400);
      const { docType, images } = body;

      const walletId = body.token;
      if (!walletId) return json({ error: "Wallet token required", code: "AUTH_REQUIRED" }, 401);

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
