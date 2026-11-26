const CACHE_NAME = "shiftpad-shell-v80";
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
  "/lib/shiftbook-setup.js",
  "/lib/shiftbook-dialog.js",
  "/styles/shiftbook-setup.css",
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
  "/lib/shiftbook-setup.js",
  "/lib/shiftbook-dialog.js",
  "/styles/shiftbook-setup.css",
  "/styles/editor-controls.css",
  "/styles/navigation.css",
  "/styles/sync-details.css"
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(async (cache) => {
        await cache.addAll(SHELL_ASSETS);
        if (!await isAppPage(await cache.match("/index.html"))) {
          throw new Error("ShiftPad update is missing a complete app page.");
        }
      }),
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
    const page = reopenAppPage(request);
    event.waitUntil(page.then(({ response, fromNetwork }) => {
      if (fromNetwork) return putInCache("/index.html", response.clone());
    }));
    event.respondWith(page.then(({ response }) => response));
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

async function isAppPage(response) {
  if (!response?.ok || !response.headers.get("content-type")?.includes("text/html")) return false;
  try {
    const html = await response.clone().text();
    return html.includes("data-startup-status") && /<script\s+src="app\.js[?"]/.test(html);
  } catch {
    return false;
  }
}

async function reopenAppPage(request) {
  const controller = new AbortController();
  const networkTimeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(request, { signal: controller.signal });
    // Even a successful status can deliver an empty or incomplete page.
    if (await isAppPage(response)) return { response, fromNetwork: true };
  } catch {
    // Use the last working page if resuming the network stalls or fails.
  } finally {
    clearTimeout(networkTimeout);
  }

  let cacheTimeout;
  try {
    const cachedPage = matchCached("/index.html").then(async response => (await isAppPage(response)) ? response : null);
    const response = await Promise.race([
      cachedPage,
      new Promise(resolve => { cacheTimeout = setTimeout(() => resolve(null), 1000); })
    ]);
    return { response: response || reopenFallback(), fromNetwork: false };
  } finally {
    clearTimeout(cacheTimeout);
  }
}

function reopenFallback() {
  return new Response(`<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#f4efe7">
<title>Reopen ShiftPad</title>
<style>
  body { margin: 0; background: #f4efe7; color: #241c16; font: 1rem/1.5 system-ui, sans-serif; }
  main { max-width: 28rem; margin: max(3rem, 12vh) auto 0; padding: 0 1.25rem; }
  h1 { font-size: 1.5rem; line-height: 1.2; }
  a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 1rem;
      border-radius: .75rem; background: #241c16; color: #fffaf4; font-weight: 600; }
</style>
<main>
  <h1>ShiftPad couldn’t reopen</h1>
  <p>Check your connection and try again.</p>
  <a href="">Retry</a>
</main>
</html>`, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

// Cache storage is optional at runtime (iOS can evict it or reject writes).
// A cache failure must never turn a successful network response into a blank app.
async function matchCached(request, fallbackPath) {
  try {
    return (await caches.match(request)) || (fallbackPath ? await caches.match(fallbackPath) : undefined);
  } catch {
    return undefined;
  }
}

async function cacheFirst(request) {
  const cached = await matchCached(request);
  if (cached) {
    refreshCache(request);
    return cached;
  }
  const response = await fetch(request);
  await putInCache(request, response.clone());
  return response;
}

async function networkFirst(request, fallbackPath) {
  // A suspended/resumed iOS connection can stall without rejecting fetch.
  // Bound shell requests so an installed working copy can still open.
  const cached = await matchCached(request, fallbackPath);
  const controller = new AbortController();
  // First-time requests with no fallback keep the normal network lifetime.
  const timeout = cached ? setTimeout(() => controller.abort(), 4000) : null;
  try {
    const response = await fetch(request, { signal: controller.signal });
    if (!response.ok) return cached || response;
    await putInCache(request, response.clone());
    return response;
  } catch {
    return cached || matchCached(request, fallbackPath);
  } finally {
    if (timeout !== null) clearTimeout(timeout);
  }
}

function refreshCache(request) {
  fetch(request)
    .then((response) => putInCache(request, response))
    .catch(() => undefined);
}

async function putInCache(request, response) {
  if (!response || !response.ok) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response);
  } catch {
    // Keep the fetched response usable when storage is full/unavailable.
  }
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
