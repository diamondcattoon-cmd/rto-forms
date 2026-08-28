/* ════════ I18N — English default, Hinglish toggle ════════
   Single source of truth for every piece of translatable UI copy on the
   site. Loads FIRST (before field-mapping.js/pdf-generate.js/forms-data.js/
   ui.js/pro-wallet.js) so `t()` is already a global by the time any other
   script runs — several of them call it directly inside dynamically-built
   strings (status messages, error messages, catalog cards).

   What is NOT in here, on purpose (per the "same in both languages" rule):
   - Form names and field labels — those live in forms-data.js (FORMS/
     FIELDS), already a single source of truth, and never change with
     language (the printed government form is English; the on-screen
     label has to match it, or a user comparing screen to paper gets
     confused).
   - Everything pdf-generate.js draws onto an actual PDF — always English,
     it's reproducing an official government form.
   - Page <title>/meta description — always English, for SEO.
   - FAQ answers, "How it works" steps, and the footer legal disclaimer —
     long-form SEO/informational prose, deliberately left English-only in
     this pass (not wired to data-i18n at all).

   Usage:
   - Static HTML: `<h4 data-i18n="ai.title">Fill with AI</h4>` — applyI18n()
     (called once at the bottom of this file, and again from setLang())
     walks every [data-i18n]/[data-i18n-placeholder]/[data-i18n-title]/
     [data-i18n-aria] element and fills it in from the current language.
   - JS-rendered text: call `t('key')` (or `t('key', {n: 3})` for a string
     with a `{n}`-style placeholder) directly inside the template string —
     ui.js/pro-wallet.js load after this file, so `t` is always available. */

