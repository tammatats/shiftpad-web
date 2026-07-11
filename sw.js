const CACHE_NAME = "shiftpad-shell-v12";
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
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
const NETWORK_FIRST_PATHS = new Set(["/app.js", "/styles.css"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => undefined)
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
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/index.html"));
    return;
  }

  if (CACHE_FIRST_PATHS.has(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (NETWORK_FIRST_PATHS.has(url.pathname)) {
    event.respondWith(networkFirst(request));
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
