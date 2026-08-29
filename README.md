# RTO Forms India

rtoformsindia.com — fill Indian RTO (Motor Vehicle Act / CMVR) forms online
and download print-ready PDFs, entirely client-side. No build step, no
backend for form-filling — PDFs are generated in the browser with jsPDF.

## Files

```
index.html          ← markup + <script src> load order (see below)
field-mapping.js     ← AI extraction → form field mapping (toISODate, AI_FIELD_MAP)
pdf-generate.js       ← jsPDF drawing functions, one per form
forms-data.js          ← FORMS catalog, FIELDS registry, PICKS/BUNDLES, VALS state
ui.js                    ← rendering + event handlers, generatePDF()
pro-wallet.js             ← PRO features: AI document upload, wallet (Razorpay)
i18n.js                    ← all UI strings (English default, Hinglish toggle)
style.css                   ← all styles
vehicle-transfer/, rc-renewal/, duplicate-rc/, hp-removal/, address-change/
                              ← task landing pages
worker/                       ← Cloudflare Worker: AI extraction + wallet backend
```

Every `.js`/`.css` file at the repo root is served as a static asset and
loaded directly by `index.html` — no bundler, no transpilation.

## Local test karna

```bash
npm install
npm test              # node --test — runs test/*.test.js
```

There's no local dev server needed to browse the site — just open
`index.html` directly, or serve the folder with any static file server
(e.g. `npx http-server` / `python -m http.server`).

## Deploy

Static hosting via **Cloudflare Pages**, connected to this repo — push to
the connected branch to deploy. `_redirects` (repo root) provides the
catch-all 404 handling (`404.html`) since Pages otherwise falls back to
serving `index.html` with a 200 for any unmatched path.

The AI-extraction/wallet backend is a separate **Cloudflare Worker**
(`worker/`) — see `worker/README.md` for setup, required secrets, and
deploy steps (`npx wrangler deploy` from `worker/`).

## Kaise kaam karta hai

1. User apni gaadi/document ke hisaab se ek ya zyada forms select karta hai
2. Fields fill karta hai (ya Aadhaar/PAN/RC photo upload karke AI se
   auto-fill karta hai — paid feature via the Worker)
3. Browser mein hi jsPDF se print-ready A4 PDF ban jaata hai — koi server
   round-trip nahi
