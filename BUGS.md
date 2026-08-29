# RTO Forms — System Audit (2026-08-29)

Read-only audit. No code was changed while producing this file. "Code mein hai" aur
"kaam kar raha hai" alag rakha gaya hai — jahan sirf code padha, live test nahi kiya,
wahan explicitly likha hai.

---

## 🔴 SABSE ZAROORI FINDING: do alag production deployments hain, aur ek confirm broken hai

- **`rtoformsindia.com`** (real domain, users yahi use karte hain) → served by **Cloudflare
  (`Server: cloudflare`, `cf-cache-status: HIT`)** — ye **Cloudflare Pages** hai, `server.js`
  (Express) nahi. `_redirects` file (`/w/* /index.html 200`) isi ke liye hai.
- **`rto-forms.onrender.com`** → ye **Render.com Express (`server.js`)** hai, jo `index.html`'s
  own `<link rel="canonical">` mein point ho raha hai.

In dono ka **routing behavior alag hai**, aur maine dono live test kiye:

| Path | rtoformsindia.com (Cloudflare Pages, REAL PROD) | rto-forms.onrender.com (Express) |
|---|---|---|
| `/koibhigalatURL12345` | **HTTP 200 — poori homepage khulti hai** | HTTP 404 (sahi) |

**Bug #7 confirmed LIVE on the real production domain.** `server.js` ka Express code sahi
hai (koi catch-all route nahi, default 404 kaam karta hai) — lekin production actually
Express ke through serve hi nahi ho raha. Cloudflare Pages par koi `404.html` ya
`_redirects`-based `/* 404` rule nahi hai, isliye Pages apne default fallback se
`index.html` ko 200 pe serve kar deta hai kisi bhi unmatched path ke liye.

**Fix ka scope** (sirf report kar raha hoon, kiya nahi): Cloudflare Pages project mein ek
`404.html` add karo, ya `_redirects` mein explicit `/* /404.html 404` jaisa rule daalo.
`server.js` ko chhedne ki zaroorat nahi — wo already sahi hai.

Bonus: canonical tag (`rto-forms.onrender.com`) production domain (`rtoformsindia.com`) se
mismatch hai — abhi CORS todta nahi (Worker ka `ALLOWED_ORIGIN` live domain se match karta
hai, live-tested), lekin SEO ke liye galat hai (Google galat URL ko canonical maan sakta hai).

---

## A. KAAM KAR RAHA HAI — aur maine kaise verify kiya

| # | Item | Verification |
|---|---|---|
| 1 | **Address-join comma bug** | Code: `addrJoin()` empty parts ko `.filter()` se hata ke join karta hai (pdf-generate.js:55-57). `npm test` mein dedicated tests pass. |
| 2 | **Shared 'state' field bug** | Code: `s_state`/`b_state` ab do alag fields hain (field-mapping.js), comment mein purana bug aur fix dono documented hain. Test suite mein state-independence tests pass. |
| 3 | **Mobile validation (khali PDF)** | Code: `ui.js:845-853` — `need.has('mobile')` aur `need.has('b_mobile')` dono alag check hote hain, presence + `length===10` dono. Comment explicitly purane bug ko document karta hai. |
| 4 | **fmtDate() ordinal (21th/22th/31th)** | Code: `ordinalSuffix()` naya function, 11-13 exception handle karta hai. `test/fmt-date.test.js` mein 1-31 exhaustive test — sab pass. |
| 5 | **Model vs manufacture date** | Code: `mfg_date` naya field (forms-data.js), Worker ke RC prompt mein `manufacture_date` field + disambiguation rule (worker/src/index.js). Form 25/20/21 ke teeno `d.model`→`d.mfg_date` fix ho chuke. **Worker live deploy confirmed** (version `b20045a7`, is hi session mein `wrangler deploy` se). |
| 6 | **hPair() overlap — Form 27/27A/28** | Code: `hPair()` ek shared function hai (pdf-generate.js:765-777) jisme `MIN_PAIR_SIDE` overlap-guard hai — agar column mein jagah kam ho to automatically do stacked rows mein fall back karta hai. **Form 27, 27A, 28, 29 — sab isi ek function ko call karte hain**, isliye fix sabme ek saath aa gaya hai (per-form patch nahi tha). Maine specific PDF render karke visually check nahi kiya is pass mein — lekin ye ek shared library-level fix hai to bug alag-alag form mein alag hone ki gunjaish nahi hai. |
| 7 | (galat scope se hata — neeche "sabse zaroori" section mein) | — |
| — | **Consent checkbox upload se pehle** | Code: `pro-wallet.js` — 8 input ids (`CONSENT_GATED_INPUT_IDS`) `disabled` rehte hain jab tak `uploadConsentChk` check na ho; `onConsentChange()` unhe enable karta hai. Belt-and-suspenders double-check bhi hai (`handlePhotoUpload` khud consent check karta hai). |
| — | **Remove uploaded image option** | Code: `removeDoc()` function, `remove-<docType>` buttons har upload slot ke liye, confirm() dialog ke saath. |
| — | **Error states (extraction fail / balance kam / payment fail / network)** | Code: sab jagah `catch(err)` blocks hain jo i18n'd error messages dikhate hain (`err.networkRetry`, `err.extractionFailed`, `err.walletReset`, `err.verificationFailed`, order-create failure). |
| — | **i18n system** | Code: `i18n.js` — `I18N_STRINGS={en,hi}`, `t()`, `applyI18n()`, `setLang()` → localStorage. Is session ke earlier part mein browser mein live test kiya (EN→HI→EN round-trip, root + 5 task pages, modals). |
| — | **Camera + gallery alag buttons** | Code: har upload slot ke liye do `<input>` (capture wala + bina capture wala), dono same handler ko call karte hain. Camera button desktop pe CSS se hidden hai. |
| — | **Wallet balance read path (KV)** | **Live tested**: `GET /balance?token=...` deployed Worker par → `200 {"walletId":...,"balancePaise":0,...}` — Worker aur KV dono live aur reachable. |
| — | **Field mapping priority (RC vs Aadhaar)** | Code + tests: `AI_FIELD_MAP`, `mergeExtractedFields`, `FIELD_SOURCE_PRIORITY` — 5 scenario tests + reverse-order test, sab pass. |
| — | **npm test** | **54/54 pass, 0 fail** — is session mein khud chalaya. |

