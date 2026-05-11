module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    SUPABASE_URL:     process.env.SUPABASE_URL     || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
    ADMIN_PASSWORD:   process.env.ADMIN_PASSWORD   || '',
  });
};
