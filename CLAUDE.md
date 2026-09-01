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
npm test                 # node --test — runs test/*.test.js
```

No build step or bundler — every `.js` file at the repo root is served as-is
and loaded directly by `index.html`. There is no local server needed to
browse the site; open `index.html` directly or serve the folder with any
static file server.

## Deploy

- Main site: **Cloudflare Pages**, connected to this repo — push to the
  connected branch to deploy. `_redirects` (repo root) routes unmatched
  paths to `404.html` (Pages otherwise falls back to serving `index.html`
  with a 200 for any unmatched path — this was a live bug, fixed by adding
  `404.html` + the `_redirects` catch-all). Note `index.html`'s
  `<link rel="canonical">` still points at `rto-forms.onrender.com` (a
  retired Render deployment, no longer live) instead of `rtoformsindia.com`
  — harmless for CORS (the Worker's `ALLOWED_ORIGIN` matches the real live
  domain, confirmed) but wrong for SEO; worth fixing the tag.
- PRO feature backend: Cloudflare Worker, deployed with Wrangler from
  `worker/` (`npx wrangler deploy`) — see `worker/README.md` for one-time
  setup, required secrets, and the `WALLET` KV binding. Do not deploy by
  pasting into the Cloudflare dashboard editor; that's how the Worker and
  frontend drifted out of sync in the past, which is why Wrangler + the
  contract tests below exist.

## Architecture

There is no server-side component for the main site — it's pure static
files on Cloudflare Pages. All PDF generation happens in the browser via
jsPDF. (There used to be an Express server, `server.js`, plus a Puppeteer/
`POST /api/generate` server-side PDF pipeline before that — both are gone;
don't reintroduce a server dependency for the main site without a real
reason, since Pages deploy is what's actually live in production.)

### `index.html` — markup only
Just HTML + a fixed sequence of `<script src>` tags, in this exact order
(load-order matters — see each file's own header comment for why):
```
field-mapping.js → pdf-generate.js → forms-data.js → task-pricing.js → ui.js → [landing.js] → aadhaar-qr.js → aadhaar-qr-scan.js → pro-wallet.js
```
`landing.js` only appears on `index.html` (see below) — task pages don't
load it; `aadhaar-qr.js`/`aadhaar-qr-scan.js` are the reverse, task pages
only (the buyer Aadhaar box they wire up doesn't exist on `index.html`).
These are classic (non-module) scripts sharing one global scope —
every top-level `const`/`function` in one file is a plain global visible to
the files after it. All script `src` attributes are **absolute paths**
(`/pdf-generate.js`, not `pdf-generate.js`) — keep new asset references
(`<script src>`, `<link href>`, fetch URLs) absolute too, so they resolve
correctly regardless of which path served the current page.

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
- **`ui.js`** — `fillNow`/`openOfficial` (what a landing-page catalog
  card's click hands off to — see `landing.js`, index.html only), the
  fill-tool's dynamic sections (`buildPicks`/`updateSections`/
  `handleInput`), the restore-notice banner, the Jharkhand
  registration-cost calculator, and `generatePDF()` (which
  looks up the checked `PICKS` entries and calls each one's `gen(doc, d)`).
  Also: `updateProContext()` (the PRO panel's "N fields hain, M abhi khali"
  line) and `updateDocSlotVisibility()` (only shows the Aadhaar/PAN/RC
  upload slots that could actually fill a field the selected forms need —
  derived from `AI_FIELD_MAP`'s own source via `docTypeOutputFields()`, not
  a separately hand-maintained list). `fieldHTML()` marks fields currently
  in `AI_FILLED_FIELDS` (forms-data.js) with an amber highlight + "AI"
  badge; `handleInput()` drops that marking the instant the user edits one.
- **`landing.js`** — index.html's landing section only (hero, search,
  package cards, the 41-form catalog + category pills) — ported visually
  from a design mockup (`design/design-landing-v3.html`) but renders
  strictly from the real `FORMS`/`BUNDLES` (forms-data.js), never that
  mockup's own hardcoded sample data. `FORM_ICON` (forms-data.js) maps a
  form's `num` to one of this file's inline-SVG icons. Card clicks hand off
  to `fillNow`/`openOfficial`/`applyBundle` (ui.js) — this file owns no
  fill-tool state of its own. Doesn't touch `#tool`/`#calc`/`#how`/`#faq`,
  which stay exactly as they were.
