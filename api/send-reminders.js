const webpush = require("web-push");
const { handleApiError, sendJson, supabaseRest } = require("./_supabase");

const CORE_REMINDER_TAGS = ["time", "lab", "io"];
const DEFAULT_WINDOW_MINUTES = 10;

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY.");
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:shiftpad@example.com",
    publicKey,
    privateKey
  );
}

function assertCronAllowed(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${secret}`) {
    const error = new Error("Unauthorized.");
    error.statusCode = 401;
    throw error;
  }
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return sendJson(res, 405, { error: "Method not allowed." });
    }

    assertCronAllowed(req);
    configureWebPush();

    const now = new Date();
    const windowMinutes = Number(process.env.REMINDER_WINDOW_MINUTES || DEFAULT_WINDOW_MINUTES);
    const [states, subscriptions] = await Promise.all([
      supabaseRest("shiftpad_user_state?select=user_id,state_json", { serviceRole: true }),
      supabaseRest("shiftpad_push_subscriptions?select=user_id,endpoint,p256dh,auth,time_zone", { serviceRole: true })
    ]);

    const stateByUser = new Map((states || []).map((row) => [row.user_id, row.state_json]));
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const subscription of subscriptions || []) {
      const state = stateByUser.get(subscription.user_id);
      if (!state) {
        skipped += 1;
        continue;
      }

      const dueReminders = buildDueReminders(state, {
        now,
        timeZone: subscription.time_zone || "UTC",
        windowMinutes
      });

      for (const reminder of dueReminders) {
        const inserted = await reserveDelivery(subscription.user_id, reminder);
        if (!inserted) {
          skipped += 1;
          continue;
        }

        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth
              }
            },
            JSON.stringify({
              title: reminder.title,
              body: reminder.body,
              tag: reminder.tag,
              url: "/?view=timeline"
            })
          );
          sent += 1;
        } catch (error) {
          failed += 1;
          if (error.statusCode === 404 || error.statusCode === 410) {
            await removeSubscription(subscription.endpoint).catch(() => undefined);
          }
          console.warn("Reminder push failed:", error?.message || error);
        }
      }
    }

    return sendJson(res, 200, { ok: true, sent, skipped, failed });
  } catch (error) {
    return handleApiError(res, error);
  }
};

async function reserveDelivery(userId, reminder) {
  const rows = await supabaseRest("shiftpad_notification_deliveries?on_conflict=user_id,reminder_key,scheduled_for", {
    method: "POST",
    serviceRole: true,
    prefer: "resolution=ignore-duplicates,return=representation",
    body: {
      user_id: userId,
      reminder_key: reminder.key,
      scheduled_for: reminder.scheduledFor,
      title: reminder.title,
      body: reminder.body
    }
  });
  return Array.isArray(rows) && rows.length > 0;
}

async function removeSubscription(endpoint) {
  await supabaseRest(`shiftpad_push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
    method: "DELETE",
    serviceRole: true
  });
}

function buildDueReminders(state, { now, timeZone, windowMinutes }) {
  const preferences = normalizePreferences(state.preferences);
  const reminders = [];
  const wards = Array.isArray(state.wards) ? state.wards : [];

  wards.forEach((ward) => {
    const notes = Array.isArray(ward.notes) ? ward.notes : [];
    notes.forEach((note) => {
      if (now.getTime() - Number(note.createdAt || 0) > 48 * 60 * 60 * 1000) return;

      extractTaggedLines(note, preferences).forEach((line) => {
        if (line.done || !line.reminderType) return;

        getReminderTimesForLine(line, preferences, timeZone).forEach((reminderTime) => {
          const scheduled = getScheduledInstant({
            reminderTime,
            noteCreatedAt: Number(note.createdAt) || now.getTime(),
            timeZone,
            now
          });
          const ageMs = now.getTime() - scheduled.getTime();
          if (ageMs < 0 || ageMs > windowMinutes * 60 * 1000) return;

          const typeLabel = getReminderTypeLabel(line.reminderType, preferences);
          const bedText = line.bedLabel ? `Bed ${line.bedLabel.toUpperCase()}` : ward.name || "ShiftPad";
          const summary = line.text || line.visibleText || "Reminder due";
          reminders.push({
            key: [note.id || "note", line.lineIndex, line.reminderTokenId || line.primaryTokenId || line.reminderType, reminderTime].join(":"),
            scheduledFor: scheduled.toISOString(),
            title: `${formatTimeLabel(reminderTime)} ${typeLabel || "Reminder"}`,
            body: `${ward.name || "Ward"}${line.bedLabel ? ` · ${bedText}` : ""}: ${summary}`.slice(0, 180),
            tag: `shiftpad-${note.id || "note"}-${line.lineIndex}-${reminderTime}`.replace(/[^a-z0-9_.:-]/gi, "-")
          });
        });
      });
    });
  });

  return reminders;
}

