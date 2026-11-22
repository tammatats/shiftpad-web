const { test } = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../../api/shiftbook-roster");

async function call(req) {
  const headers = {};
  const response = {
    setHeader(key, value) { headers[key] = value; },
    end(body) { this.body = JSON.parse(body); }
  };
  await handler(req, response);
  return { status: response.statusCode, body: response.body, headers };
}

test("roster proxy requires an authenticated account and forwards only a read to the fixed roster endpoint", async t => {
  const token = "a".repeat(64);
  const environment = process.env;
  process.env = { ...environment, SUPABASE_URL: "https://shiftpad.test", SUPABASE_ANON_KEY: "sample-anon" };
  t.after(() => { process.env = environment; });
  const fetch = t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url === "https://shiftpad.test/auth/v1/user") {
      return options.headers.Authorization === "Bearer fixture-session"
        ? Response.json({ id: "fixture-user" })
        : Response.json({}, { status: 401 });
    }
    assert.equal(url, "https://gkvepgevogveebzjwzyp.supabase.co/functions/v1/shiftbook-roster");
    assert.equal(options.method || "GET", "GET");
    assert.deepEqual(options.headers, { Authorization: `Bearer ${token}` });
    return Response.json({ encrypted: "encrypted-fixture", extra: "not forwarded" });
  });
  assert.equal((await call({ method: "GET" })).status, 405);
  assert.equal((await call({ method: "POST", headers: {}, body: { accessToken: token } })).status, 401);
  assert.equal(fetch.mock.callCount(), 0);
  const result = await call({
    method: "POST", headers: { authorization: "Bearer fixture-session" },
    body: { accessToken: token, url: "https://ignored.example" }
  });
  assert.equal(result.status, 200);
  assert.equal(result.headers["Cache-Control"], "no-store");
  assert.deepEqual(result.body, { encrypted: "encrypted-fixture" });
  assert.equal(fetch.mock.callCount(), 2);
});
