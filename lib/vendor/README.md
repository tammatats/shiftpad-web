# Supabase browser SDK

`supabase-js-2.118.0.js` is the unmodified UMD browser distribution from the official `@supabase/supabase-js` npm package, pinned locally so offline reopening does not depend on a CDN. License: MIT; see `supabase-js-LICENSE`.

- Package: `https://registry.npmjs.org/@supabase/supabase-js/-/supabase-js-2.118.0.tgz`
- npm tarball integrity (verified before extraction): `sha512-FxI8UXMVC2UG7IkeiI8fuQZqq2oI3JeSuN8MPIC2RLVaoEAxKS0nqE6kii9Ewpq8f9gNPM6git1Y8f0vN/QLFw==`
- Browser bundle SHA-256: `ee3be8de192b97cb1d73d1e95d6b82bb1f6b658c0f97c4ef757fc331996ed3d3`

The service worker caches the public configuration endpoint separately from authenticated API routes. It does not cache authenticated API responses, session credentials, or note data. Offline access still requires a usable persisted Supabase session; the app does not synthesize a user or bypass authentication.

To update, obtain the exact version from the official npm package, verify its registry integrity, copy `dist/umd/supabase.js` and its license, then update this record, the app URL, and service worker assets together. Validate the normal authenticated offline bootstrap test before release.
