# Codex Notes

## Project

ShiftPad is a static web app with Vercel serverless API routes and Supabase-backed data.

## Setup

- Install dependencies with `npm install`.
- Required runtime secrets should be configured in the deployment environment, not committed.
- Use `.env.example` as the reference for environment variable names.

## Checks

- Run the full automated suite with `npm test` after behavior or UI changes.
- For JavaScript syntax checks, run:

```bash
node --check app.js
node --check sw.js
for file in api/*.js; do node --check "$file"; done
```

## Visual validation

- Do not call a UI or responsive-layout change finished based only on code review, geometry assertions, or automated tests.
- Visually inspect the rendered result in a browser after the change. For production issues, inspect the deployed production build whenever it is safe to do so.
- Validate every viewport relevant to the request, including desktop Chrome/Safari and iPhone/iPad or split-screen widths when those layouts are affected.
- Check the actual visible content for overlap, clipping, unexpected scrolling, hidden controls, layout shifts, and keyboard interactions. Add a regression test for any visual defect found.
- State clearly which rendered environments were visually inspected. Never claim visual validation when only automated or numerical checks were performed.

## Boundaries

- Do not commit `.env` files, Supabase service keys, VAPID private keys, or generated credentials.
- Avoid changing `supabase/shiftpad-schema.sql` unless the task is specifically database-related.
