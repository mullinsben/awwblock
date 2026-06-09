// content.js
// Finds ad slots, evicts them, and settles a calming animal into the space.

(() => {
  // Cross-browser extension API: Chrome/Edge expose `chrome`, Firefox exposes
  // both `chrome` (callback-style, used here) and `browser`. Resolve once.
  const ext = globalThis.chrome ?? globalThis.browser;

  const SLOT_MARK = "data-calm-slot"; // marks a slot we've taken over

  // Known ad-network containers. Conservative on purpose: these are almost
  // always ads, so we won't disturb real content.
  const AD_SELECTORS = [
    "ins.adsbygoogle",
    "iframe[id^='google_ads']",
    "iframe[src*='doubleclick']",
    "iframe[src*='googlesyndication']",
    "iframe[src*='/ads/']",
    "[id^='div-gpt-ad']",
    "[id^='google_ads_iframe']",
    "[data-ad-client]",
    "[data-ad-slot]",
    "[data-google-query-id]",
    "[class*='ad-slot' i]",
    "[class*='adslot' i]",
    "[class*='ad-banner' i]",
    "[class*='ad-container' i]",
    "[class*='ad-unit' i]",
    "[class*='adunit' i]",
    "[class*='advert' i]",
    "[class*='leaderboardad' i]",
    "[class*='gpt-ad' i]",
    "[id*='gpt-ad' i]",
    "[id*='taboola' i]",
    "[id*='outbrain' i]"
  ];

  // Standard IAB ad sizes [w, h]. We only swap an element matching these if it
  // ALSO looks ad-ish (holds an iframe or has an ad-flavored id/class), so we
  // never replace a real photo or content tile.
  const IAB_SIZES = [
    [728, 90], [970, 90], [970, 250], [300, 250], [336, 280],
    [300, 600], [160, 600], [120, 600], [320, 50], [320, 100],
    [468, 60], [234, 60], [250, 250], [200, 200], [180, 150]
  ];
  const SIZE_TOL = 4;

  let enabled = true;
  let deployed = 0;
  let activePool = []; // toggled-on animals that have assets; each slot picks randomly

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function looksAdIsh(el) {
    if (el.querySelector("iframe, ins, script")) return true;
    const hay = ((el.id || "") + " " + (el.className || "")).toLowerCase();
    return /\bad(s|vert|slot|banner|box)?\b|sponsor|promo|taboola|outbrain|dfp|gpt/.test(hay);
  }

  function matchesIabSize(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) return false;
    return IAB_SIZES.some(([w, h]) =>
      Math.abs(r.width - w) <= SIZE_TOL && Math.abs(r.height - h) <= SIZE_TOL
    );
  }

  // Build the art node for one slot. The animal (theme) is chosen once per slot
  // by the caller and stays stable across resizes; only the photo is re-picked
  // to suit the slot's current shape.
  function critterTile(w, h, theme) {
    const wrap = document.createElement("div");
    wrap.setAttribute(SLOT_MARK, "1");

    const art = pickFromTheme(theme, w, h);

    if (art.kind === "photo") {
      const ar = (w && h) ? w / h : 1;
      const fit = art.fit || ((ar >= 2.2 || ar <= 0.45) ? "contain" : "cover");
      wrap.style.cssText = `
        position:absolute;inset:0;box-sizing:border-box;z-index:2147483646;
        overflow:hidden;border-radius:12px;background:#F3E2BE;`;
      const src = ext.runtime.getURL(art.data); // packaged image file
      wrap.innerHTML =
        `<img src="${src}" alt="${theme ? theme.label : "a calming animal"}" loading="lazy"
              style="width:100%;height:100%;object-fit:${fit};display:block;">`;
      return wrap;
    }

    // Vector fallback: centered on a warm cream backdrop.
    wrap.style.cssText = `
      position:absolute;inset:0;z-index:2147483646;
      display:flex;align-items:center;justify-content:center;
      box-sizing:border-box;overflow:hidden;padding:6px;
      background:radial-gradient(circle at 50% 35%, #FBF1DC 0%, #F3E2BE 100%);
      border-radius:12px;`;
    wrap.innerHTML = `<div style="height:100%;max-height:100%;display:flex;">${art.data}</div>`;
    const svg = wrap.querySelector("svg");
    if (svg) {
      svg.style.cssText = "max-width:100%;max-height:100%;height:100%;width:auto;display:block;";
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }
    return wrap;
  }

  // Slots we've taken over, so we can re-fit them when their size changes.
  const TAKEN = new Map(); // el -> theme (animal stays stable across resizes)

  function measure(el) {
    const r = el.getBoundingClientRect();
    return {
      w: Math.round(r.width) || el.offsetWidth || 300,
      h: Math.round(r.height) || el.offsetHeight || 250
    };
  }

  // (Re)render a slot's art at its CURRENT size. Same animal; photo re-picked
  // to suit the current shape. Stores the slot aspect so refit can tell when
  // the shape has actually changed enough to warrant a re-render.
  function renderSlot(el, theme) {
    const { w, h } = measure(el);
    el.dataset.calmAr = (w / h).toFixed(3);
    el.replaceChildren(critterTile(w, h, theme));
  }

  // Debounced re-fit: only re-render when the slot's aspect has shifted enough
  // that object-fit:cover alone won't keep it looking right (e.g. a responsive
  // unit reflowing as the window resizes). Prevents flicker on tiny changes.
  let refitTimer = null;
  const refitQueue = new Set();
  function scheduleRefit(el) {
    refitQueue.add(el);
    clearTimeout(refitTimer);
    refitTimer = setTimeout(() => {
      refitQueue.forEach((node) => {
        const theme = TAKEN.get(node);
        if (!theme || !node.isConnected) return;
        const { w, h } = measure(node);
        if (!w || !h) return;
        const prev = parseFloat(node.dataset.calmAr || "0");
        const now = w / h;
        if (!prev || Math.abs(Math.log(now / prev)) > 0.12) renderSlot(node, theme);
      });
      refitQueue.clear();
    }, 120);
  }

  const slotObserver = ("ResizeObserver" in window)
    ? new ResizeObserver((entries) => entries.forEach((e) => scheduleRefit(e.target)))
    : null;

  // Is this slot something the page is actually showing right now? Sites ship
  // multiple responsive ad variants (desktop/tablet/mobile) and only render one;
  // the others are display:none. We also skip collapsed/empty slots so we never
  // conjure a phantom animal box where the site displayed nothing.
  function shouldSkip(el) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return true;
    if (el.offsetParent === null && cs.position !== "fixed") return true; // not laid out
    const r = el.getBoundingClientRect();
    const hasAd = el.querySelector("iframe, ins.adsbygoogle");
    if (!hasAd && (r.width < 60 || r.height < 30)) return true; // collapsed/empty slot
    return false;
  }

  function deploy(el) {
    if (!el || el.getAttribute(SLOT_MARK) || el.closest(`[${SLOT_MARK}]`)) return;
    if (shouldSkip(el)) return;
    const { w, h } = measure(el);

    el.setAttribute(SLOT_MARK, "1");
    // Anchor the absolutely-positioned art to this box, and keep a minimum
    // footprint so the layout doesn't collapse. Height stays fluid: the art
    // fills whatever size the page gives the slot, so it tracks the window.
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    el.style.minHeight = Math.max(h, 60) + "px";
    el.style.background = "none";
    el.style.border = "none";

    const theme = pick(activePool);
    TAKEN.set(el, theme);
    renderSlot(el, theme);
    if (slotObserver) slotObserver.observe(el);

    // Ad scripts often keep re-injecting their creative into the slot after we
    // take it over, which makes the slot flicker/blink as their content loads
    // on top of ours. Guard against it: strip any node in the slot that isn't
    // our art, so the animal stays put and the ad never paints through.
    const guard = new MutationObserver(() => {
      [...el.childNodes].forEach((n) => {
        if (n.nodeType === 1 && n.getAttribute && n.getAttribute(SLOT_MARK) === "1") return;
        try { el.removeChild(n); } catch (_) {}
      });
    });
    guard.observe(el, { childList: true });

    deployed++;
    ext.storage.local.set({ deployed });
  }

  function scan(root = document) {
    if (!enabled || !activePool.length) return;

    // 1) Known ad selectors.
    AD_SELECTORS.forEach((sel) => {
      root.querySelectorAll(sel).forEach((el) => {
        // Climb to a sensibly sized container if the match is a bare iframe.
        const target = el.tagName === "IFRAME" && el.parentElement &&
          el.parentElement.children.length === 1 ? el.parentElement : el;
        deploy(target);
      });
    });

    // 2) IAB-sized elements that also look ad-ish.
    root.querySelectorAll("div,aside,section,ins").forEach((el) => {
      if (el.getAttribute(SLOT_MARK)) return;
      if (matchesIabSize(el) && looksAdIsh(el)) deploy(el);
    });
  }

  function start() {
    scan();
    const obs = new MutationObserver((muts) => {
      if (!enabled) return;
      for (const m of muts) {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === 1) scan(n.parentElement || document);
        });
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  // Build the pool of animals to draw from: has assets AND toggled on.
  function rebuildPool(allow) {
    activePool = activeThemes().filter((t) => (allow || {})[t.name] !== false);
  }

  // Honor the on/off toggle and the per-animal selection.
  ext.storage.local.get(["enabled", "deployed", "animals"], (s) => {
    enabled = s.enabled !== false;
    deployed = s.deployed || 0;
    rebuildPool(s.animals);

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start);
    } else {
      start();
    }
  });

  ext.storage.onChanged.addListener((ch) => {
    if (ch.animals) rebuildPool(ch.animals.newValue);
    if (ch.enabled) enabled = ch.enabled.newValue !== false;
    if (enabled && activePool.length) scan(); // sweep newly-eligible ad slots now
  });
})();
