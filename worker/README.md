# RTO Forms — PRO Feature Worker (rto-ai-extract)

Cloudflare Worker that powers the paid features on rtoformsindia.com:
wallet balance/recharge (Razorpay), account recovery via SMS, and document
field extraction (Gemini Vision) for Aadhaar, PAN, and RC images.

Deployed with Wrangler from `worker/` — code lives in `src/index.js`, config
in `wrangler.toml`. Do not deploy by pasting into the Cloudflare dashboard
editor anymore; that's how the Worker and frontend drifted out of sync before.

## Wallet identity model

The wallet ID is a server-minted **random token**, not a mobile number.
`/order` mints one on a caller's first-ever payment and returns it; the
frontend stores it in `localStorage` and sends it back as `token` on
`/balance`/`/extract` — it's used directly as the bearer credential, there's
no separate session layer. A mobile number is still collected (Razorpay's
own checkout UI asks for it during payment) but only ever stored as a
**recovery contact**, never as the identity — see `/link/send`/`/link/claim`.

## Routes

- `POST /link/send` — SMS a one-time recovery link (via MSG91) to whichever wallet a mobile number is linked to
- `POST /link/claim/<token>` — claim a recovery link: rotates to a brand-new walletId, transfers the balance, invalidates the old walletId
- `GET /balance?token=xxx` — read the wallet balance for this token (token IS the walletId)
- `POST /order` — create a Razorpay order; mints a fresh walletId if the caller doesn't have one yet
- `POST /verify` — verify a Razorpay payment, credit the wallet, and capture the payer's contact as a recovery number
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

### Recovery link properties

- 30-minute expiry
- single-use — the claim record is deleted the instant it's claimed
- sending a new link for the same mobile immediately invalidates the
  previous one, even if its 30 minutes haven't elapsed
- claiming a link rotates to a brand-new walletId and deletes the old one's
  balance record entirely, so a lost/leaked old token stops working the
  moment a recovery happens — not just "a second session," an actual
  identity rotation
- the token lives in the URL path (`/w/<token>`), never a query string

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
3. Register a DLT template with MSG91 (mandatory in India for transactional/
   OTP SMS, regardless of provider) for a message containing a link
   variable, e.g. "Your RTO Forms wallet verification link: {{LINK}} (valid
   30 min)". Do this before going live — DLT approval can take a few days.
4. Set the required secrets (values are prompted interactively, never
   passed on the command line, and never committed to the repo):
   ```
   npx wrangler secret put GEMINI_API_KEY
   npx wrangler secret put RAZORPAY_KEY_ID
   npx wrangler secret put RAZORPAY_KEY_SECRET
   npx wrangler secret put MSG91_AUTH_KEY
   ```
   - `GEMINI_API_KEY` — from https://aistudio.google.com/apikey
   - `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — from the Razorpay dashboard
   - `MSG91_AUTH_KEY` — from the MSG91 dashboard → API keys
5. Set the DLT template ID as a plain (non-secret) var:
   ```
   npx wrangler secret put MSG91_LINK_TEMPLATE_ID
   ```
   (using `secret put` for this too is fine — it just means one less thing
   to remember which command to use; the template ID isn't sensitive, but
   there's no downside to keeping it out of `wrangler.toml` either.)

## Deploy

```
npx wrangler deploy
```

Run this from the `worker/` folder (where `wrangler.toml` lives) every time
`src/index.js` changes, so the deployed Worker and this repo never drift
apart again.

## Frontend integration

The recovery link points at `https://rtoformsindia.com/w/<token>` — the
main site (not the Worker) must serve `index.html` for that path so the
page's own JS can read the token and call `/link/claim`. This is already
wired up:
- `server.js` (`app.get('/w/:token', ...)`) for the Express/Render deploy
- `_redirects` (repo root) for a Cloudflare Pages deploy

If the site moves to a different static host, replicate that same
SPA-style fallback there too, or claim links will 404.

## Notes

- Extraction cost is `COST_PAISE` in `src/index.js` (currently ₹5.00 per call).
- Everything lives in the `WALLET` KV namespace: `bal:<walletId>` (balance,
  no expiry), `paid:<razorpay_payment_id>` (payment dedupe), `claim:<token>`
  / `latestclaim:<mobile>` (recovery-link state, 30 min), `linkcooldown:<mobile>`
  (resend rate limit), `recoverycontact:<walletId>` / `recoverylookup:<mobile>`
  (the walletId ↔ mobile mapping used only for recovery, no expiry).
- `ALLOWED_ORIGIN` at the top of `src/index.js` is locked to
  `https://rtoformsindia.com` — update and redeploy if the site domain
  changes. Note `index.html`'s `<link rel="canonical">` currently points at
  `rto-forms.onrender.com` — confirm which domain is actually live before
  relying on CORS working end-to-end.
