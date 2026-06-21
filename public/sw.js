// ============================================================
// sw.js — Service Worker
//
// Enables PWA installability ("Add to Home Screen" on iOS/Android)
// by satisfying the browser's criteria for a progressive web app.
//
// Caching strategy: network-first with cache fallback.
//   - Always tries the network first so users see fresh content.
//   - Falls back to the cached shell if offline.
//   - Supabase API calls are never cached (always go to network).
//
// To update the cache after a new deployment, bump CACHE_NAME
// (e.g. v1 → v2). The activate handler will clean up old caches.
// ============================================================

const CACHE_NAME = "overtime-tracker-v1";

// App shell files to pre-cache on install.
// These are the minimum needed to render the page offline.
const SHELL_FILES = ["/", "/index.html"];

// ── Install: pre-cache the app shell ─────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES))
  );
  // Don't wait for old service workers to stop — activate immediately
  self.skipWaiting();
});

// ── Activate: delete old caches from previous versions ───────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME) // keep only the current cache
          .map(key => caches.delete(key))
      )
    )
  );
  // Take control of all open tabs immediately (no refresh needed)
  self.clients.claim();
});

// ── Fetch: network-first, cache fallback ─────────────────────
self.addEventListener("fetch", event => {
  // Let Supabase requests pass through without caching —
  // we always want live data from the API
  if (event.request.url.includes("supabase.co")) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache a copy of successful responses for offline use
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        // Network failed (offline) — serve from cache if available
        caches.match(event.request)
      )
  );
});
