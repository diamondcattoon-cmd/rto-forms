# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

rtoformsindia.com — a static site that lets users fill Indian RTO (Motor Vehicle
Act / CMVR) forms online and download print-ready PDFs, entirely client-side.
There is no form-filling backend; the frontend is a handful of plain
(non-module) JS files loaded via `<script src>` — no build step, no bundler —
containing the form catalog, the fill-in UI, and jsPDF-based PDF generation
logic. A Cloudflare Worker provides optional paid ("PRO") features: AI
document auto-fill and a Razorpay-funded wallet (random-token identity, no
upfront mobile/OTP step — see `pro-wallet.js`).

## Commands

```bash
npm install
node server.js          # static file server on http://localhost:3000 (or $PORT)
npm test                 # node --test — runs test/*.test.js
```

No build step or bundler — every `.js` file at the repo root is served as-is
and loaded directly by `index.html`. `npm start` runs `node server.js`.

## Deploy

- Main site: Render.com, configured via `render.yaml` (`npm install` build,
  `node server.js` start). Push to the connected branch to deploy. Note
  `index.html`'s `<link rel="canonical">` currently points at
  `rto-forms.onrender.com`, not `rtoformsindia.com` — confirm which domain is
  actually live before assuming the Worker's CORS (`ALLOWED_ORIGIN`) matches.
- PRO feature backend: Cloudflare Worker, deployed with Wrangler from
  `worker/` (`npx wrangler deploy`) — see `worker/README.md` for one-time
  setup, required secrets, and the `WALLET` KV binding. Do not deploy by
  pasting into the Cloudflare dashboard editor; that's how the Worker and
  frontend drifted out of sync in the past, which is why Wrangler + the
  contract tests below exist.

## Architecture

### `server.js`
Minimal Express app that serves static files from the repo root, a `/health`
endpoint, and a SPA-style fallback (`/w/:token` → `index.html`) for wallet
recovery links — see `worker/README.md`'s "Frontend integration" section.
**`README.md` (repo root) is stale** — it describes an older
Puppeteer/`POST /api/generate` server-side PDF pipeline that no longer exists
in `server.js`. All PDF generation now happens in the browser via jsPDF.
`form29.html`, `form30.html`, and `affidavit.html` at the repo root are
leftovers from that old approach and are not referenced by `index.html` or
`server.js`.

