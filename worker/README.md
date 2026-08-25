# RTO Forms — PRO Feature Worker (v2)

Cloudflare Worker that powers the paid features on rtoformsindia.com:
wallet balance/recharge (Razorpay) and document field extraction (Gemini Vision)
for Aadhaar, PAN, and RC images.

Currently deployed by pasting `worker-v2.js` into the Cloudflare dashboard editor
(no `wrangler.toml` / CLI deploy set up yet).

## Routes

- `GET /balance?walletId=xxx` — read wallet balance
- `POST /order` — create a Razorpay order to recharge a wallet
- `POST /verify` — verify a Razorpay payment and credit the wallet
- `POST /extract` — deduct ₹5 and run Gemini Vision extraction on 1–2 images

## Deploy (Cloudflare dashboard)

1. Go to **Cloudflare dashboard → Workers & Pages** and open the worker
   (or **Create → Worker** if it doesn't exist yet).
2. Open the **Edit code** view, replace the contents with `worker-v2.js`, then
   **Save and deploy**.
3. Under **Settings → Variables and Secrets**, set:
   - `GEMINI_API_KEY` (Secret) — from https://aistudio.google.com/apikey
   - `RAZORPAY_KEY_ID` (Text) — e.g. `rzp_test_xxxx`
   - `RAZORPAY_KEY_SECRET` (Secret)
4. Under **Settings → Bindings → KV Namespace**, bind a KV namespace named
   `WALLET` (create one called `rto-wallets` if it doesn't exist).
5. Confirm `ALLOWED_ORIGIN` at the top of `worker-v2.js` matches the site
   domain (currently `https://rtoformsindia.com`) — update and redeploy if it
   changes.

## Notes

- Extraction cost is `COST_PAISE` in `worker-v2.js` (currently ₹5.00 per call).
- Wallet balances and payment dedupe records are stored in the `WALLET` KV
  namespace (`bal:<walletId>` and `paid:<razorpay_payment_id>` keys).
