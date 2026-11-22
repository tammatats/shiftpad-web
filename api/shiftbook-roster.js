const { verifySupabaseUser, sendJson } = require("./_supabase");
const SHIFTBOOK_ROSTER_URL = "https://gkvepgevogveebzjwzyp.supabase.co/functions/v1/shiftbook-roster";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Use POST to read the roster." });
  }
  const accessToken = req.body?.accessToken;
  if (typeof accessToken !== "string" || !/^[a-f0-9]{64}$/.test(accessToken)) {
    return sendJson(res, 400, { error: "Enter a valid Shiftbook link code." });
  }
  try {
    await verifySupabaseUser(req);
  } catch (error) {
    return error.statusCode === 401
      ? sendJson(res, 401, { error: "Sign in to ShiftPad and try again." })
      : sendJson(res, 503, { error: "ShiftPad could not verify your session. Try again." });
  }
  try {
    // Only the derived access token goes upstream. The encryption key and
    // decrypted roster remain in the user's browser.
    const response = await fetch(SHIFTBOOK_ROSTER_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      redirect: "error",
      signal: AbortSignal.timeout(10000)
    });
    if (response.status === 401 || response.status === 403) {
      return sendJson(res, 404, { error: "That roster link is inactive. Copy the current link code from Shiftbook." });
    }
    if (!response.ok) throw new Error("Roster request failed");
    const { encrypted } = await response.json();
    if (encrypted == null) {
      return sendJson(res, 404, { error: "There is no synced roster yet. Sync your roster from Shiftbook first." });
    }
    if (typeof encrypted !== "string" || !/^[A-Za-z0-9_-]+$/.test(encrypted)) throw new Error("Invalid roster response");
    if (encrypted.length > 4_000_000) {
      return sendJson(res, 413, { error: "This roster is too large to load here. Use the manual ward list for this shift." });
    }
    return sendJson(res, 200, { encrypted });
  } catch {
    return sendJson(res, 503, { error: "Shiftbook could not be reached. Try again when online." });
  }
};
