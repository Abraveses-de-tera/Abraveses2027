/**
 * Service Worker para Abraveses de Tera 2027
 * Estrategia de caché para funcionamiento 100% offline
 */

const CACHE_NAME = "abraveses-2027-v1.0.0";

const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/app.js",
  "./js/countdown.js",
  "./data/events.json",
  "./images/abraveses.jpg",
  "./images/cartel-oficial.jpg",
  "./images/bendicion-bollas.jpg",
  "./images/cagada-gallina.jpg",
  "./images/disfraz.jpg",
  "./images/hermita.jpg",
  "./images/marcha-solidaria.jpg",
  "./images/romeria-pendones.jpg",
  "./images/ruta-bodegas.jpg",
  "./images/icons/favicon.png",
  "./images/icons/icon-192.png",
  "./images/icons/icon-512.png"
];

// Instalación y almacenamiento en caché previo
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activación y limpieza de cachés antiguas
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia de peticiones
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Solo gestionar peticiones del mismo origen
  if (url.origin !== self.location.origin) return;

  // Para events.json: Network-first con fallback a caché (para tener cambios de última hora)
  if (url.pathname.endsWith("events.json")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Para el resto de recursos: Stale-While-Revalidate / Cache-First
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // En segundo plano revalidar caché
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          return networkResponse;
        })
        .catch(() => {
          // Si falla y es navegación HTML, retornar index.html
          if (request.headers.get("accept")?.includes("text/html")) {
            return caches.match("./index.html");
          }
        });
    })
  );
});