### `index.html` — markup only
Just HTML + a fixed sequence of `<script src>` tags, in this exact order
(load-order matters — see each file's own header comment for why):
```
field-mapping.js → pdf-generate.js → forms-data.js → ui.js → pro-wallet.js
```
These are classic (non-module) scripts sharing one global scope — every
top-level `const`/`function` in one file is a plain global visible to the
files after it. All script `src` attributes are **absolute paths**
(`/pdf-generate.js`, not `pdf-generate.js`) deliberately: a relative path
resolves against the current URL, and wallet recovery links load the page
from `/w/<token>`, not `/` — a relative script src there 404s (or worse,
silently resolves to the `/w/:token` fallback route and gets served
`index.html`'s HTML instead of JS). Keep new asset references
(`<script src>`, `<link href>`, fetch URLs) absolute for the same reason.

- **`field-mapping.js`** — `toISODate()` and `AI_FIELD_MAP` (Gemini
  extraction → form field mapping). Shared between the browser and the Node
  test suite (`require()`d directly), which is the whole point: it's the
  exact code under test, not a copy.
- **`pdf-generate.js`** — pure jsPDF drawing functions (`addForm29`,
  `addForm30`, `addAffidavit`, ~25 more `addFormXX`/`addGeneric` functions,
  plus shared layout helpers). Each takes `(doc, d)` — an already-created
  jsPDF document and a plain field-id→value object — and draws one form's
  layout. No dependency on FIELDS/PICKS/VALS or the DOM. Must load first:
  `forms-data.js`'s `PICKS` array references these functions by name.
- **`forms-data.js`** — pure data + minimal state: `FORMS` (landing-page
  catalog), `SECTIONS`/`FIELDS` (the shared field registry), `VALS` (live
  in-progress field values, debounce-persisted to `localStorage` so an
  accidental refresh doesn't lose a paid extraction), and `PICKS`/
  `DOC_TYPES`/`BUNDLES`/`CHECKED` (the fillable-form registry — see below).
- **`ui.js`** — rendering and event handlers: the forms-catalog grid
  (`renderForms`/`fillNow`/`filterCat`), the fill-tool's dynamic sections
  (`buildPicks`/`updateSections`/`handleInput`), the restore-notice banner,
  the Jharkhand registration-cost calculator, and `generatePDF()` (which
  looks up the checked `PICKS` entries and calls each one's `gen(doc, d)`).
  Also: `updateProContext()` (the PRO panel's "N fields hain, M abhi khali"
  line) and `updateDocSlotVisibility()` (only shows the Aadhaar/PAN/RC
  upload slots that could actually fill a field the selected forms need —
  derived from `AI_FIELD_MAP`'s own source via `docTypeOutputFields()`, not
  a separately hand-maintained list). `fieldHTML()` marks fields currently
  in `AI_FILLED_FIELDS` (forms-data.js) with an amber highlight + "AI"
  badge; `handleInput()` drops that marking the instant the user edits one.
- **`pro-wallet.js`** — the paid features: Aadhaar/PAN/RC photo upload →
  Gemini Vision extraction (via the Worker), and the wallet. There is no
  upfront "verify your mobile" step — `PRO.walletId` is a random token
  minted by the Worker on first payment (`startPayment()` → `/order`) and
  reused directly as the bearer credential for `/balance`/`/extract` (sent
  as `token`). A mobile number is only ever collected inside Razorpay's own
  checkout UI, purely as a recovery contact (`sendWalletLink`/
  `claimWalletLinkFromUrl`, collapsed behind "Purana wallet wapas chahiye?"
  — not shown by default). `PRO.walletId` persists in `localStorage`
  (`rtoProState`); uploaded document images are kept in memory only for the
  session (never persisted) and can optionally be attached as extra pages
  to the generated PDF.

**`PICKS`** (in `forms-data.js`) is the registry of fillable form packs. Each
pick has an `id` (e.g. `pk29`, `pk20`), a `type` (which field-groups it
needs, e.g. `rto` vs `affidavit`), a `fields` list (which shared `FIELDS`
entries to show/collect), and a `gen` function from `pdf-generate.js`. Adding
a new fillable form means adding a function to `pdf-generate.js`, a `PICKS`
entry in `forms-data.js` pointing `gen` at it, and a `FORMS` entry pointing
`fill` at the `PICKS` id.

Blank official PDFs are served from the local `forms/` folder if present
(checked via a `HEAD` request for `/forms/FORM-29.pdf` at load — see
`USE_LOCAL` in `ui.js`), otherwise linked directly to parivahan.gov.in.
`download-forms.bat` fetches the full set of official blank PDFs from
parivahan.gov.in into a local `forms/` folder.

### `worker/` — Cloudflare Worker (PRO backend)
Code lives in `worker/src/index.js`, deployed with Wrangler (`worker/wrangler.toml`).
See `worker/README.md` for routes, required secrets, and deploy steps.
Wallet identity is a server-minted random token (walletId), not a mobile
number — `/order` mints one on first payment and returns it; `/balance` and
`/extract` trust the `token` param directly as the walletId (bearer-token
style, no separate session layer). This closes off spending someone else's
wallet: the earlier design used the mobile number itself as the walletId,
which was guessable/typeable; a 256-bit random token isn't. A mobile number
is still captured — best-effort, from Razorpay's payment object in
`/verify` — but only as a recovery contact (`recoverycontact:<walletId>` /
`recoverylookup:<mobile>`), used solely by `/link/send` + `/link/claim/<token>`
to let someone regain access on a new device (which rotates to a brand-new
walletId and invalidates the old one, rather than just re-authenticating it).

### Tests (`test/*.test.js`, run via `npm test`)
Node's built-in test runner, no framework. Covers `toISODate`/`AI_FIELD_MAP`
behavior, and — the important one — `test/worker-frontend-contract.test.js`,
which parses `worker/src/index.js`'s actual `PROMPTS` source at test time and
diffs it against `AI_FIELD_MAP`'s source, so a field renamed on one side and
not the other fails a test instead of silently breaking auto-fill in
production (this has happened twice before).

### `generate_pdf.py`, `overlay_pdf.py`
Standalone Python/reportlab scripts for generating/overlaying PDFs against a
scanned template. Not wired into `server.js` or `index.html` — exploratory
tooling, not part of the live request path.