function normalizePreferences(input = {}) {
  return {
    tagDelays: {
      time: clampDelay(input.tagDelays?.time, 0),
      lab: clampDelay(input.tagDelays?.lab, 60),
      io: clampDelay(input.tagDelays?.io, 0)
    },
    customTags: Array.isArray(input.customTags)
      ? input.customTags
          .map((tag) => ({
            id: String(tag.id || ""),
            label: String(tag.label || ""),
            hasReminder: Boolean(tag.hasReminder),
            delayMinutes: clampDelay(tag.delayMinutes, 0)
          }))
          .filter((tag) => tag.id && tag.label)
      : []
  };
}

function extractTaggedLines(note, preferences) {
  const html = String(note.documentHtml || "");
  if (!html.trim()) {
    return extractLegacyEntryLines(note, preferences);
  }

  const lines = [];
  let currentBed = "";
  const blocks = html.match(/<(div|p)\b[^>]*>[\s\S]*?<\/\1>/gi) || [];

  blocks.forEach((block) => {
    const parsed = parseLineHtml(block);
    const bedTag = parsed.tags.find((tag) => tag.type === "bed");
    if (bedTag) {
      currentBed = bedTag.text.replace(/^Bed\s*/i, "").trim();
      return;
    }

    const reminderTag = parsed.tags.find((tag) => isReminderTagType(tag.type, preferences));
    const timeTag = reminderTag && reminderTag.type !== "io" ? reminderTag : null;
    const primaryTag = parsed.tags.find((tag) => tag.type !== "bed" && !isReminderTagType(tag.type, preferences));
    const cleanedText = stripTagPrefixes(parsed.text, parsed.tags);
    const visibleText = parsed.visibleText.trim();
    if (!cleanedText && !reminderTag && !primaryTag && !visibleText) return;

    lines.push({
      lineIndex: lines.length,
      text: cleanedText,
      visibleText,
      bedLabel: currentBed,
      timeTag: timeTag?.text || "",
      noteCreatedAt: Number(note.createdAt) || Date.now(),
      reminderType: reminderTag?.type || "",
      reminderTokenId: reminderTag?.id || "",
      primaryTokenId: primaryTag?.id || "",
      done: Boolean(reminderTag?.done),
      timeAtStart: Boolean(parsed.timeAtStart && reminderTag && reminderTag.type !== "io")
    });
  });

  return lines;
}

function extractLegacyEntryLines(note) {
  return (Array.isArray(note.entries) ? note.entries : []).map((entry, index) => ({
    lineIndex: index,
    text: String(entry.text || ""),
    visibleText: String(entry.text || ""),
    bedLabel: String(entry.bedTag || ""),
    timeTag: String(entry.timeTag || ""),
    noteCreatedAt: Number(note.createdAt) || Date.now(),
    reminderType: entry.timeTag ? (entry.kind === "lab" ? "lab" : "time") : "",
    reminderTokenId: String(entry.id || ""),
    primaryTokenId: String(entry.id || ""),
    done: Boolean(entry.done),
    timeAtStart: false
  }));
}

function parseLineHtml(block) {
  const tags = [];
  const tagRegex = /<span\b([^>]*)class="[^"]*\btag-token\b[^"]*"([^>]*)>([\s\S]*?)<\/span>/gi;
  let match;
  while ((match = tagRegex.exec(block))) {
    const attrs = `${match[1]} ${match[2]}`;
    tags.push({
      type: getAttr(attrs, "data-tag") || "general",
      text: decodeHtml(stripTags(match[3])).trim(),
      id: getAttr(attrs, "data-token-id") || "",
      done: getAttr(attrs, "data-done") === "true"
    });
  }

  const firstTagMatch = block.match(/<(span)\b[^>]*\btag-token\b/i);
  const text = decodeHtml(stripTags(block)).replace(/\s+/g, " ").trim();
  return {
    tags,
    text,
    visibleText: text,
    timeAtStart: Boolean(firstTagMatch && ["time", "lab"].includes(tags[0]?.type))
  };
}

function getAttr(attrs, name) {
  const match = String(attrs || "").match(new RegExp(`${name}="([^"]*)"`, "i"));
  return match ? decodeHtml(match[1]) : "";
}

