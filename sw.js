const CACHE_NAME = "shiftpad-shell-v71";
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/public-config.js",
  "/lib/vendor/supabase-js-2.118.0.js",
  "/lib/sync-core.js",
  "/lib/diagnostics-core.js",
  "/lib/editor-history.js",
  "/lib/mobile-editor-ui.js",
  "/lib/navigation-ui.js",
  "/lib/sync-details-ui.js",
  "/styles/editor-controls.css",
  "/styles/navigation.css",
  "/styles/sync-details.css",
  "/manifest.webmanifest",
  "/icons/icon-180.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];
const CACHE_FIRST_PATHS = new Set([
  "/manifest.webmanifest",
  "/icons/icon-180.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
]);
const NETWORK_FIRST_PATHS = new Set([
  "/app.js",
  "/public-config.js",
  "/lib/vendor/supabase-js-2.118.0.js",
  "/styles.css",
  "/lib/sync-core.js",
  "/lib/diagnostics-core.js",
  "/lib/editor-history.js",
  "/lib/mobile-editor-ui.js",
  "/lib/navigation-ui.js",
  "/lib/sync-details-ui.js",
  "/styles/editor-controls.css",
  "/styles/navigation.css",
  "/styles/sync-details.css"
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)),
      // This endpoint contains public browser configuration only. Warm it on
      // first install because the initial page request may precede SW control.
      fetch("/api/public-config.js", { cache: "no-store" }).then((response) => putInCache("/api/public-config.js", response)).catch(() => undefined)
    ])
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/api/public-config.js") {
    event.respondWith(networkFirst(request, "/api/public-config.js"));
    return;
  }
  // Never cache authenticated API responses or writes.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/index.html"));
    return;
  }

  if (CACHE_FIRST_PATHS.has(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (NETWORK_FIRST_PATHS.has(url.pathname)) {
    event.respondWith(networkFirst(request, url.pathname));
    return;
  }

  event.respondWith(networkFirst(request, "/index.html"));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    refreshCache(request);
    return cached;
  }
  const response = await fetch(request);
  await putInCache(request, response.clone());
  return response;
}

async function networkFirst(request, fallbackPath) {
  try {
    const response = await fetch(request);
    await putInCache(request, response.clone());
    return response;
  } catch {
    return (await caches.match(request)) || (fallbackPath ? caches.match(fallbackPath) : undefined);
  }
}

function refreshCache(request) {
  fetch(request)
    .then((response) => putInCache(request, response))
    .catch(() => undefined);
}

async function putInCache(request, response) {
  if (!response || !response.ok) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "ShiftPad reminder";
  const options = {
    body: data.body || "A reminder is due.",
    tag: data.tag || "shiftpad-reminder",
    renotify: true,
    badge: "/icons/icon-192.png",
    icon: "/icons/icon-192.png",
    data: {
      url: data.url || "/?view=timeline"
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/?view=timeline", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const matchingClient = clients.find((client) => client.url.startsWith(self.location.origin));
      if (matchingClient) {
        matchingClient.focus();
        matchingClient.navigate(targetUrl);
        return;
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
