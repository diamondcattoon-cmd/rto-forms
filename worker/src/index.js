/**
 * rtoformsindia.com — PRO Feature Worker v2
 * Real ₹ wallet + Razorpay auto-payment + Gemini Vision extraction
 *
 * Wallet identity is a server-minted random token (walletId) — NOT a mobile
 * number. It's created the first time someone pays (see /order), held only
 * in the paying browser's localStorage, and used directly as the bearer
 * credential for /balance and /extract-package (no separate "session"
 * layer — the token IS the secret, same as an API key). This is deliberate: a mobile
 * number is guessable/typeable, so using it as the wallet identity (the
 * very first version of this Worker did) let anyone spend anyone else's
 * balance. A 256-bit random token has no such weakness regardless of who
 * generates it.
 *
 * There is no account-recovery path if a user loses this token (cleared
 * storage, new device) — an earlier version emailed/SMS'd a recovery link
 * via MSG91, but that was removed (MSG91 was never actually configured in
 * production, so it never worked) rather than left in as dead code. If
 * recovery is needed again, it needs a real delivery channel decided first.
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
 *
 * Requires (Worker → Settings → Bindings → KV Namespace):
 *   WALLET   — bind to a KV namespace (create one called "rto-wallets")
 *
 * NOTE: the exact Razorpay Payments API request/response shapes below match
 * their docs as of when this was written — re-check
 * razorpay.com/docs/api/payments before relying on them, the same way
 * JH_RATES in index.html is flagged as needing verification.
 */

const ALLOWED_ORIGIN = "https://rtoformsindia.com";
const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_URL = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

/* ── AI extraction pricing — flat per TASK, not per document ──
   This is the ONLY copy that actually decides what gets charged — a
   client-sent price is never trusted (see /extract-package below). The
   frontend's copy (task-pricing.js) exists purely to LABEL the price
   before a call is even made; the two are kept in sync by
   test/task-pricing-contract.test.js, not by literal code sharing (this
   Worker is a separate deployable from the frontend's plain <script src>
   files). A client CAN send a taskId that undersells what it's actually
   getting (there's no server-side check that a given taskId "deserves"
   the docTypes sent with it) — the worst case is paying the cheaper ₹3
   tier for a task that should be ₹5, never a free extraction, since the
   price still always comes from this table. Deliberately not hardened
   further than that; revisit if it's ever actually abused. */
/* b_transfer stays priced higher than the rest even though every task
   now extracts at most one document (RC only, see PROMPTS below) — the
   price table intentionally wasn't touched when Aadhaar/PAN extraction
   was removed, so this gap is currently just margin, not a reflection of
   extraction cost. Left as-is on purpose. */
const TASK_PRICING = {
  b_transfer: 500,
  b_rcrenew:  300,
  b_duprc:    300,
  b_death:    300,
  b_hp:       300,
  b_hpremove: 300,
  b_address:  300,
  b_newreg:   300,
  default:    300,
};


/* ── Extraction scope: RC only ──
   Aadhaar and PAN prompts were removed deliberately, not just unused —
   see the docType allowlist check in /extract-package below, which
   rejects anything but 'rc' outright. An Aadhaar card carries a photo
   and a government ID number the Aadhaar Act treats as sensitive
   personal data; sending it to a third-party API (Gemini) carries real
   compliance risk that a vehicle Registration Certificate does not.
   Aadhaar/PAN images are still collected client-side for PDF
   attachment, but that never involves this Worker or Gemini — see
   pro-wallet.js's markAttachOnly()/isSlotExtractable(). The old prompts
   are recoverable from git history if extraction is ever reinstated
   under a proper compliance review. */
