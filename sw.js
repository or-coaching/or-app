// Lets the app install on phones and open fast. Data always comes live from the server.
const CACHE = "or-app-v20";
const SHELL = ["./", "index.html", "css/styles.css", "js/app.js", "js/config.js", "js/nutrition.js", "js/engage.js", "js/moves.js", "js/muscles.js", "js/fig3d.js", "js/starter.js", "manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // never cache API calls
  e.respondWith(
    // revalidate with the server each time (cheap when nothing changed) so an update never mixes old and new files
    fetch(e.request, { cache: "no-cache" })
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request))
  );
});
