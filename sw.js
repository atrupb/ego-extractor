const CACHE = "ego-terminal-auto-v35";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./snap.mp3",
  "./assets/gillsans.ttf", "./assets/ebox.png", "./assets/logo.png",
  "./assets/stat-for.png", "./assets/stat-jus.png", "./assets/stat-pru.png", "./assets/stat-tem.png",
  "./assets/risk-zayin.png", "./assets/risk-teth.png", "./assets/risk-he.png", "./assets/risk-waw.png", "./assets/risk-aleph.png",
  "./assets/RedDamageTypeIcon.png", "./assets/WhiteDamageTypeIcon.png", "./assets/BlackDamageTypeIcon.png", "./assets/PaleDamageTypeIcon.png",
  "./assets/waylon-body.png",
  "./css/main.css",
  "./js/util.js", "./js/data.js", "./js/state.js", "./js/sync.js", "./js/cloud.js", "./js/extraction.js",
  "./js/pe.js", "./js/print.js", "./js/sheet.js", "./js/gifts.js", "./js/archive.js", "./js/app.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // cloud sync traffic must never be served stale — leave it to the network
  if (url.hostname === "api.github.com" || url.hostname === "gist.githubusercontent.com") return;
  const isShell = url.origin === location.origin &&
    (e.request.mode === "navigate" || SHELL.some(p => url.pathname.endsWith(p.replace("./", "/"))));

  if (isShell) {
    // NETWORK-FIRST, bypassing the HTTP cache: a git push reaches installed copies
    // on their next online launch instead of waiting out GitHub Pages' max-age.
    e.respondWith(
      fetch(e.request, { cache: "no-cache" }).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() =>
        caches.match(e.request).then(hit => hit || caches.match("./index.html"))
      )
    );
  } else {
    // CACHE-FIRST: wiki images, fonts, flavor lookups — fetched once, kept for offline.
    e.respondWith(
      caches.match(e.request).then(hit => {
        if (hit) return hit;
        return fetch(e.request).then(res => {
          if (res && (res.status === 200 || res.type === "opaque")) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
  }
});