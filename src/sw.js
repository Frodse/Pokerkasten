/* Service Worker: legt die App beim ersten Öffnen auf dem Handy ab, damit
   sie auch ohne Internet startet (das lokale Spiel läuft dann komplett).
   Wird beim Build zu dist/sw.js; die Dateiliste setzt vite.config.js ein.

   Seite selbst: zuerst aus dem Netz (damit Updates sofort ankommen), ohne
   Netz aus der Ablage. Dateien unter /assets/ ändern bei jeder neuen
   Version ihren Namen, sie kommen deshalb direkt aus der Ablage.
   Anfragen an andere Server (Supabase) laufen nie über die Ablage. */

const FILES = self.__PRECACHE__;
const CACHE = `pokerkasten-${self.__VERSION__}`;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("pokerkasten-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          if (res.ok) caches.open(CACHE).then((cache) => cache.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/", { ignoreVary: true }))
    );
    return;
  }

  // ignoreVary: Skripte fragt der Browser mit anderen Kopfzeilen an als die
  // Ablage beim Installieren, sonst findet er sie offline nicht
  event.respondWith(caches.match(req, { ignoreVary: true }).then((hit) => hit || fetch(req)));
});
