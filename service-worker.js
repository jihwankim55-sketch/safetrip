// SafeTrip service worker — offline-first app shell.
// Bump CACHE_VERSION whenever app shell files change so old caches get purged.
const CACHE_VERSION = "v30";
const CACHE_NAME = `safetrip-shell-${CACHE_VERSION}`;

// Offline emergency info caching strategy:
//   The per-destination emergency payload (numbers, embassy contacts, local
//   phrases) is persisted by the app to localStorage under the key
//   `safetrip_offline_emergency` whenever a safety analysis completes or SOS
//   contacts are fetched. localStorage is synchronously available without
//   network access, so the SW's responsibility is just to keep the app shell
//   (this file's APP_SHELL list) cached — the shell HTML + bundled JS will
//   read localStorage and render the offline modal even with no connectivity.

// Files cached on install. Relative paths so the worker works under any base path.
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js",
  "https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        // Cache files one at a time and ignore failures (external CDNs may block, etc.).
        Promise.all(
          APP_SHELL.map((url) =>
            cache.add(url).catch((err) => {
              // eslint-disable-next-line no-console
              console.warn("[SW] precache failed:", url, err);
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("safetrip-") && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch (_) {
    return;
  }

  // Never cache live API calls — must always hit the network.
  if (url.hostname === "api.anthropic.com") return;

  // Map tiles are too numerous/dynamic to precache. Let the browser handle them.
  if (url.hostname.endsWith(".basemaps.cartocdn.com")) return;

  // Network-first for navigations: get the freshest HTML when online, fall back to cached shell offline.
  const isNavigation =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          return response;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match("./index.html"))
        )
    );
    return;
  }

  // Cache-first for static assets — instantly available, refreshed in the background on miss.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === "opaque") {
            return response;
          }
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          return response;
        })
        .catch(() => new Response("", { status: 503, statusText: "Offline" }));
    })
  );
});
