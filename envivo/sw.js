/* Service worker de Coronel En Vivo: funciona sin internet después de la primera visita. */
const CACHE = "coronel-envivo-v1";
const BASE = [
  "./", "index.html", "css/envivo.css", "js/app.js", "js/voz-dsp.js", "js/voz-worklet.js", "manifest.webmanifest",
  "img/icono.svg", "img/icono-192.png", "img/icono-512.png",
  "../js/soundfont-player.min.js", "../data/patterns/index.json", "../data/patterns/cumbia.json",
  "../data/patterns/banda.json", "../data/patterns/norteno.json", "../data/patterns/corrido_tumbado.json",
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(BASE.map((u) => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("coronel-envivo-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const pesado = /\/soundfonts\//.test(req.url);
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const enCache = await c.match(req, { ignoreSearch: true });
    if (pesado && enCache) return enCache; // instrumentos: primero caché
    try {
      const r = await fetch(req);
      if (r && r.ok) c.put(req, r.clone());
      return r;
    } catch (err) {
      if (enCache) return enCache;
      if (req.mode === "navigate") return (await c.match("index.html")) || Response.error();
      return Response.error();
    }
  })());
});
