const webpush = require("web-push");
const { handleApiError, sendJson, supabaseRest, verifySupabaseUser } = require("./_supabase");

function getSubscriptionInput(body) {
  const subscription = body?.subscription || {};
  const endpoint = String(subscription.endpoint || "").trim();
  const p256dh = String(subscription.keys?.p256dh || "").trim();
  const auth = String(subscription.keys?.auth || "").trim();

  if (!endpoint || !p256dh || !auth) {
    const error = new Error("Invalid push subscription.");
    error.statusCode = 400;
    throw error;
  }

  return {
    endpoint,
    p256dh,
    auth,
    timeZone: String(body?.timeZone || "").slice(0, 80)
  };
}

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:shiftpad@example.com",
    publicKey,
    privateKey
  );
  return true;
}

async function sendWelcomePush(subscription) {
  if (!configureWebPush()) return;
  await webpush
    .sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth
        }
      },
      JSON.stringify({
        title: "ShiftPad notifications enabled",
        body: "Reminder alerts can now appear on this device.",
        tag: "shiftpad-notifications-enabled",
        url: "/?view=timeline"
      })
    )
    .catch((error) => {
      console.warn("Welcome push failed:", error?.message || error);
    });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST" && req.method !== "DELETE") {
      res.setHeader("Allow", "POST, DELETE");
      return sendJson(res, 405, { error: "Method not allowed." });
    }

    const { token, user } = await verifySupabaseUser(req);
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    if (req.method === "DELETE") {
      const endpoint = String(body.endpoint || "").trim();
      if (endpoint) {
        await supabaseRest(`shiftpad_push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
          method: "DELETE",
          token
        });
      }
      return sendJson(res, 200, { ok: true });
    }

    const subscription = getSubscriptionInput(body);
    await supabaseRest("shiftpad_push_subscriptions?on_conflict=endpoint", {
      method: "POST",
      token,
      prefer: "resolution=merge-duplicates",
      body: {
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        time_zone: subscription.timeZone,
        user_agent: String(req.headers["user-agent"] || "").slice(0, 240),
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    });

    await sendWelcomePush(subscription);
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return handleApiError(res, error);
  }
};
