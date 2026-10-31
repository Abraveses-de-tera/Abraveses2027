/**
 * Service Worker para Abraveses de Tera 2027
 * Estrategia de caché para funcionamiento 100% offline
 */

const CACHE_NAME = "abraveses-2027-v2.7.0";

const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/app.js",
  "./js/countdown.js",
  "./data/events.json",
  "./data/events-data.js",
  "./images/abraveses.jpg",
  "./images/hermita-logo.png",
  "./images/logo-hermita-hero.png",
  "./images/favicon.ico",
  "./images/cartel-oficial.jpg",
  "./images/bendicion-boyas.jpg",
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

  // Para events.json y events-data.js: Network-first con fallback a caché
  if (url.pathname.endsWith("events.json") || url.pathname.endsWith("events-data.js")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const altCached = await caches.match("./data/events.json");
          if (altCached) return altCached;
          return new Response("{}", {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        })
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
        .catch(async () => {
          // Si falla y es navegación HTML, retornar index.html
          if (request.headers.get("accept")?.includes("text/html")) {
            const indexCached = await caches.match("./index.html");
            if (indexCached) return indexCached;
          }
          return new Response("", { status: 408 });
        });
    })
  );
});

// ==========================================================================
// NOTIFICACIONES PUSH Y RECORDATORIOS WEB
// ==========================================================================
self.addEventListener("push", (event) => {
  let data = {
    title: "Fiestas Abraveses 2027",
    body: "Aviso urgente de las fiestas.",
    url: "./"
  };

  if (event.data) {
    try {
      data = Object.assign(data, event.data.json());
    } catch (_) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "./images/icons/icon-192.png",
    badge: "./images/icons/icon-192.png",
    vibrate: [200, 100, 200],
    data: {
      url: data.url || "./"
    },
    actions: [
      { action: "explore", title: "Ver programa" }
    ]
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "./";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.registration.scope) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