const I18N_STRINGS = {
  en: {
    /* ── small grammar words (used inside composed status/error strings) ── */
    'word.and': 'and',
    'word.hai': 'is',
    'word.hain': 'are',

    /* ── header ── */
    'nav.allForms': 'All Forms',
    'nav.calc': 'Tax Calculator',
    'nav.how': 'How it works',
    'nav.faq': 'FAQ',
    'nav.fill': 'Fill Forms →',
    'lang.en': 'EN',
    'lang.hi': 'Hinglish',

    /* ── landing hero (root only) ── */
    'hero.eyebrow': '// India’s RTO paperwork, simplified',
    'hero.title1': 'Every RTO form.',
    'hero.title2': 'Filled online, ',
    'hero.titleAccent': 'print-ready',
    'hero.title3': ' in minutes.',
    'hero.sub': 'RTO Forms India is a free online filler for Motor Vehicles Act forms. Type the details once and download submission-ready A4 PDFs — or print blank forms to fill by hand. No login, no fees, and your data never leaves your browser.',
    'hero.ctaStart': 'Start filling forms',
    'hero.ctaBrowse': 'Browse all forms',
    'hero.stat.forms': 'Forms, serial-wise',
    'hero.stat.fillable': 'Fillable online now',
    'hero.stat.free': 'Completely free',
    'hero.stat.login': 'Login required',
    'hero.stat.pdfs': 'Filled or blank PDFs',

    /* ── root landing tool section (old-style layout, root only) ── */
    'root.toolTitle': 'Fill RTO forms online',
    'root.toolSub': 'Enter the details once and tick any combination of forms — transfer set, NOC, RC renewal, DL renewal, permits and more. Everything downloads as one print-ready PDF. Need empty forms? Use the blank download.',
    'root.toolHeadH3': 'RTO Form Filler — Any Combination',
    'root.toolHeadP': 'Tick the forms you need — one print-ready PDF',
    'root.quickStart': 'Quick start — pick a task',
    'root.quickStartNote': 'Pick a task and its related forms are selected automatically. Or choose any combination manually below.',
    'root.formsInclude': 'Forms to include in the PDF',
    'root.formsIncludeNote': 'The sections below build themselves from the selected forms — only the fields those forms actually use will appear. Select multiple forms (across categories) and every needed field is added once, shared across all of them.',
    'root.addMoreForms': 'Add more forms — often needed together',
    'root.addMoreNote': 'Fills from the same details — no extra charge to add one.',
    'root.autoFillTitle': 'Auto-fill from documents',
    'root.autoFillDesc': 'Upload a clear photo of your Aadhaar / PAN / RC — name, address, reg. no, chassis/engine no. and more fill in automatically. Each extraction costs ₹5.',
    'root.uploadInstructions': 'Upload a document, then hit "Extract" — if your balance is low the payment window opens automatically (₹5/extraction), enter your number there. Pick whose Aadhaar/PAN it is right on the card.',
    'root.downloadBlank': 'Download blank forms',

    /* ── task head (task pages only) ── */
    'task.addForms': '+ Add forms',
    'task.addFormsMobile': '+ Need more forms?',
    'task.settings': 'Settings',
    'task.vehicletransfer.sub': 'Form 29, 30 and affidavits — in one PDF',
    'task.rcrenewal.sub': 'Form 25 — a print-ready PDF, filled online',
    'task.duplicaterc.sub': 'Form 26 — a print-ready PDF, filled online',
    'task.hpremoval.sub': 'Form 35 — a print-ready PDF, filled online',
    'task.addresschange.sub': 'Form 33 — a print-ready PDF, filled online',

    /* ── AI box ── */
    'ai.title': 'Fill with AI',
    'ai.subtitle': 'Upload your RC photo — fields will fill automatically, no typing needed',
    'ai.start': 'Get started',
    'ai.freeLine': '— or fill it in yourself below, free —',
    'ai.pickerHead': 'Add a photo of your RC, Aadhaar or PAN',
    'ai.consent': 'I confirm I am the authorized holder of this document (Aadhaar/PAN/RC). I understand its photo is sent to the Google Gemini API for extraction and is not stored on our server — I have read the <a href="/privacy-policy.html" target="_blank" rel="noopener">Privacy Policy</a>.',
    'ai.emptyNote': 'Select forms above — only the documents relevant to them will show here.',
    'ai.rcNote': 'RC fills in the seller’s details',
    'ai.whoseDoc': 'Whose is this?',
    'ai.seller': 'Seller',
    'ai.buyer': 'Buyer',
    'ai.frontSide': 'Front side',
    'ai.backSide': 'Back side (optional)',
    'ai.notUploaded': 'Not uploaded',
    'ai.previewReady': 'Preview ready',
    'ai.consentHint': 'Give consent above to upload ↑',
    'ai.takePhoto': '📷 Take photo',
    'ai.chooseFile': '📁 Choose file',
    'ai.remove': '✕ Remove',
    'ai.removeConfirm': 'Removing this will empty the fields it filled in. The ₹5 already charged is not refunded.',
    'ai.addMoney': '+ Add Money',
    'ai.balancePrefix': 'You have ₹{n}',
    'ai.addFifty': '+ Add ₹50',
    'ai.recoveryToggle': 'Need your old wallet back on this device?',
    'ai.recoveryPlaceholder': '98XXXXXXXX',
    'ai.recoverySend': 'Send recovery link',
    'ai.recoveryHint': 'Enter the number you paid with — an SMS link will arrive, click it on that same phone (valid 30 min, single use).',
    'ai.photoToggle': '+ Attach a face photo to the PDF too? (optional)',
    'ai.attachChk': 'Attach uploaded documents & photo as extra pages in the final PDF',
    'ai.facePhoto': 'Face Photo',
    'ai.summaryMore': 'view / add more →',
    'ai.pageN': 'Page {n}',
    'ai.payExtract': 'Pay & Extract',
    'ai.checkoutNote': '₹5 per document — only charged on a successful extraction, nothing charged if it fails.',
    'checkout.rowTotal': '{n} document{s} × ₹5',
    'checkout.upTo': 'up to ₹{total}',
    'checkout.payBtn1': 'Pay ₹5 and fill fields',
    'checkout.payBtnN': 'Pay up to ₹{total} and fill fields',
    'status.allExtracted': 'All uploaded documents have been extracted.',
    'status.batchSucceeded': '✓ {n} document{s} extracted — ₹{amt} charged. ',
    'status.batchFailed': '✗ {n} failed — not charged, ₹{amt} still in your wallet. Use that document’s "Retry" button to try again. ',

    /* ── Add Forms panel ── */
    'addforms.title': 'Add forms',
    'addforms.switchTitle': 'Doing something else instead?',
    'addforms.suggestTitle': 'Suggested — often needed together',
    'addforms.allTitle': 'All forms',

    /* ── bottom actions ── */
    'bottom.preview': 'Preview',
    'bottom.blankLink': 'Need a blank form? Download the empty PDF',

    /* ── preview modal ── */
    'preview.title': 'Preview — nothing downloaded yet',

    /* ── buy money modal ── */
    'modal.buyTitle': 'Add Money to Wallet',
    'modal.buySub': 'Instant via UPI / card — no waiting. ₹5 is charged per document extraction.',
    'modal.orCustom': 'Or a custom amount',
    'modal.pay': 'Pay',
    'modal.extractions10': '10 extractions',
    'modal.extractions20': '20 extractions',
    'modal.extractions40': '40 extractions',

    /* ── settings modal ── */
    'modal.settingsTitle': 'Settings',
    'modal.settingsSub': 'These preferences are saved in this browser — they’ll apply automatically next time you open the site (your current selection won’t change).',
    'modal.defaultTitle': 'What should be selected by default when the site opens?',
    'modal.alwaysTitle': 'Always include these forms',
    'modal.alwaysSub': 'Alongside whichever default you pick above, these stay checked too — e.g. a Money Receipt or Delivery Note.',
    'modal.fontTitle': 'PDF font style',
    'modal.fontHelvetica': 'Helvetica',
    'modal.fontDefault': '(default)',
    'modal.fontTimes': 'Times New Roman',
    'modal.fontCourier': 'Courier',
    'modal.amountPlaceholder': 'e.g. 150',
    'modal.reset': 'Reset all settings',

    /* ── restore notice ── */
    'restore.msg': 'We restored your previous data.',
    'restore.clear': 'Clear',

    /* ── forms catalog (root) ── */
    'catalog.noMatch': 'No forms match your search. Try a form number (e.g. 26) or a word like "duplicate", "renewal", "NOC".',
    'catalog.selectAbove': 'select forms above',
    'catalog.searchPlaceholder': 'Search by form number or purpose — e.g. 26, duplicate, NOC, renewal…',

    /* ── tax calculator (root) ── */
    'calc.placeholder': 'Enter the ex-showroom price — the estimate will appear here.',

    /* ── error / validation messages ── */
    'err.selectForm': 'Select at least one form to include.',
    'err.ownerName': 'Owner / Seller name is required.',
    'err.regNo': 'Registration No. is required for the selected forms.',
    'err.buyerName': 'Purchaser name is required for the selected transfer / sale forms.',
    'err.mobile': 'Mobile number is required — please enter it before generating the PDF.',
    'err.mobileDigits': 'Mobile number must be exactly 10 digits.',
    'err.buyerMobile': 'Purchaser mobile number is required — please enter it before generating the PDF.',
    'err.buyerMobileDigits': 'Purchaser mobile number must be exactly 10 digits.',
    'err.generic': 'Error: {msg}',
    'err.validMobile': 'Enter a valid 10-digit mobile number.',
    'err.networkRetry': 'Network error — try again.',
    'err.walletReset': 'Wallet was reset — please try again.',
    'err.linkExpired': 'Link is invalid or has expired — request a new one.',
    'err.amount': 'Enter a valid amount.',
    'err.verificationFailed': 'Verification failed',

    /* ── status messages ── */
    'status.previewReady': 'Preview ready — nothing downloaded yet.',
    'status.blankDownloaded': 'Blank forms downloaded — {n} empty form(s) ready to print and fill by hand.',
    'status.pdfDownloaded': 'PDF downloaded — {n} filled form(s) ready. Print, stamp and submit.',
    'status.loadingPreview': 'Loading preview...',
    'status.pdfPagePicker': 'This PDF has {n} pages — choose the right one:',
    'status.pdfReadError': 'Could not read the PDF: {msg}',
    'ai.extractingBadge': 'Extracting...',
    'status.extracted': 'Extracted ✓',
    'status.failed': 'Failed',
    'status.retry': 'Retry {label} (₹5)',
    'status.reading': 'Reading...',
    'status.uploaded': 'Uploaded ✓',
    'status.needBalance': '₹5 needed for {label} — balance is low, opening payment window...',
    'err.extractionFailed': 'Extraction failed',
    'status.extractingDoc': '{label} extraction in progress...',
    'status.extractedOk': '{label} extracted and auto-filled. Balance: ₹{bal}',
    'status.reviewAmber': '{n} field{s} filled from {docs} — check the highlighted boxes.',
    'status.packageSummary': 'This package has {n} field{s}, {empty} still empty.',
    'status.docsExtractedSummary': '{n} document{s} filled {filled} field{fs} ✓',
    'status.linkSending': 'Sending link...',
    'status.linkSent': 'Recovery link sent to {mobile} — open the SMS on that same phone and click the link (valid 30 min).',
    'status.noWalletFound': 'No wallet is linked to this number. If this is your first time, just upload a document and try extraction — a wallet is created automatically at payment.',
    'status.linkError': 'Error sending link.',
    'status.recovering': 'Recovering...',
    'status.walletRecovered': 'Wallet recovered ✓ Balance: ₹{bal}',
    'status.paymentStarting': 'Starting payment...',
    'status.paymentConfirming': 'Confirming payment...',
    'status.amountAdded': '₹{n} added! Balance: ₹{bal}',
    'status.paymentUnconfirmed': 'Payment went through but could not be confirmed: {msg}. Refresh and check your balance.',
    'status.paymentFailed': 'Payment failed: {reason}{extra}. ',
    'status.unknownReason': 'reason unknown',
    'status.retryBtn': 'Retry',
    'status.included': 'Included in your PDF',
    'status.noExtraFields': 'No extra fields needed',
    'status.sameDetails': 'Fills from the same details, no extra charge',
    'status.balancePartial': 'Balance ran out — top up with "Add Money" then hit "Pay & Extract" again for the rest.',
    'conflict.differs': '{winner} and {loser} disagree — using {winner}’s value.',
    'conflict.useOther': 'Use {loser}’s value instead',
  },

  hi: {
    /* ── small grammar words (used inside composed status/error strings) ── */
    'word.and': 'aur',
    'word.hai': 'hai',
    'word.hain': 'hain',

    /* ── header ── */
    'nav.allForms': 'All Forms',
    'nav.calc': 'Tax Calculator',
    'nav.how': 'How it works',
    'nav.faq': 'FAQ',
    'nav.fill': 'Fill Forms →',
    'lang.en': 'EN',
    'lang.hi': 'Hinglish',

    /* ── landing hero (root only) ── */
    'hero.eyebrow': '// India ka RTO paperwork, simplified',
    'hero.title1': 'Har RTO form.',
    'hero.title2': 'Online bhro, ',
    'hero.titleAccent': 'print-ready',
    'hero.title3': ' minutes mein.',
    'hero.sub': 'RTO Forms India — Motor Vehicles Act forms bharne ka free online tool. Details ek baar type karo aur submission-ready A4 PDF download karo — ya blank forms print karke haath se bhar lo. No login, no fees, aur aapka data browser se bahar kabhi nahi jaata.',
    'hero.ctaStart': 'Forms bharna shuru karo',
    'hero.ctaBrowse': 'Saare forms dekho',
    'hero.stat.forms': 'Forms, serial-wise',
    'hero.stat.fillable': 'Abhi online fillable',
    'hero.stat.free': 'Bilkul free',
    'hero.stat.login': 'Login chahiye',
    'hero.stat.pdfs': 'Bhara ya khaali PDF',

    /* ── root landing tool section (old-style layout, root only) ── */
    'root.toolTitle': 'RTO forms online bharo',
    'root.toolSub': 'Details ek baar daalo aur kisi bhi combination ke forms tick karo — transfer set, NOC, RC renewal, DL renewal, permits aur bhi bahut kuch. Sab kuch ek hi print-ready PDF mein download hota hai. Khaali forms chahiye? Blank download use karo.',
    'root.toolHeadH3': 'RTO Form Filler — Any Combination',
    'root.toolHeadP': 'Jo forms chahiye tick karo — ek print-ready PDF',
    'root.quickStart': 'Quick start — ek task chuno',
    'root.quickStartNote': 'Ek task chuno — related forms apne aap select ho jaate hain. Ya neeche se manually koi bhi combination choose karo.',
    'root.formsInclude': 'Forms to include in the PDF',
    'root.formsIncludeNote': 'Neeche ke sections selected forms se khud ban jaate hain — sirf wahi fields dikhenge jo un forms mein chahiye. Kai forms (alag categories se bhi) select karo, har zaroori field ek hi baar add hoga, sab mein shared.',
    'root.addMoreForms': 'Add more forms — often needed together',
    'root.addMoreNote': 'Same details se fill hote hain — add karne ka koi extra charge nahi.',
    'root.autoFillTitle': 'Auto-fill from documents',
    'root.autoFillDesc': 'Aadhaar / PAN / RC ki clear photo upload karo — naam, address, reg. no, chassis/engine no. jaisi details apne aap fields mein fill ho jayengi. Har extraction ₹5 leta hai.',
    'root.uploadInstructions': 'Document upload karke seedha "Extract" dabao — balance kam hone par payment window khud khul jayega (₹5/extraction), usi mein apna number daalna. Aadhaar/PAN par kiska document hai wo waheen select karo.',
    'root.downloadBlank': 'Download blank forms',

    /* ── task head (task pages only) ── */
    'task.addForms': '+ Add forms',
    'task.addFormsMobile': '+ Aur forms chahiye?',
    'task.settings': 'Settings',
    'task.vehicletransfer.sub': 'Form 29, 30 aur affidavits — ek PDF mein',
    'task.rcrenewal.sub': 'Form 25 — ek print-ready PDF mein',
    'task.duplicaterc.sub': 'Form 26 — ek print-ready PDF mein',
    'task.hpremoval.sub': 'Form 35 — ek print-ready PDF mein',
    'task.addresschange.sub': 'Form 33 — ek print-ready PDF mein',

    /* ── AI box ── */
    'ai.title': 'AI se bhar do',
    'ai.subtitle': 'RC ki photo daalo — fields khud bhar jaayenge, typing nahi karni padegi',
    'ai.start': 'Shuru karo',
    'ai.freeLine': '— ya neeche khud bhar lo, free —',
    'ai.pickerHead': 'RC, Aadhaar ya PAN ki photo daalo',
    'ai.consent': 'Main confirm karta/karti hoon ki main is document (Aadhaar/PAN/RC) ka authorized user hoon. Main samajhta/samajhti hoon ki iski photo, extraction ke liye Google Gemini API ko bheji jaati hai aur hamare server par store nahi hoti — <a href="/privacy-policy.html" target="_blank" rel="noopener">Privacy Policy</a> padh li hai.',
    'ai.emptyNote': 'Upar se forms select karo — us hisab se yahan sirf relevant documents dikhenge.',
    'ai.rcNote': 'RC se seller ki details bharenge',
    'ai.whoseDoc': 'Kiska hai?',
    'ai.seller': 'Seller',
    'ai.buyer': 'Buyer',
    'ai.frontSide': 'Front side',
    'ai.backSide': 'Back side (optional)',
    'ai.notUploaded': 'Not uploaded',
    'ai.previewReady': 'Preview ready',
    'ai.consentHint': 'Upload karne ke liye upar consent dein ↑',
    'ai.takePhoto': '📷 Photo kheecho',
    'ai.chooseFile': '📁 File chuno',
    'ai.remove': '✕ Hatao',
    'ai.removeConfirm': 'Isse hatane par bhare hue fields khali ho jaayenge. Paisa wapas nahi hoga.',
    'ai.addMoney': '+ Add Money',
    'ai.balancePrefix': 'Aapke paas ₹{n} hai',
    'ai.addFifty': '+ ₹50 add karo',
    'ai.recoveryToggle': 'Purana wallet is device pe wapas chahiye?',
    'ai.recoveryPlaceholder': '98XXXXXXXX',
    'ai.recoverySend': 'Recovery link bhejo',
    'ai.recoveryHint': 'Jis number se payment kiya tha wo daalo — SMS mein ek link aayega, usi phone pe click karo (30 min valid, ek hi baar use hota hai).',
    'ai.photoToggle': '+ Face photo bhi attach karni hai PDF mein? (optional)',
    'ai.attachChk': 'Uploaded documents aur photo final PDF mein extra pages ki tarah attach karo',
    'ai.facePhoto': 'Face Photo',
    'ai.summaryMore': 'dekho / aur jodo →',
    'ai.pageN': 'Page {n}',
    'ai.payExtract': 'Pay & Extract',
    'ai.checkoutNote': '₹5 per document — sirf successful extraction par katta hai, fail hone par kuch nahi katta.',
    'checkout.rowTotal': '{n} document{s} × ₹5',
    'checkout.upTo': 'up to ₹{total}',
    'checkout.payBtn1': '₹5 pay karo, fields bhar jayengi',
    'checkout.payBtnN': '₹{total} tak pay karo, fields bhar jayengi',
    'status.allExtracted': 'Sab uploaded documents extract ho chuke hain.',
    'status.batchSucceeded': '✓ {n} document{s} extract ho gaye — ₹{amt} charge hua. ',
    'status.batchFailed': '✗ {n} fail ho gaye — charge nahi hua, ₹{amt} wallet mein hi hai. Us document ke "Retry" button se dobara try karo. ',

    /* ── Add Forms panel ── */
    'addforms.title': 'Forms jodo',
    'addforms.switchTitle': 'Kuch aur kaam kar rahe ho?',
    'addforms.suggestTitle': 'Suggested — aksar saath chahiye hote hain',
    'addforms.allTitle': 'Saare forms',

    /* ── bottom actions ── */
    'bottom.preview': 'Preview',
    'bottom.blankLink': 'Blank form chahiye? Empty PDF download karo',

    /* ── preview modal ── */
    'preview.title': 'Preview — nothing downloaded yet',

    /* ── buy money modal ── */
    'modal.buyTitle': 'Add Money to Wallet',
    'modal.buySub': 'UPI / card se turant add ho jayega — koi wait nahi. ₹5 per document extraction katega.',
    'modal.orCustom': 'Ya custom amount',
    'modal.pay': 'Pay',
    'modal.extractions10': '10 extractions',
    'modal.extractions20': '20 extractions',
    'modal.extractions40': '40 extractions',

    /* ── settings modal ── */
    'modal.settingsTitle': 'Settings',
    'modal.settingsSub': 'Ye preferences is browser mein save ho jaati hain — agli baar site khologe to automatically apply hongi (abhi ki selection change nahi hogi).',
    'modal.defaultTitle': 'Site kholne par default kya selected ho?',
    'modal.alwaysTitle': 'Ye forms hamesha extra include karo',
    'modal.alwaysSub': 'Upar wale default ke saath-saath, ye bhi hamesha check rahenge — jaise Money Receipt ya Delivery Note.',
    'modal.fontTitle': 'PDF font style',
    'modal.fontHelvetica': 'Helvetica',
    'modal.fontDefault': '(default)',
    'modal.fontTimes': 'Times New Roman',
    'modal.fontCourier': 'Courier',
    'modal.amountPlaceholder': 'e.g. 150',
    'modal.reset': 'Reset all settings',

    /* ── restore notice ── */
    'restore.msg': 'Aapka pichla data restore kar diya.',
    'restore.clear': 'Clear karo',

    /* ── forms catalog (root) ── */
    'catalog.noMatch': 'Koi form match nahi hua. Form number try karo (jaise 26) ya koi word jaise "duplicate", "renewal", "NOC".',
    'catalog.selectAbove': 'upar se forms select karo',
    'catalog.searchPlaceholder': 'Form number ya purpose se search karo — jaise 26, duplicate, NOC, renewal…',

    /* ── tax calculator (root) ── */
    'calc.placeholder': 'Ex-showroom price daalo — estimate yahan dikhega.',

    /* ── error / validation messages ── */
    'err.selectForm': 'Kam se kam ek form select karo.',
    'err.ownerName': 'Owner / Seller ka naam zaroori hai.',
    'err.regNo': 'Selected forms ke liye Registration No. zaroori hai.',
    'err.buyerName': 'Transfer/sale forms ke liye Purchaser ka naam zaroori hai.',
    'err.mobile': 'Mobile number zaroori hai — PDF banane se pehle daal do.',
    'err.mobileDigits': 'Mobile number pura 10 digit ka hona chahiye.',
    'err.buyerMobile': 'Purchaser ka mobile number zaroori hai — PDF banane se pehle daal do.',
    'err.buyerMobileDigits': 'Purchaser ka mobile number pura 10 digit ka hona chahiye.',
    'err.generic': 'Error aaya: {msg}',
    'err.validMobile': 'Valid 10-digit mobile number daalo.',
    'err.networkRetry': 'Network error — dobara try karo.',
    'err.walletReset': 'Wallet reset ho gaya — dobara try karo.',
    'err.linkExpired': 'Link invalid ya expire ho chuka hai — naya link mangwao.',
    'err.amount': 'Sahi amount daalo.',
    'err.verificationFailed': 'Verification fail ho gayi',

    /* ── status messages ── */
    'status.previewReady': 'Preview ready hai — abhi kuch download nahi hua.',
    'status.blankDownloaded': 'Blank forms download ho gaye — {n} khaali form print karke haath se bhar sakte ho.',
    'status.pdfDownloaded': 'PDF download ho gaya — {n} bhara hua form ready hai. Print karo, stamp lagao, submit karo.',
    'status.loadingPreview': 'Preview load ho raha hai...',
    'status.pdfPagePicker': 'Is PDF mein {n} pages hain — sahi page choose karo:',
    'status.pdfReadError': 'PDF read nahi ho paayi: {msg}',
    'ai.extractingBadge': 'Extracting...',
    'status.extracted': 'Extracted ✓',
    'status.failed': 'Failed',
    'status.retry': 'Retry {label} (₹5)',
    'status.reading': 'Reading...',
    'status.uploaded': 'Uploaded ✓',
    'status.needBalance': '₹5 chahiye {label} ke liye, balance kam hai — payment window khul raha hai...',
    'err.extractionFailed': 'Extraction fail ho gayi',
    'status.extractingDoc': '{label} se data extract ho raha hai...',
    'status.extractedOk': '{label} se data auto-fill ho gaya. Balance: ₹{bal}',
    'status.reviewAmber': '{n} field{s} {docs} se bhare — highlighted boxes check kar lo.',
    'status.packageSummary': 'Is package mein {n} field{s} hain, {empty} abhi khali {hai}.',
    'status.docsExtractedSummary': '{n} document{s} se {filled} field{fs} bhare ✓',
    'status.linkSending': 'Link bhej rahe hain...',
    'status.linkSent': 'Recovery link bhej diya {mobile} par — SMS kholke usi phone pe link click karo (30 min valid).',
    'status.noWalletFound': 'Is number se koi wallet linked nahi mila. Pehli baar hai to seedha document upload karke extract try karo — payment ke waqt wallet ban jayega.',
    'status.linkError': 'Link bhejne mein error aaya.',
    'status.recovering': 'Recover ho raha hai...',
    'status.walletRecovered': 'Wallet recover ho gaya ✓ Balance: ₹{bal}',
    'status.paymentStarting': 'Payment shuru ho raha hai...',
    'status.paymentConfirming': 'Payment confirm ho raha hai...',
    'status.amountAdded': '₹{n} add ho gaye! Balance: ₹{bal}',
    'status.paymentUnconfirmed': 'Payment hua par confirm nahi ho paya: {msg}. Refresh karke balance check karo.',
    'status.paymentFailed': 'Payment fail ho gaya: {reason}{extra}. ',
    'status.unknownReason': 'Wajah pata nahi chali',
    'status.retryBtn': 'Retry',
    'status.included': 'Aapke PDF mein shaamil hai',
    'status.noExtraFields': 'Koi extra field nahi chahiye',
    'status.sameDetails': 'Same details se ban jayega, extra charge nahi',
    'status.balancePartial': 'Balance kam pad gaya — baaki documents ke liye "Add Money" karke phir "Pay & Extract" dabao.',
    'conflict.differs': '{winner} aur {loser} ka data alag hai — {winner} wala bhara gaya.',
    'conflict.useOther': '{loser} wala use karo',
  },
};