const PROMPTS = {
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
  "manufacture_date": "",
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
- manufacture_date: month and year of manufacture only, format MM/YYYY (e.g. "06/2015") — usually labelled "Mfg Dt." or "Manufacturing Date". This is NOT the same as registration_date and NOT the model name — do not confuse the three.
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

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ── Package pricing/atomicity — pure, no KV/network, fully unit-testable
   without mocking Gemini or a wallet. This is the entire "should we
   charge, and how much" decision for /extract-package, deliberately
   pulled out of the route handler so it can be tested the same way
   buildReceipt/constantTimeEqual are: directly, with plain inputs. ── */
export function hasEnoughBalance(balancePaise, priceInPaise) {
  return balancePaise >= priceInPaise;
}

/* results: [{docType, ok, data|error}, ...] — one entry per document that
   was actually attempted. Charges only when EVERY entry succeeded ("poora
   ya kuch nahi"); a single failure charges nothing at all, and the caller
   never has to issue a refund because nothing was ever deducted. */
export function decidePackageCharge(priceInPaise, results) {
  const failed = results.filter((r) => !r.ok).map((r) => r.docType);
  if (failed.length) return { charge: false, failed };
  return { charge: true, amountPaise: priceInPaise };
}

/* Runs one document through Gemini and returns a plain outcome object —
   never throws, never touches the wallet. Split out of the /extract-package
   route so that route can loop over a package's documents and collect
   {docType, ok, data|error} results before deciding (decidePackageCharge)
   whether anything gets charged. */
async function runOneExtraction(env, docType, images) {
  const parts = [{ text: PROMPTS[docType] }];
  for (const img of images) {
    if (!img.data) return { ok: false, error: "Each image needs a data field" };
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
    return { ok: false, error: "Gemini request failed", detail: String(err) };
  }
  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    return { ok: false, error: "Gemini API error", detail: errText };
  }

  let geminiData;
  try {
    geminiData = await geminiRes.json();
  } catch (err) {
    return { ok: false, error: "Could not parse Gemini response", detail: String(err) };
  }
  let extractedText;
  try {
    extractedText = geminiData.candidates[0].content.parts[0].text;
  } catch {
    return { ok: false, error: "Unexpected Gemini response shape", raw: geminiData };
  }

  try {
    return { ok: true, data: JSON.parse(extractedText) };
  } catch {
    return { ok: false, error: "Gemini did not return valid JSON", raw: extractedText };
  }
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

      return json({ ok: true, walletId, credited: order.amount, balancePaise: updated, balanceRs: (updated / 100).toFixed(2) });
    }

    /* POST /extract-package  { token, taskId, docs:[{docType, images:[{data,mimeType},...]}, ...] }
       Charges ONCE for the whole package, at TASK_PRICING[taskId] — never
       per document. token IS the walletId — a bearer credential, no
       separate session lookup.

       Atomicity: every doc in the package is extracted BEFORE anything is
       charged. The balance is only ever touched once, at the very end, and
       only if every single doc succeeded (see decidePackageCharge()) — so
       there's no "charge then refund" path to get wrong: if the doc fails,
       the deduction simply never happens. The tradeoff this accepts: the
       Gemini cost may still have been spent (we paid Google) even though
       the user pays nothing — that's the whole point of "poora ya kuch
       nahi" and is deliberate, not a bug. The docs array/loop below still
       supports more than one document structurally, even though the
       docType allowlist currently limits a package to exactly one RC. */
    if (request.method === "POST" && url.pathname === "/extract-package") {
      if (!env.GEMINI_API_KEY) return json({ error: "Server not configured (missing API key)" }, 500);

      const body = await request.json().catch(() => null);
      if (!body) return json({ error: "Invalid JSON body" }, 400);
      const { taskId, docs } = body;

      const walletId = body.token;
      if (!walletId) return json({ error: "Wallet token required", code: "AUTH_REQUIRED" }, 401);

      const price = TASK_PRICING[taskId];
      if (price === undefined) return json({ error: "Unknown taskId" }, 400);

      if (!Array.isArray(docs) || docs.length === 0) return json({ error: "docs array required" }, 400);
      if (docs.length > 1) return json({ error: "Maximum 1 document per package — only RC is extracted" }, 400);
      for (const d of docs) {
        /* Aadhaar/PAN are rejected here even if a caller bypasses the
           frontend entirely — see the PROMPTS comment above. This is the
           actual enforcement point, not the UI. */
        if (!d.docType || !PROMPTS[d.docType]) return json({ error: "docType must be 'rc' — Aadhaar/PAN are not extracted" }, 400);
        if (!Array.isArray(d.images) || d.images.length === 0 || d.images.length > 2) {
          return json({ error: "Each document needs 1-2 images" }, 400);
        }
      }

      const balance = await getBalance(env, walletId);
      if (!hasEnoughBalance(balance, price)) {
        return json({ error: "Insufficient balance", balancePaise: balance, balanceRs: (balance / 100).toFixed(2), required: price }, 402);
      }

      const results = [];
      for (const d of docs) {
        const outcome = await runOneExtraction(env, d.docType, d.images);
        results.push({ docType: d.docType, ...outcome });
      }

      const decision = decidePackageCharge(price, results);
      if (!decision.charge) {
        return json({ ok: false, failed: decision.failed, results }, 200);
      }

      const newBalance = balance - price;
      await setBalance(env, walletId, newBalance);
      return json({ ok: true, results, balancePaise: newBalance, balanceRs: (newBalance / 100).toFixed(2) });
    }

    return json({ error: "Not found" }, 404);
}
