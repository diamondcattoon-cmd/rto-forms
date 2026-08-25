# RTO Forms — PRO Feature Worker (rto-ai-extract)

Cloudflare Worker that powers the paid features on rtoformsindia.com:
wallet balance/recharge (Razorpay) and document field extraction (Gemini Vision)
for Aadhaar, PAN, and RC images.

Deployed with Wrangler from `worker/` — code lives in `src/index.js`, config
in `wrangler.toml`. Do not deploy by pasting into the Cloudflare dashboard
editor anymore; that's how the Worker and frontend drifted out of sync before.

## Routes

- `GET /balance?walletId=xxx` — read wallet balance
- `POST /order` — create a Razorpay order to recharge a wallet
- `POST /verify` — verify a Razorpay payment and credit the wallet
- `POST /extract` — deduct ₹5 and run Gemini Vision extraction on 1–2 images

## One-time setup

1. Install Wrangler (or use `npx wrangler` without installing globally) and
   log in:
   ```
   npx wrangler login
   ```
2. Create the KV namespace used for wallet balances:
   ```
   npx wrangler kv namespace create rto-wallets
   ```
   This prints an `id`. Paste it into `wrangler.toml` in place of
   `REPLACE_WITH_KV_NAMESPACE_ID`.
3. Set the required secrets (values are prompted interactively, never
   passed on the command line, and never committed to the repo):
   ```
   npx wrangler secret put GEMINI_API_KEY
   npx wrangler secret put RAZORPAY_KEY_ID
   npx wrangler secret put RAZORPAY_KEY_SECRET
   ```
   - `GEMINI_API_KEY` — from https://aistudio.google.com/apikey
   - `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — from the Razorpay dashboard

## Deploy

```
npx wrangler deploy
```

Run this from the `worker/` folder (where `wrangler.toml` lives) every time
`src/index.js` changes, so the deployed Worker and this repo never drift
apart again.

## Notes

- Extraction cost is `COST_PAISE` in `src/index.js` (currently ₹5.00 per call).
- Wallet balances and payment dedupe records are stored in the `WALLET` KV
  namespace (`bal:<walletId>` and `paid:<razorpay_payment_id>` keys).
- `ALLOWED_ORIGIN` at the top of `src/index.js` is locked to
  `https://rtoformsindia.com` — update and redeploy if the site domain
  changes.
