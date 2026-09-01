/* ════════ PWA install button — floating, injected, every page ════════
   Loaded on every page that links manifest.json. Registers the (deliberately
   minimal — see sw.js) service worker and injects its own floating button
   rather than relying on per-page header markup: the site has several
   different header layouts (root landing page vs. task pages vs. /fill vs.
   the blank-form/legal pages), and one shared script avoids duplicating —
   and inevitably drifting — the same button across all of them.

   Three states:
   - Chrome/Edge/Android and any other browser that fires
     `beforeinstallprompt`: the button appears once the browser itself
     signals installability; clicking it replays that captured event's own
     native prompt — this is the ONLY correct way to trigger it, it cannot
     be invoked speculatively.
   - iOS Safari: there is no programmatic install prompt at all — Apple
     doesn't expose one, full stop. The button appears unconditionally
     there instead (once not already installed), and clicking it shows a
     plain on-screen instruction rather than pretending to trigger
     something that cannot exist on that platform.
   - Everything else (desktop Safari, Firefox, or a Chromium browser that
     simply hasn't fired the event yet) — no button. There's nothing
     useful to offer, and a button that does nothing on click is worse
     than no button. */
(function(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('/sw.js').catch(()=>{ /* installability just won't kick in — nothing else on the page depends on this */ });
  }

  /* Already running as the installed app (Chrome's own standalone mode, or
     iOS Safari's older but still-live navigator.standalone flag) — nothing
     to offer, so skip everything else below entirely. */
  const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    || window.navigator.standalone === true;
  if(isStandalone) return;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

  let deferredPrompt = null;
  let btn = null;

  function createButton(){
    if(btn) return btn;
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pwaInstallBtn';
    btn.className = 'pwa-install-fab';
    btn.setAttribute('aria-label', 'Install this app');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 19h16"/></svg><span>Install App</span>';
    btn.addEventListener('click', onButtonClick);
    document.body.appendChild(btn);
    return btn;
  }

  function removeButton(){
    if(btn && btn.parentNode) btn.parentNode.removeChild(btn);
    btn = null;
  }

  async function onButtonClick(){
    if(deferredPrompt){
      const promptEvent = deferredPrompt;
      deferredPrompt = null;
      btn.disabled = true;
      promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if(btn) btn.disabled = false;
      if(choice && choice.outcome === 'accepted') removeButton();
      return;
    }
    if(isIOS) showIosTip();
  }

  function showIosTip(){
    const existing = document.getElementById('pwaIosTip');
    if(existing){ existing.remove(); return; } // second tap dismisses it
    const tip = document.createElement('div');
    tip.id = 'pwaIosTip';
    tip.className = 'pwa-ios-tip';
    tip.innerHTML = '<span>Tap <strong>Share</strong> ⬆️ in Safari’s toolbar, then <strong>“Add to Home Screen.”</strong></span><button type="button" aria-label="Close">&times;</button>';
    tip.querySelector('button').addEventListener('click', () => tip.remove());
    document.body.appendChild(tip);
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    createButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    removeButton();
    const tip = document.getElementById('pwaIosTip');
    if(tip) tip.remove();
  });

  /* iOS never fires beforeinstallprompt — this is the only signal it ever
     gets, so show the button right away instead of waiting for an event
     that will never come. */
  if(isIOS) createButton();
})();