/* Default English. Persisted per-browser; setLang() below is the only
   writer (also invoked by index.html's/every task page's #langToggle). */
let I18N_LANG = 'en';
try {
  const saved = localStorage.getItem('rtoLang');
  if (saved === 'hi' || saved === 'en') I18N_LANG = saved;
} catch (e) {}

function t(key, vars) {
  const dict = I18N_STRINGS[I18N_LANG] || I18N_STRINGS.en;
  let s = (key in dict) ? dict[key] : (I18N_STRINGS.en[key] !== undefined ? I18N_STRINGS.en[key] : key);
  if (vars) {
    Object.keys(vars).forEach(k => { s = s.split('{' + k + '}').join(vars[k]); });
  }
  return s;
}

/* Walks data-i18n[-placeholder|-title|-aria] elements and fills them from
   the current language. Safe to call repeatedly (setLang() re-runs it after
   a reload) and safe to scope to a subtree (root arg) for anything rendered
   after the initial pass — nothing in this codebase currently needs that,
   but it costs nothing to support. innerHTML (not textContent) for the
   plain data-i18n case, since ai.consent embeds a <a> link. */
function applyI18n(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-i18n]').forEach(el => {
    el.innerHTML = t(el.getAttribute('data-i18n'));
  });
  scope.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
  scope.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.getAttribute('data-i18n-title'));
  });
  scope.querySelectorAll('[data-i18n-aria]').forEach(el => {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
  });
  const toggle = document.getElementById('langToggle');
  if (toggle) {
    toggle.querySelectorAll('.lang-opt').forEach(btn => {
      btn.classList.toggle('on', btn.getAttribute('data-lang') === I18N_LANG);
    });
  }
}