---

## B. ADHOORA YA TOOTA HAI

| Item | Detail |
|---|---|
| **Bug #7 — catch-all redirect** | **LIVE CONFIRMED BROKEN** on real prod domain (`rtoformsindia.com`, Cloudflare Pages) — dekho upar "sabse zaroori" section. |
| **MSG91 recovery-link** | **Live confirmed broken**: `POST /link/send` deployed Worker par → `500 {"error":"Server not configured (missing MSG91 credentials)"}`. Aapka shaq sahi tha — secret set nahi hai. Sirf "purana wallet wapas paao" recovery path affect hota hai — core wallet/payment/extraction bilkul theek chal rahe hain. |
| **README.md stale hai** | Confirmed by direct read — abhi bhi Puppeteer + `POST /api/generate` server-side pipeline describe karta hai, jo `server.js` mein maujood hi nahi hai. `CLAUDE.md` khud isko already flag karta hai, ab maine README.md khud padh ke confirm kiya. |
| **Dead code at repo root** | `form29.html`, `form30.html`, `affidavit.html` — na `index.html` na `server.js` inhe reference karta hai (CLAUDE.md khud confirm karta hai). `generate_pdf.py`, `overlay_pdf.py` — standalone Python scripts, request path mein wired nahi. |
| **Two parallel deployments** | Render (Express) aur Cloudflare Pages dono zinda hain, alag routing behavior ke saath. Ye confusion ka source hai — kal ko koi Express-side fix karega aur production (Pages) pe koi asar nahi padega, jaisa bug #7 mein hua. |
| **Canonical URL mismatch** | `index.html`'s canonical tag `rto-forms.onrender.com` bolta hai, real domain `rtoformsindia.com` hai — SEO ke liye galat (functionally CORS abhi nahi toड़ta, live-tested). |

---

## C. PATA NAHI CHALA — khud test karna padega

| Item | Kyun nahi pata chala |
|---|---|
| **`GEMINI_MODEL = "gemini-3.6-flash"`** (worker/src/index.js:60) | Ye model name mujhe kisi bhi known Google Gemini release se match nahi hota (mera knowledge cutoff Jan 2026 hai, aur ye session Aug 2026 mein chal raha hai — ho sakta hai ye ek naya legit model ho jo mere cutoff ke baad release hua). Live verify karne ke liye Gemini API key chahiye — mere paas nahi hai. **Aap ek real RC/Aadhaar photo upload karke dekho ki extraction kaam karta hai ya "model not found" jaisi error aati hai.** |
| **Razorpay keys (`RAZORPAY_KEY_ID`/`SECRET`) set hain ya nahi** | Maine jaan-boojh ke live `/order` call nahi kiya — isse aapke Razorpay dashboard mein ek real test order ban jaata (financial-adjacent side effect), jo is read-only audit ke scope se bahar hai. **Cloudflare dashboard → Worker → Settings → Variables mein khud check kar lo.** |
| **MSG91 credentials ke alawa — poora recovery flow end-to-end** | `/link/send` ka 500 confirm kiya, lekin `/link/claim/<token>` ka poora flow (agar kabhi ek valid token mil jaaye) test nahi kiya — kyunki `/link/send` khud hi fail ho raha hai, ek valid token generate hi nahi ho sakta abhi. |
| **`forms/` local folder** (blank official PDFs) | Code mein `USE_LOCAL` check hai (HEAD request `/forms/FORM-29.pdf`), lekin maine ye nahi dekha ki `forms/` folder actual mein populate hai ya khali — agar khali hai to blank-PDF downloads parivahan.gov.in pe fallback karenge (jo bhi theek hi hai, bas confirm nahi kiya). |
| **PDF page picker (multi-page PDF upload)** | Code mein logic dikha (pro-wallet.js mein PDF-specific handling), lekin ek real multi-page PDF upload karke UI mein test nahi kiya. |
| **Add-more-forms suggestions (`BUNDLES[].suggest`)** | Data confirm hai (8 bundles: b_transfer, b_rcrenew, b_duprc, b_death, b_hp, b_hpremove, b_address, b_newreg), lekin UI mein actually suggestion dikhta hai aur click karne pe sahi form add hota hai — browser mein test nahi kiya is pass mein. |

---

## Numbers (forms-data.js se)

- **Total forms**: 41
- **Fill online**: 27
- **Download blank only**: 14
- **Fillable packs (PICKS)**: 31
- **Task pages**: 5 — `/vehicle-transfer`, `/rc-renewal`, `/duplicate-rc`, `/hp-removal`, `/address-change`
- **Legal pages**: `privacy-policy.html` (12.7KB), `terms-of-service.html` (9.7KB), `refund-policy.html` (6.9KB), `contact-us.html` (7.5KB) — sab non-trivial size mein maujood hain, content ek-ek line padh ke fact-check nahi kiya.

## Test suite

`npm test` → **54 pass, 0 fail** (Node's built-in `node --test`, 7 files under `test/`).