- **`pro-wallet.js`** — the paid features: Aadhaar/PAN/RC photo upload →
  Gemini Vision extraction (via the Worker), and the wallet. There is no
  upfront "verify your mobile" step and no account-recovery path —
  `PRO.walletId` is a random token minted by the Worker on first payment
  (`startPayment()` → `/order`) and reused directly as the bearer credential
  for `/balance`/`/extract-package` (sent as `token`). Extraction billing is
  package-based (`startPackageExtraction()`, flat price per TASK — see
  `task-pricing.js`/`getCurrentTaskId()` in ui.js), not per document. An
  earlier MSG91-based recovery-link flow (`sendWalletLink`/
  `claimWalletLinkFromUrl`, mobile number as a recovery contact) was
  removed — MSG91 was never actually configured in production, so it was
  dead code. `PRO.walletId` persists in `localStorage` (`rtoProState`);
  uploaded document images are kept in memory only for the session (never
  persisted) and can optionally be attached as extra pages to the generated
  PDF. The wallet balance also renders into a small badge in the header on
  every page (`#hdrWalletBadge`, updated by `renderProCredits()`), not just
  inside this panel. "Take photo" buttons call `handleTakePhotoClick(key)`,
  which sends touch devices to the native `capture=environment` file input
  (unchanged) and everything else through a `getUserMedia`-based capture
  modal (`openCameraModal()`/`captureCameraPhoto()`/`useCameraPhoto()`) —
  the captured frame is wrapped into a real `File` and handed to the exact
  same `handleFileSelect()`/`handlePhotoUpload()` a picked file uses, so
  there's no separate compression/preview code path to keep in sync.
- **`aadhaar-qr.js`** — decodes UIDAI's "Secure QR Code" (the one on
  e-Aadhaar/PVC cards and the mAadhaar app): the QR payload is one giant
  base-10 integer → byte array → gzip-inflated (via the native
  `DecompressionStream`, no bundled library) → 16 fields delimited by byte
  255. Only the last 4 Aadhaar digits and structured demographic/address
  fields are present in this QR — never the full 12-digit number — which is
  what makes reading it compatible with the Aadhaar Act, unlike photo OCR.
  `decodeAadhaarSecureQr()` is the entry point; it also detects and refuses
  the pre-2018 XML-based Aadhaar QR (`aadhaarQrIsOldFormat()`), which does
  carry the full number. Pure and DOM-free, `require()`'d directly by
  `test/aadhaar-qr.test.js` — same convention as `field-mapping.js`.
  `aadhaarQrMapToBuyerFields()` always writes to the buyer's (`b_`) fields
  regardless of whose Aadhaar was scanned, mirroring `DOC_RULES.rc`'s fixed
  'seller' role (field-mapping.js) for the other side of a transfer.
- **`aadhaar-qr-scan.js`** — the DOM wiring around the above: no button, no
  camera, no separate step. `attemptAadhaarQrFromUpload(key)` is called from
  `onDocReady()` (`pro-wallet.js`) for every doc-upload key and is a no-op
  unless `key==='aadhaar_buyer_front'` (task-page markup only — `index.html`
  has no buyer group) — when it is, it runs `jsQR` (CDN global) once against
  that same photo via canvas, right after the user attaches it (Take
  photo/Choose file both converge on `onDocReady()`). Silent on every
  outcome except a real, correctly-read old-format QR, which gets a visible
  warning (`#qrScanResult`, in the buyer Aadhaar box) — a single still photo
  taken for an unrelated reason is far less forgiving than the live scan
  this replaced, so most uploads simply find nothing and say nothing.
  Entirely separate from `pro-wallet.js`'s paid Gemini pipeline — no Worker
  call, no wallet, no `EXTRACTED_SET`/`FIELD_SOURCE`/`AI_FILLED_FIELDS`
  bookkeeping. Also tallies attempts by outcome (`old-format`/`not-found`/
  `decode-error`) into `localStorage` under `aadhaarQrFailCounts` — no
  personal data, just counts, to gauge how often a photo taken for
  attachment happens to also carry a readable QR.

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
which was guessable/typeable; a 256-bit random token isn't. There is no
account-recovery path if a user loses this token — an earlier MSG91-based
recovery-link flow (`/link/send` + `/link/claim/<token>`, mobile number as
a recovery contact) was removed since MSG91 was never actually configured
in production.

### Tests (`test/*.test.js`, run via `npm test`)
Node's built-in test runner, no framework. Covers `toISODate`/`AI_FIELD_MAP`
behavior, and — the important one — `test/worker-frontend-contract.test.js`,
which parses `worker/src/index.js`'s actual `PROMPTS` source at test time and
diffs it against `AI_FIELD_MAP`'s source, so a field renamed on one side and
not the other fails a test instead of silently breaking auto-fill in
production (this has happened twice before).