/* A full reload (rather than re-rendering every dynamically-built section
   live) is deliberate — this codebase builds a lot of its UI via direct
   innerHTML template strings scattered across ui.js/pro-wallet.js
   (buildBundles, renderForms, updateSections, renderSuggestions,
   updateCheckoutBox, ...). Re-invoking every one of those in the right
   order on a live toggle would be fragile and easy to leave something
   stale; a reload guarantees every string — static and dynamic — comes
   back correctly in the new language, at the cost of a page refresh on
   the (rare) action of changing language. */
function setLang(lang) {
  I18N_LANG = (lang === 'hi') ? 'hi' : 'en';
  try { localStorage.setItem('rtoLang', I18N_LANG); } catch (e) {}
  location.reload();
}

/* i18n.js is deliberately the FIRST script (so `t()` exists before
   ui.js/pro-wallet.js run) — but that means it executes before the rest
   of the HTML after it, including the buy-money/settings/PDF-preview
   modals near the very end of <body>, has even been parsed into the DOM.
   Calling applyI18n() immediately here would silently skip every
   [data-i18n] element that hadn't been parsed yet. DOMContentLoaded fires
   only once the whole document (script tags included) has finished
   parsing, so deferring to it is what actually catches everything. */
document.addEventListener('DOMContentLoaded', () => applyI18n());
