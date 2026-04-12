# ShiftPad Deploy Setup

## 1. Create Supabase project

Create a Supabase project, then in SQL Editor run:

- [supabase/shiftpad-schema.sql](/Users/tammatatsuttivejvorakul/Documents/New%20project/supabase/shiftpad-schema.sql)

In Supabase Auth:

- enable Email auth
- choose whether email confirmation is required

## 2. Add Vercel environment variables

In Vercel Project Settings -> Environment Variables, add:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

These are exposed to the browser through:

- [api/public-config.js](/Users/tammatatsuttivejvorakul/Documents/New%20project/api/public-config.js)

## 3. Deploy

Deploy this folder to Vercel. The app root is:

- [index.html](/Users/tammatatsuttivejvorakul/Documents/New%20project/index.html)

## 4. What is stored

This version stores one private cloud state document per authenticated user in Supabase:

- `shiftpad_user_state.user_id`
- `shiftpad_user_state.state_json`

That keeps users separated immediately without rewriting the whole note model into many relational tables.

## 5. Next upgrade

If you later want shared wards, team handover, audit logs, or device sync conflict handling, the next step is to normalize the data into tables like:

- `profiles`
- `wards`
- `notes`
- `note_lines`
- `reminders`
