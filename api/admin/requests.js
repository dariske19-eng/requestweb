const crypto = require('crypto');
const store = require('../../lib/store');
const { notifyDone } = require('../../lib/notify');

const STATUSES = ['new', 'progress', 'done', 'rejected'];

function passwordOk(req) {
  const pw = process.env.ADMIN_PASSWORD || '';
  const got = String(req.headers['x-admin-password'] || '');
  const a = Buffer.from(pw), b = Buffer.from(got);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!store.configured()) return res.status(500).json({ error: 'db_not_configured' });
  if (!process.env.ADMIN_PASSWORD) return res.status(500).json({ error: 'no_password' });
  try {
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    if (await store.isLocked(ip)) return res.status(429).json({ error: 'too_many' });
    if (!passwordOk(req)) {
      await store.recordFail(ip);
      return res.status(401).json({ error: 'unauthorized' });
    }

    if (req.method === 'GET') {
      const items = (await store.listEverything()).sort((a, b) => (b.ts || 0) - (a.ts || 0));
      return res.status(200).json({ items });
    }
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    const id = String(b.id || ''), uid = String(b.uid || '');
    if (!store.ID_RE.test(id) || !store.UID_RE.test(uid)) return res.status(400).json({ error: 'invalid_id' });

    if (req.method === 'PATCH') {
      if (!STATUSES.includes(b.status)) return res.status(400).json({ error: 'invalid_status' });
      const item = await store.getItem(uid, id);
      if (!item) return res.status(404).json({ error: 'not_found' });
      const prev = item.status;
      item.status = b.status;
      // Hantar bukti ke WhatsApp sekali sahaja apabila status bertukar kepada Done.
      let notify = 'skipped';
      if (b.status === 'done' && prev !== 'done' && !item.notified) {
        notify = await notifyDone(item);
        if (notify === 'sent') item.notified = Date.now();
      }
      await store.saveItem(item);
      return res.status(200).json({ ok: true, notify });
    }
    if (req.method === 'DELETE') {
      await store.removeItem(uid, id);
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, PATCH, DELETE');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server' });
  }
};
