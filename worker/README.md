# RTO Forms — PRO Feature Worker (rto-ai-extract)

Cloudflare Worker that powers the paid features on rtoformsindia.com:
wallet balance/recharge (Razorpay) and document field extraction (Gemini
Vision) for Aadhaar, PAN, and RC images.

Deployed with Wrangler from `worker/` — code lives in `src/index.js`, config
in `wrangler.toml`. Do not deploy by pasting into the Cloudflare dashboard
editor anymore; that's how the Worker and frontend drifted out of sync before.

## Wallet identity model

The wallet ID is a server-minted **random token**, not a mobile number.
`/order` mints one on a caller's first-ever payment and returns it; the
frontend stores it in `localStorage` and sends it back as `token` on
`/balance`/`/extract` — it's used directly as the bearer credential, there's
no separate session layer. There is no account-recovery path if this token
is lost (cleared storage, new device) — an earlier MSG91-based recovery-link
flow was removed since MSG91 was never actually configured in production.

## Routes

- `GET /balance?token=xxx` — read the wallet balance for this token (token IS the walletId)
- `POST /order` — create a Razorpay order; mints a fresh walletId if the caller doesn't have one yet
- `POST /verify` — verify a Razorpay payment and credit the wallet
- `POST /extract` — deduct ₹5 and run Gemini Vision extraction on 1–2 images (requires a wallet token)

`/order` and `/verify` accept a client-supplied `walletId` with no proof of
ownership — that's intentional: recharging a stranger's walletId only costs
the sender their own money and benefits the wallet owner, so it isn't an
exploit. `/balance` and `/extract` trust whatever `token` is sent as the
walletId directly (bearer-token style) — since the token is a 256-bit
random value, this is safe: it's computationally infeasible to guess
someone else's, which is the property that actually matters (the earlier,
now-replaced design used the mobile number itself as the walletId, which
*was* guessable/typeable).

## One-time setup

1. Install Wrangler (or use `npx wrangler` without installing globally) and
   log in:
   ```
   npx wrangler login
   ```
2. Create the KV namespace used for wallet balances and sessions:
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
- Everything lives in the `WALLET` KV namespace: `bal:<walletId>` (balance,
  no expiry), `paid:<razorpay_payment_id>` (payment dedupe).
- `ALLOWED_ORIGIN` at the top of `src/index.js` is locked to
  `https://rtoformsindia.com` — update and redeploy if the site domain
  changes. Note `index.html`'s `<link rel="canonical">` currently points at
  `rto-forms.onrender.com` — confirm which domain is actually live before
  relying on CORS working end-to-end.
