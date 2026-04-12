module.exports = function handler(_req, res) {
  const config = {
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ""
  };

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(`window.SHIFTPAD_PUBLIC_CONFIG = ${JSON.stringify(config)};`);
};
