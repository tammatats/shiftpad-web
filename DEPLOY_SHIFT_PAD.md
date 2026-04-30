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
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `CRON_SECRET`

These are exposed to the browser through:

- [api/public-config.js](/Users/tammatatsuttivejvorakul/Documents/New%20project/api/public-config.js)

Only `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `VAPID_PUBLIC_KEY` are exposed to the browser. Keep `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, and `CRON_SECRET` secret in Vercel.

Generate VAPID keys locally with:

```bash
npm install
npm run vapid
```

Use the generated public key for `VAPID_PUBLIC_KEY` and the generated private key for `VAPID_PRIVATE_KEY`. Use a contact value like `mailto:you@example.com` for `VAPID_SUBJECT`.

## 3. Deploy

Deploy this folder to Vercel. The app root is:

- [index.html](/Users/tammatatsuttivejvorakul/Documents/New%20project/index.html)

## 4. Enable iPhone notifications

After deployment:

1. On iPhone, open ShiftPad in Safari.
2. Tap Share -> Add to Home Screen.
3. Open ShiftPad from the Home Screen icon.
4. Sign in.
5. Open Menu -> Settings.
6. Tap Enable under iPhone notifications.

iOS requires the Home Screen app flow for web push.

## 5. Reminder sending

The app includes:

- `/api/push-subscriptions` to store each device subscription
- `/api/send-reminders` to send due reminder notifications

Call `/api/send-reminders` every 5 to 10 minutes from a scheduler and send this header:

```text
Authorization: Bearer your_CRON_SECRET
```

Important: Vercel Hobby cron jobs can only run once per day, so exact reminder notifications need either Vercel Pro cron or an external scheduler such as cron-job.org, GitHub Actions, or Supabase scheduled jobs.

## 6. What is stored

This version stores one private cloud state document per authenticated user in Supabase:

- `shiftpad_user_state.user_id`
- `shiftpad_user_state.state_json`

That keeps users separated immediately without rewriting the whole note model into many relational tables.

Notification support also stores:

- `shiftpad_push_subscriptions`
- `shiftpad_notification_deliveries`

## 7. Next upgrade

If you later want shared wards, team handover, audit logs, or device sync conflict handling, the next step is to normalize the data into tables like:

- `profiles`
- `wards`
- `notes`
- `note_lines`
- `reminders`
