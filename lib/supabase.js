// Sahkan token Supabase melalui API Auth (tanpa dependency).
async function verifyUser(req) {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_ANON_KEY;
  const m = /^Bearer (.+)$/.exec(String(req.headers.authorization || ''));
  if (!url || !key || !m) return null;
  try {
    const r = await fetch(url + '/auth/v1/user', { headers: { apikey: key, Authorization: 'Bearer ' + m[1] } });
    if (!r.ok) return null;
    const u = await r.json();
    const meta = u && u.user_metadata ? u.user_metadata : {};
    return u && u.id ? { id: u.id, email: u.email || '', name: String(meta.name || meta.full_name || '') } : null;
  } catch (e) { return null; }
}
module.exports = { verifyUser };
