module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end([
    `const SUPABASE_URL = ${JSON.stringify(process.env.SUPABASE_URL || '')};`,
    `const SUPABASE_ANON_KEY = ${JSON.stringify(process.env.SUPABASE_ANON_KEY || '')};`,
    `const ADMIN_PASSWORD = ${JSON.stringify(process.env.ADMIN_PASSWORD || '')};`,
  ].join('\n'));
};
