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
    'nav.packages': 'Packages',
    'nav.allForms': 'All Forms',
    'nav.calc': 'Tax Calculator',
    'nav.how': 'How it works',
    'nav.faq': 'FAQ',
    'nav.fill': 'Fill Forms →',
    'lang.en': 'EN',
    'lang.hi': 'Hinglish',

    /* ── landing (root only) — hero, packages, catalogue, trust strip ── */
    'landing.hero.title': 'Every RTO form you need, in one place',
    'landing.hero.sub': 'Fill official Motor Vehicles Act forms online and download a print-ready PDF. All are 100% FREE and easy to use — transfer, renewal, duplicate RC, hypothecation and more, with just a few clicks.',
    'landing.searchPlaceholder': 'Search forms, affidavits, or a task…',
    'landing.noResultsFor': 'No results for "{q}"',
    'landing.noResultsHint': "Need this form? Tell us on WhatsApp and we'll add it.",
    'landing.whatsappCta': 'Message on WhatsApp',
    'landing.packagesTitle': 'Start with a package',
    'landing.packagesSub': 'One set of details fills every form the job needs.',
    'landing.allFormsTitle': 'All {n} forms',
    'landing.allFormsSub': 'Fill online, or download the blank official format.',
    'landing.allCount': 'All {n}',
    'landing.formCount': '{n} form{s}',
    'landing.fillOnline': 'Fill online',
    'landing.downloadBlank': 'Download blank',
    'landing.cat.registration': 'Registration',
    'landing.cat.transfer': 'Transfer',
    'landing.cat.licence': 'Licence',
    'landing.cat.permit': 'Permit',
    'landing.cat.misc': 'Other',
    'landing.trust1': 'No login required',
    'landing.trust2': 'Data stays in your browser',
    'landing.trust3': '{n} forms covered',
    'landing.trust4': 'Free to use',
    /* package card descriptions — always English, no Hinglish, per spec */
    'landing.pkg.b_transfer': 'Transfer a vehicle to a new owner',
    'landing.pkg.b_rcrenew': 'Renew your registration certificate',
    'landing.pkg.b_duprc': 'Get a duplicate registration certificate',
    'landing.pkg.b_hpremove': 'Remove hypothecation after loan closure',
    'landing.pkg.b_address': 'Update address on your RC',
    'landing.pkg.b_death': "Transfer ownership after owner's death",

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
    'root.uploadInstructions': 'Upload your RC, then hit "Extract" — if your balance is low the payment window opens automatically (₹5/extraction), enter your number there. Aadhaar/PAN just need to be attached to your PDF — they aren\'t extracted, and need no consent.',
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
    'task.transferondeath.sub': 'Form 31 — a print-ready PDF, filled online',

    /* ── AI box ── */
    'ai.title': 'Fill with AI',
    'ai.subtitle': "Upload your RC and we'll fill the vehicle details for you.",
    'ai.start': 'Get started',
    'ai.freeLine': '— or fill it in yourself below, free —',
    'ai.pickerHead': 'Add a photo of your RC, Aadhaar or PAN',
    'ai.consent': 'I confirm I am the authorised holder of this document. I understand the RC photo is sent to the Google Gemini API for extraction and is not stored on our server — I have read the <a href="/privacy-policy.html" target="_blank" rel="noopener">Privacy Policy</a>.',
    'ai.emptyNote': 'Select forms above — only the documents relevant to them will show here.',
    'ai.rcNote': 'RC fills in the seller’s details',
    'ai.fillsAutomatically': 'Fills the form automatically',
    'ai.attachedOnly': 'Attached to your PDF',
    'ai.attachPhotoChk': 'Attach photo',
    'ai.vehicleGroup': 'Vehicle',
    'ai.sellerGroup': 'Seller (Transferor)',
    'ai.buyerGroup': 'Buyer (Transferee)',
    'ai.attachmentGroup': 'Attachment Only',
    'ai.frontSide': 'Front side',
    'ai.backSide': 'Back side (optional)',
    'ai.notUploaded': 'Not uploaded',
    'ai.previewReady': 'Preview ready',
    'ai.consentHint': 'Give consent above to upload ↑',
    'ai.takePhoto': '📷 Take photo',
    'ai.chooseFile': '📁 Choose file',
    'ai.remove': '✕ Remove',
    'ai.removeConfirm': 'Removing this will empty the fields it filled in. Any amount already charged is not refunded.',
    'ai.addMoney': '+ Add Money',
    /* ── Aadhaar Secure QR — auto-detected from the buyer's Aadhaar photo
       right after upload (attemptAadhaarQrFromUpload(), aadhaar-qr-scan.js)
       — no button, no separate step. Always English, no Hinglish, per
       spec. Same text in both language blocks. ── */
    'ai.qrFilled': 'Details filled from Aadhaar QR',
    'ai.qrOldFormat': 'This is an older Aadhaar QR. Please use a recent Aadhaar (PVC card, e-Aadhaar, or the mAadhaar app), or fill the details manually.',
    /* ── Desktop camera capture modal — always English, no Hinglish, per
       spec. Same text in both language blocks. ── */
    'camera.title': 'Take a photo',
    'camera.capture': 'Capture',
    'camera.retake': 'Retake',
    'camera.usePhoto': 'Use this photo',
    'camera.chooseFile': 'Choose file',
    'camera.notAvailable': 'Camera not available in this browser.',
    'camera.permissionDenied': 'Camera permission denied.',
    'camera.notFound': 'No camera found on this device.',
    'camera.genericError': 'Could not access the camera.',
    'camera.useFileInstead': 'Use "Choose file" instead.',
    'ai.photoToggle': '+ Attach a face photo to the PDF too? (optional)',
    'ai.attachChk': 'Attach uploaded documents & photo as extra pages in the final PDF',
    'ai.facePhoto': 'Face Photo',
    'ai.summaryMore': 'view / add more →',
    'ai.pageN': 'Page {n}',
    /* ── AI checkout button — always English, no Hinglish, per spec: just
       the button + a one-line status. Same text in both language blocks. ── */
    'ai.fillWithAi': 'Fill with AI — ₹{price}',
    'ai.retryBtn': 'Retry',
    'ai.extractFailed': "Couldn't read the document. You were not charged.",
    'ai.balanceTooLow': 'Balance too low. You need ₹{price}.',
    'ai.addMoneyBtn': 'Add money',

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
    'modal.buySub': 'Instant via UPI / card — no waiting. AI auto-fill charges ₹3–₹5 depending on what you\'re filling, only on success.',
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
    'catalog.selectAbove': 'select forms above',

    /* ── blank-form info pages (/form-<num>-<slug>/) — shared section
       labels, reused by every page of this type; the actual per-form prose
       is in its own blank.f<num>.* keys below. Always English, no
       Hinglish, per spec. ── */
    'blankform.eyebrow': 'Official CMVR Form',
    'blankform.whatLabel': 'What is this form?',
    'blankform.whenLabel': 'When do you need it?',
    'blankform.whoLabel': 'Who fills it out?',
    'blankform.attachLabel': 'What to bring / attach',
    'blankform.downloadBtn': 'Download Form {n} (PDF)',
    'blankform.downloadNote': 'Official blank format — print, fill by hand, and submit.',

    /* Form 1A — Medical Certificate */
    'blank.f1a.what': 'A medical fitness certificate from a registered medical practitioner, confirming you are physically fit to hold a driving licence. You don’t fill this form yourself — a doctor does.',
    'blank.f1a.when': 'Needed when applying for or renewing a licence to drive a transport (commercial) vehicle, and for anyone renewing any driving licence past the age of 40. Some RTOs also ask for it with a fresh licence application.',
    'blank.f1a.who': 'A registered medical practitioner (RMP) examines you and signs the certificate — you just need to get examined and collect the signed form.',
    'blank.f1a.attach': 'Carry this blank form to your doctor. They complete Part A (and Part B, an eyesight test by an ophthalmologist, if your RTO requires it), then sign and stamp it. Submit the completed certificate with your licence application — not the blank form.',
    'blank.f1a.related': 'Applying for a licence? See <a href="/#all-forms">Form 2 (Learner’s / DL Application)</a> and Form 9 (DL Renewal) in the full forms list.',

    /* Form 23 — Certificate of Registration */
    'blank.f23.what': 'The official format of the Registration Certificate (RC) itself — the document a Registering Authority issues recording a vehicle’s owner, make, chassis/engine number and registration particulars. This is the OUTPUT of registration, not an application you fill in.',
    'blank.f23.when': 'Issued once when a vehicle is first registered, and re-issued in this same format after a renewal, address change, ownership transfer, or a replacement for a lost/damaged RC — you don’t submit this form, you receive it.',
    'blank.f23.who': 'Prepared and issued by the Registering Authority (RTO/DTO). You don’t fill or submit Form 23 — you fill the application that triggers it (new registration, renewal, transfer, duplicate, or address change).',
    'blank.f23.attach': 'Nothing attaches to this form — it’s what you get back, not what you send in. The application that leads to it (Form 20, 25, 26, 29/30, or 33) has its own attachment list.',
    'blank.f23.related': 'Lost or damaged your RC? You need <a href="/duplicate-rc">Form 26 — Duplicate RC</a>, not this blank format. Renewing an expiring RC? Use the <a href="/rc-renewal">RC Renewal package</a>.',

    /* Form 38 — Certificate of Fitness */
    'blank.f38.what': 'The Certificate of Fitness (CoF) for a transport/commercial vehicle — issued after a physical inspection confirms the vehicle is roadworthy and safe to ply.',
    'blank.f38.when': 'Required before a transport vehicle can be registered or operated commercially, and needs periodic renewal (the interval depends on vehicle type and age) to stay legally on the road.',
    'blank.f38.who': 'The registered owner or operator of the transport vehicle applies; the physical inspection and certification is carried out by the Motor Vehicle Inspector at the RTO or an authorised testing centre.',
    'blank.f38.attach': 'RC copy, valid insurance certificate, Pollution Under Control (PUC) certificate, and the vehicle itself for physical inspection at the testing centre or RTO.',
    'blank.f38.related': 'Applying for a permit? Tourist and national permits usually need a valid Certificate of Fitness first — see the full <a href="/#all-forms">Permit forms list</a>.',

    /* ── tax calculator (/tax-calculator) — money-related, English in both
       blocks regardless of language toggle, same convention as money-UI ── */
    'calc.placeholder': 'Enter the ex-showroom price — the estimate will appear here.',
    'calc.eyebrow': 'Estimate',
    'calc.title': 'Jharkhand Vehicle Registration Cost Calculator',
    'calc.intro1': "Get an approximate on-road registration cost for a new vehicle in Jharkhand — road tax, registration fee, smart card, HSRP plate and hypothecation charges, all in one place. Enter the ex-showroom price and a few vehicle details below.",
    'calc.intro2': 'This is an estimate for budgeting, not an official quote — always confirm the final amount with your DTO/RTO before paying.',
    'calc.priceHint': 'A GST-inclusive price also works — road tax is calculated on the GST-exclusive value automatically.',
    'calc.whatsIncludedTitle': "What's included in the estimate",
    'calc.whatsIncludedWhat': 'Road tax, one-time fees, and rebates',
    'calc.whatsIncludedWhatBody': 'Road tax (slab-based on price, vehicle type and pre-owned status), registration fee, RC smart card fee, HSRP number plate fee, and postal/misc charges — plus a road-tax rebate if you select Electric or CNG/LPG.',
    'calc.whatsIncludedWho': 'Hypothecation (loan) charges',
    'calc.whatsIncludedWhoBody': "If you're financing the vehicle, switch \"On loan / finance?\" to Yes — the hire-purchase (HP) endorsement fee is added to the total automatically.",
    'calc.whatsIncludedAttach': "Not included",
    'calc.whatsIncludedAttachBody': 'Insurance premium, extended warranty, accessories, dealer handling charges, and any octroi/local body tax — these vary by dealer and aren\'t part of RTO registration.',
    'calc.howRatesTitle': 'How the rates are calculated',
    'calc.howRatesBody': "Road tax is charged as a percentage of the GST-exclusive (ex-showroom) price, on a slab that rises with the vehicle's price; pre-owned vehicles carry a small additional percentage. Electric vehicles get a road-tax rebate, and some states rebate CNG/LPG too. These rates are based on publicly available Jharkhand estimates and are reviewed periodically — they are not a substitute for your DTO/RTO's official assessment.",
    'calc.disclaimer': '⚠️ Approximate estimate only. Actual RTO charges can vary based on state notifications. Confirm the final amount with your DTO/RTO. Rates last updated: review pending.',
    'calc.faq1q': 'Is this Jharkhand registration cost calculator official?',
    'calc.faq1a': 'No — this is an independent estimate based on publicly available rate information. It is not issued by, or affiliated with, the Jharkhand Transport Department. Always confirm the exact amount with your DTO/RTO before paying.',
    'calc.faq2q': 'Does this calculator work for other states?',
    'calc.faq2a': 'Not yet — the rate slabs used here are specific to Jharkhand. Road tax percentages, rebates and fees vary significantly by state, so this estimate will not be accurate outside Jharkhand.',

    /* ── error / validation messages ── */
    'err.selectForm': 'Select at least one form to include.',
    'err.needOneName': "Enter at least one name — Seller or Buyer. If you don't have either yet, use \"Download blank forms\" below.",
    'err.regNo': 'Registration No. is required for the selected forms.',
    'err.mobile': 'Mobile number is required — please enter it before generating the PDF.',
    'err.mobileDigits': 'Mobile number must be exactly 10 digits.',
    'err.buyerMobile': 'Purchaser mobile number is required — please enter it before generating the PDF.',
    'err.buyerMobileDigits': 'Purchaser mobile number must be exactly 10 digits.',
    'err.generic': 'Error: {msg}',
    'err.walletReset': 'Wallet was reset — please try again.',
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
    'status.reading': 'Reading...',
    'status.uploaded': 'Uploaded ✓',
    'status.reviewAmber': '{n} field{s} filled from {docs} — check the highlighted boxes.',
    'status.packageSummary': 'This package has {n} field{s}, {empty} still empty.',
    'status.docsExtractedSummary': '{n} document{s} filled {filled} field{fs} ✓',
    'status.paymentStarting': 'Starting payment...',
    'status.paymentConfirming': 'Confirming payment...',
    'status.amountAdded': '₹{n} added! Balance: ₹{bal}',
    'status.retryBtn': 'Retry',
    /* ── Payment / extraction status & error states — always English, no
       Hinglish, real money is involved (see pro-wallet.js). Money status
       first, reason after — never Razorpay's/HTTP's own raw error text. ── */
    'pay.failed': 'Payment failed. You were not charged.',
    'pay.tryAgain': 'Try again',
    'pay.receivedNotConfirmed': 'Payment received but not confirmed yet.',
    'pay.balanceWillUpdate': 'Your balance will update in a few minutes.',
    'pay.refreshBalance': 'Refresh balance',
    'pay.balanceRefreshed': 'Balance: ₹{bal}',
    'pay.couldNotStart': 'Could not start payment. You were not charged.',
    'err.connectionLost': 'Connection lost. You were not charged.',
    'status.readingDoc': 'Reading your document...',
    'status.onlyChargedIfSuccess': "You'll only be charged if this succeeds.",
    'status.filledAndMissed': 'Filled {filled} field{fs}. {missed} could not be read.',
    'status.included': 'Included in your PDF',
    'status.noExtraFields': 'No extra fields needed',
    'status.sameDetails': 'Fills from the same details, no extra charge',
    'conflict.differs': '{winner} and {loser} disagree — using {winner}’s value.',
    'conflict.useOther': 'Use {loser}’s value instead',
  },

  hi: {
    /* ── small grammar words (used inside composed status/error strings) ── */
    'word.and': 'aur',
    'word.hai': 'hai',
    'word.hain': 'hain',

    /* ── header ── */
    'nav.packages': 'Packages',
    'nav.allForms': 'All Forms',
    'nav.calc': 'Tax Calculator',
    'nav.how': 'How it works',
    'nav.faq': 'FAQ',
    'nav.fill': 'Fill Forms →',
    'lang.en': 'EN',
    'lang.hi': 'Hinglish',

    /* ── landing (root only) — hero, packages, catalogue, trust strip ── */
    'landing.hero.title': 'Jo bhi RTO form chahiye, sab yahan hai',
    'landing.hero.sub': 'Official Motor Vehicles Act forms online bharo aur print-ready PDF download karo. Sab 100% FREE aur easy hai — transfer, renewal, duplicate RC, hypothecation aur bhi bahut kuch, bas kuch clicks mein.',
    'landing.searchPlaceholder': 'Forms, affidavits, ya koi kaam search karo…',
    'landing.noResultsFor': '"{q}" ke liye kuch nahi mila',
    'landing.noResultsHint': 'Ye form chahiye? WhatsApp pe batao, hum jod denge.',
    'landing.whatsappCta': 'WhatsApp pe message karo',
    'landing.packagesTitle': 'Ek package se shuru karo',
    'landing.packagesSub': 'Details ek baar bharo, us kaam ke sab forms ban jaayenge.',
    'landing.allFormsTitle': 'Sab {n} forms',
    'landing.allFormsSub': 'Online bharo, ya blank official format download karo.',
    'landing.allCount': 'Sab {n}',
    'landing.formCount': '{n} form',
    'landing.fillOnline': 'Fill online',
    'landing.downloadBlank': 'Download blank',
    'landing.cat.registration': 'Registration',
    'landing.cat.transfer': 'Transfer',
    'landing.cat.licence': 'Licence',
    'landing.cat.permit': 'Permit',
    'landing.cat.misc': 'Other',
    'landing.trust1': 'Login nahi chahiye',
    'landing.trust2': 'Data aapke browser mein hi rehta hai',
    'landing.trust3': '{n} forms covered',
    'landing.trust4': 'Bilkul free',
    /* Always English, no Hinglish — same text as the en block. */
    'landing.pkg.b_transfer': 'Transfer a vehicle to a new owner',
    'landing.pkg.b_rcrenew': 'Renew your registration certificate',
    'landing.pkg.b_duprc': 'Get a duplicate registration certificate',
    'landing.pkg.b_hpremove': 'Remove hypothecation after loan closure',
    'landing.pkg.b_address': 'Update address on your RC',
    'landing.pkg.b_death': "Transfer ownership after owner's death",

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
    'root.uploadInstructions': 'RC upload karke seedha "Extract" dabao — balance kam hone par payment window khud khul jayega (₹5/extraction), usi mein apna number daalna. Aadhaar/PAN sirf PDF mein attach hote hain — inka extraction nahi hota, aur inko consent bhi nahi chahiye.',
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
    'task.transferondeath.sub': 'Form 31 — ek print-ready PDF mein',

    /* ── AI box ── */
    /* title/subtitle always English, no Hinglish — same as en block. */
    'ai.title': 'Fill with AI',
    'ai.subtitle': "Upload your RC and we'll fill the vehicle details for you.",
    'ai.start': 'Shuru karo',
    'ai.freeLine': '— ya neeche khud bhar lo, free —',
    'ai.pickerHead': 'RC, Aadhaar ya PAN ki photo daalo',
    'ai.consent': 'I confirm I am the authorised holder of this document. I understand the RC photo is sent to the Google Gemini API for extraction and is not stored on our server — I have read the <a href="/privacy-policy.html" target="_blank" rel="noopener">Privacy Policy</a>.',
    'ai.emptyNote': 'Upar se forms select karo — us hisab se yahan sirf relevant documents dikhenge.',
    'ai.rcNote': 'RC se seller ki details bharenge',
    'ai.fillsAutomatically': 'Form apne aap bhar jaayega',
    'ai.attachedOnly': 'Aapke PDF mein attach hoga',
    'ai.attachPhotoChk': 'Photo bhi attach karo',
    'ai.vehicleGroup': 'Vehicle',
    'ai.sellerGroup': 'Seller (Transferor)',
    'ai.buyerGroup': 'Buyer (Transferee)',
    'ai.attachmentGroup': 'Attachment Only',
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
    /* Always English, no Hinglish, per spec — same text as the en block. */
    'ai.qrFilled': 'Details filled from Aadhaar QR',
    'ai.qrOldFormat': 'This is an older Aadhaar QR. Please use a recent Aadhaar (PVC card, e-Aadhaar, or the mAadhaar app), or fill the details manually.',
    /* Always English, no Hinglish, per spec — same text as the en block. */
    'camera.title': 'Take a photo',
    'camera.capture': 'Capture',
    'camera.retake': 'Retake',
    'camera.usePhoto': 'Use this photo',
    'camera.chooseFile': 'Choose file',
    'camera.notAvailable': 'Camera not available in this browser.',
    'camera.permissionDenied': 'Camera permission denied.',
    'camera.notFound': 'No camera found on this device.',
    'camera.genericError': 'Could not access the camera.',
    'camera.useFileInstead': 'Use "Choose file" instead.',
    'ai.photoToggle': '+ Face photo bhi attach karni hai PDF mein? (optional)',
    'ai.attachChk': 'Uploaded documents aur photo final PDF mein extra pages ki tarah attach karo',
    'ai.facePhoto': 'Face Photo',
    'ai.summaryMore': 'dekho / aur jodo →',
    'ai.pageN': 'Page {n}',
    /* Always English, no Hinglish, per spec — same text as the en block. */
    'ai.fillWithAi': 'Fill with AI — ₹{price}',
    'ai.retryBtn': 'Retry',
    'ai.extractFailed': "Couldn't read the document. You were not charged.",
    'ai.balanceTooLow': 'Balance too low. You need ₹{price}.',
    'ai.addMoneyBtn': 'Add money',

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
    'modal.buySub': 'UPI / card se turant add ho jayega — koi wait nahi. AI auto-fill ₹3–₹5 leta hai (kya bhar rahe ho uske hisaab se), sirf success par.',
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
    'catalog.selectAbove': 'upar se forms select karo',

    /* ── blank-form info pages — always English, no Hinglish, per spec.
       Same text as the en block. ── */
    'blankform.eyebrow': 'Official CMVR Form',
    'blankform.whatLabel': 'What is this form?',
    'blankform.whenLabel': 'When do you need it?',
    'blankform.whoLabel': 'Who fills it out?',
    'blankform.attachLabel': 'What to bring / attach',
    'blankform.downloadBtn': 'Download Form {n} (PDF)',
    'blankform.downloadNote': 'Official blank format — print, fill by hand, and submit.',

    'blank.f1a.what': 'A medical fitness certificate from a registered medical practitioner, confirming you are physically fit to hold a driving licence. You don’t fill this form yourself — a doctor does.',
    'blank.f1a.when': 'Needed when applying for or renewing a licence to drive a transport (commercial) vehicle, and for anyone renewing any driving licence past the age of 40. Some RTOs also ask for it with a fresh licence application.',
    'blank.f1a.who': 'A registered medical practitioner (RMP) examines you and signs the certificate — you just need to get examined and collect the signed form.',
    'blank.f1a.attach': 'Carry this blank form to your doctor. They complete Part A (and Part B, an eyesight test by an ophthalmologist, if your RTO requires it), then sign and stamp it. Submit the completed certificate with your licence application — not the blank form.',
    'blank.f1a.related': 'Applying for a licence? See <a href="/#all-forms">Form 2 (Learner’s / DL Application)</a> and Form 9 (DL Renewal) in the full forms list.',

    'blank.f23.what': 'The official format of the Registration Certificate (RC) itself — the document a Registering Authority issues recording a vehicle’s owner, make, chassis/engine number and registration particulars. This is the OUTPUT of registration, not an application you fill in.',
    'blank.f23.when': 'Issued once when a vehicle is first registered, and re-issued in this same format after a renewal, address change, ownership transfer, or a replacement for a lost/damaged RC — you don’t submit this form, you receive it.',
    'blank.f23.who': 'Prepared and issued by the Registering Authority (RTO/DTO). You don’t fill or submit Form 23 — you fill the application that triggers it (new registration, renewal, transfer, duplicate, or address change).',
    'blank.f23.attach': 'Nothing attaches to this form — it’s what you get back, not what you send in. The application that leads to it (Form 20, 25, 26, 29/30, or 33) has its own attachment list.',
    'blank.f23.related': 'Lost or damaged your RC? You need <a href="/duplicate-rc">Form 26 — Duplicate RC</a>, not this blank format. Renewing an expiring RC? Use the <a href="/rc-renewal">RC Renewal package</a>.',

    'blank.f38.what': 'The Certificate of Fitness (CoF) for a transport/commercial vehicle — issued after a physical inspection confirms the vehicle is roadworthy and safe to ply.',
    'blank.f38.when': 'Required before a transport vehicle can be registered or operated commercially, and needs periodic renewal (the interval depends on vehicle type and age) to stay legally on the road.',
    'blank.f38.who': 'The registered owner or operator of the transport vehicle applies; the physical inspection and certification is carried out by the Motor Vehicle Inspector at the RTO or an authorised testing centre.',
    'blank.f38.attach': 'RC copy, valid insurance certificate, Pollution Under Control (PUC) certificate, and the vehicle itself for physical inspection at the testing centre or RTO.',
    'blank.f38.related': 'Applying for a permit? Tourist and national permits usually need a valid Certificate of Fitness first — see the full <a href="/#all-forms">Permit forms list</a>.',

    /* ── tax calculator (/tax-calculator) — money-related, kept English
       even in the Hinglish block, same convention as money-UI ── */
    'calc.placeholder': 'Enter the ex-showroom price — the estimate will appear here.',
    'calc.eyebrow': 'Estimate',
    'calc.title': 'Jharkhand Vehicle Registration Cost Calculator',
    'calc.intro1': "Get an approximate on-road registration cost for a new vehicle in Jharkhand — road tax, registration fee, smart card, HSRP plate and hypothecation charges, all in one place. Enter the ex-showroom price and a few vehicle details below.",
    'calc.intro2': 'This is an estimate for budgeting, not an official quote — always confirm the final amount with your DTO/RTO before paying.',
    'calc.priceHint': 'A GST-inclusive price also works — road tax is calculated on the GST-exclusive value automatically.',
    'calc.whatsIncludedTitle': "What's included in the estimate",
    'calc.whatsIncludedWhat': 'Road tax, one-time fees, and rebates',
    'calc.whatsIncludedWhatBody': 'Road tax (slab-based on price, vehicle type and pre-owned status), registration fee, RC smart card fee, HSRP number plate fee, and postal/misc charges — plus a road-tax rebate if you select Electric or CNG/LPG.',
    'calc.whatsIncludedWho': 'Hypothecation (loan) charges',
    'calc.whatsIncludedWhoBody': "If you're financing the vehicle, switch \"On loan / finance?\" to Yes — the hire-purchase (HP) endorsement fee is added to the total automatically.",
    'calc.whatsIncludedAttach': "Not included",
    'calc.whatsIncludedAttachBody': 'Insurance premium, extended warranty, accessories, dealer handling charges, and any octroi/local body tax — these vary by dealer and aren\'t part of RTO registration.',
    'calc.howRatesTitle': 'How the rates are calculated',
    'calc.howRatesBody': "Road tax is charged as a percentage of the GST-exclusive (ex-showroom) price, on a slab that rises with the vehicle's price; pre-owned vehicles carry a small additional percentage. Electric vehicles get a road-tax rebate, and some states rebate CNG/LPG too. These rates are based on publicly available Jharkhand estimates and are reviewed periodically — they are not a substitute for your DTO/RTO's official assessment.",
    'calc.disclaimer': '⚠️ Approximate estimate only. Actual RTO charges can vary based on state notifications. Confirm the final amount with your DTO/RTO. Rates last updated: review pending.',
    'calc.faq1q': 'Is this Jharkhand registration cost calculator official?',
    'calc.faq1a': 'No — this is an independent estimate based on publicly available rate information. It is not issued by, or affiliated with, the Jharkhand Transport Department. Always confirm the exact amount with your DTO/RTO before paying.',
    'calc.faq2q': 'Does this calculator work for other states?',
    'calc.faq2a': 'Not yet — the rate slabs used here are specific to Jharkhand. Road tax percentages, rebates and fees vary significantly by state, so this estimate will not be accurate outside Jharkhand.',

    /* ── error / validation messages ── */
    'err.selectForm': 'Kam se kam ek form select karo.',
    'err.needOneName': 'Seller ya Buyer mein se kam se kam ek naam daalo. Abhi dono nahi hain to neeche "Download blank forms" use karo.',
    'err.regNo': 'Selected forms ke liye Registration No. zaroori hai.',
    'err.mobile': 'Mobile number zaroori hai — PDF banane se pehle daal do.',
    'err.mobileDigits': 'Mobile number pura 10 digit ka hona chahiye.',
    'err.buyerMobile': 'Purchaser ka mobile number zaroori hai — PDF banane se pehle daal do.',
    'err.buyerMobileDigits': 'Purchaser ka mobile number pura 10 digit ka hona chahiye.',
    'err.generic': 'Error aaya: {msg}',
    'err.walletReset': 'Wallet reset ho gaya — dobara try karo.',
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
    'status.reading': 'Reading...',
    'status.uploaded': 'Uploaded ✓',
    'status.reviewAmber': '{n} field{s} {docs} se bhare — highlighted boxes check kar lo.',
    'status.packageSummary': 'Is package mein {n} field{s} hain, {empty} abhi khali {hai}.',
    'status.docsExtractedSummary': '{n} document{s} se {filled} field{fs} bhare ✓',
    'status.paymentStarting': 'Starting payment...',
    'status.paymentConfirming': 'Confirming payment...',
    'status.amountAdded': '₹{n} added! Balance: ₹{bal}',
    'status.retryBtn': 'Retry',
    /* Always English, no Hinglish — same text as the en block. */
    'pay.failed': 'Payment failed. You were not charged.',
    'pay.tryAgain': 'Try again',
    'pay.receivedNotConfirmed': 'Payment received but not confirmed yet.',
    'pay.balanceWillUpdate': 'Your balance will update in a few minutes.',
    'pay.refreshBalance': 'Refresh balance',
    'pay.balanceRefreshed': 'Balance: ₹{bal}',
    'pay.couldNotStart': 'Could not start payment. You were not charged.',
    'err.connectionLost': 'Connection lost. You were not charged.',
    'status.readingDoc': 'Reading your document...',
    'status.onlyChargedIfSuccess': "You'll only be charged if this succeeds.",
    'status.filledAndMissed': 'Filled {filled} field{fs}. {missed} could not be read.',
    'status.included': 'Aapke PDF mein shaamil hai',
    'status.noExtraFields': 'Koi extra field nahi chahiye',
    'status.sameDetails': 'Same details se ban jayega, extra charge nahi',
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
