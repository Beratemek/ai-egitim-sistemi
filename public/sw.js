/*
 * Eski gelistirme surumlerinden kalmis service worker kaydini temizler.
 * Uygulama su anda offline/PWA davranisi kullanmiyor; eski worker Next.js
 * chunk'larini onbellekten sunarak giris formunun guncel kodunu engelliyordu.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.registration.unregister(),
      caches.keys().then((keys) =>
        Promise.all(keys.map((key) => caches.delete(key))),
      ),
    ]).then(() => self.clients.claim()),
  );
});