function stripTags(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTagPrefixes(text, tags) {
  let cleaned = String(text || "").trim();
  tags.forEach((tag) => {
    if (cleaned.toLowerCase().startsWith(tag.text.toLowerCase())) {
      cleaned = cleaned.slice(tag.text.length).trim();
    }
  });
  return cleaned;
}

function isReminderTagType(type, preferences) {
  if (CORE_REMINDER_TAGS.includes(type)) return true;
  return Boolean(preferences.customTags.find((tag) => tag.id === type && tag.hasReminder));
}

function getReminderTimesForLine(line, preferences, timeZone = "UTC") {
  if (!line?.reminderType) return [];
  if (line.reminderType === "time" && line.timeTag) {
    return [addMinutesToTime(line.timeTag, preferences.tagDelays.time)];
  }
  if (line.reminderType === "lab" && line.timeTag) {
    return [addMinutesToTime(line.timeTag, preferences.tagDelays.lab)];
  }
  if (line.reminderType === "io") {
    const baseTimes = getShiftDurationHours(line.noteCreatedAt) === 24 ? ["14.00", "22.00"] : ["22.00"];
    return baseTimes.map((time) => addMinutesToTime(time, preferences.tagDelays.io));
  }
  const customTag = preferences.customTags.find((tag) => tag.id === line.reminderType);
  if (customTag?.hasReminder) {
    const startTime = formatTimeFromTimestamp(line.noteCreatedAt, timeZone);
    return [addMinutesToTime(startTime, customTag.delayMinutes)];
  }
  return [];
}

function getScheduledInstant({ reminderTime, noteCreatedAt, timeZone }) {
  const createdParts = getZonedParts(new Date(noteCreatedAt), timeZone);
  const createdMinutes = createdParts.hour * 60 + createdParts.minute;
  const reminderMinutes = parseTime(reminderTime);
  let localDate = {
    year: createdParts.year,
    month: createdParts.month,
    day: createdParts.day,
    hour: Math.floor(reminderMinutes / 60),
    minute: reminderMinutes % 60
  };

  if (reminderMinutes < createdMinutes && getShiftDurationHours(noteCreatedAt, timeZone) === 24) {
    localDate = addLocalDays(localDate, 1);
  }

  return zonedTimeToUtc(localDate, timeZone);
}

function getShiftDurationHours(timestamp, timeZone = "UTC") {
  const parts = getZonedParts(new Date(Number(timestamp) || Date.now()), timeZone);
  const minutes = parts.hour * 60 + parts.minute;
  return minutes < 14 * 60 + 30 ? 24 : 16;
}

function getZonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute)
  };
}

function zonedTimeToUtc(localDate, timeZone) {
  let guess = Date.UTC(localDate.year, localDate.month - 1, localDate.day, localDate.hour, localDate.minute);
  for (let i = 0; i < 2; i += 1) {
    const parts = getZonedParts(new Date(guess), timeZone);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    const target = Date.UTC(localDate.year, localDate.month - 1, localDate.day, localDate.hour, localDate.minute);
    guess += target - asUtc;
  }
  return new Date(guess);
}

function addLocalDays(localDate, days) {
  const date = new Date(Date.UTC(localDate.year, localDate.month - 1, localDate.day + days, localDate.hour, localDate.minute));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: localDate.hour,
    minute: localDate.minute
  };
}

function parseTime(value) {
  const normalized = normalizeTimeTagValue(value);
  if (!/^\d{1,2}\.\d{2}$/.test(normalized)) return 0;
  const [hours, minutes] = normalized.split(".").map(Number);
  return hours * 60 + minutes;
}

function formatTimeFromMinutes(totalMinutes) {
  const safe = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${hours}.${String(minutes).padStart(2, "0")}`;
}

function addMinutesToTime(value, minutesToAdd) {
  return formatTimeFromMinutes(parseTime(value) + Number(minutesToAdd || 0));
}

function formatTimeFromTimestamp(timestamp, timeZone = "UTC") {
  const parts = getZonedParts(new Date(Number(timestamp) || Date.now()), timeZone);
  return formatTimeFromMinutes(parts.hour * 60 + parts.minute);
}

function normalizeTimeTagValue(value) {
  const cleaned = String(value || "").replace(/[^\d:.]/g, "").replace(":", ".");
  const match = cleaned.match(/^(\d{1,2})(?:\.(\d{0,2}))?$/);
  if (!match) return "";
  const hours = Math.max(0, Math.min(23, Number(match[1])));
  const minutes = Math.max(0, Math.min(59, Number((match[2] || "0").padEnd(2, "0"))));
  return `${hours}.${String(minutes).padStart(2, "0")}`;
}

function clampDelay(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(-720, Math.min(720, Math.round(number)));
}

function getReminderTypeLabel(type, preferences) {
  if (type === "time") return "Time";
  if (type === "lab") return "Lab";
  if (type === "io") return "I/O";
  return preferences.customTags.find((tag) => tag.id === type)?.label || "Reminder";
}

function formatTimeLabel(value) {
  return normalizeTimeTagValue(value).replace(".", ":");
}
