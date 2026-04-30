function getSupabaseConfig({ serviceRole = false } = {}) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = serviceRole ? serviceRoleKey : anonKey;

  if (!supabaseUrl || !key) {
    throw new Error(serviceRole ? "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." : "Missing SUPABASE_URL or SUPABASE_ANON_KEY.");
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ""),
    key
  };
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

async function verifySupabaseUser(req) {
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error("Missing authorization token.");
    error.statusCode = 401;
    throw error;
  }

  const { supabaseUrl, key } = getSupabaseConfig();
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = new Error("Invalid or expired session.");
    error.statusCode = 401;
    throw error;
  }

  return {
    token,
    user: await response.json()
  };
}

async function supabaseRest(path, { method = "GET", body, serviceRole = false, token, prefer, select } = {}) {
  const { supabaseUrl, key } = getSupabaseConfig({ serviceRole });
  const headers = {
    apikey: key,
    Authorization: `Bearer ${token || key}`
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (prefer) {
    headers.Prefer = prefer;
  }
  if (select) {
    headers.Select = select;
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || response.statusText);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function handleApiError(res, error) {
  console.error(error);
  sendJson(res, error.statusCode || 500, {
    error: error.message || "Server error."
  });
}

module.exports = {
  getBearerToken,
  handleApiError,
  sendJson,
  supabaseRest,
  verifySupabaseUser
};
