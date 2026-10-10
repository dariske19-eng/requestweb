const crypto = require('crypto');
const store = require('../lib/store');
const { verifyUser } = require('../lib/supabase');

const TYPES = ['mob', 'wpn', 'blk', 'mech', 'tex', 'oth'];
const VERS = ['bl', 'b120', 'java'];
const clean = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const pub = (i) => ({ id: i.id, nama: i.nama, tajuk: i.tajuk, jenis: i.jenis, versi: i.versi, desc: i.desc, ts: i.ts, status: i.status });

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!store.configured()) return res.status(500).json({ error: 'db_not_configured' });
  try {
    // Semua operasi memerlukan pengguna yang sudah login (Supabase Auth).
    const user = await verifyUser(req);
    if (!user || !store.UID_RE.test(user.id)) return res.status(401).json({ error: 'unauthorized' });

    if (req.method === 'GET') {
      // Pengguna hanya melihat permintaan miliknya sendiri.
      const items = (await store.listUser(user.id)).map(pub).sort((a, b) => (b.ts || 0) - (a.ts || 0));
      return res.status(200).json({ items });
    }

    if (req.method === 'POST') {
      const b = req.body && typeof req.body === 'object' ? req.body : {};
      const item = {
        // nama diambil daripada akaun (diisi semasa Register); nama dalam borang hanya untuk akaun lama
        nama: clean(user.name, 40) || clean(b.nama, 40), tajuk: clean(b.tajuk, 60),
        jenis: b.jenis, versi: b.versi, desc: clean(b.desc, 500),
      };
      if (!item.nama || !item.tajuk || item.desc.length < 15 ||
          !TYPES.includes(item.jenis) || !VERS.includes(item.versi)) {
        return res.status(400).json({ error: 'invalid' });
      }
      // had 10 permintaan sejam bagi setiap pengguna
      if ((await store.countRecent(user.id, Date.now() - 3600 * 1000)) >= 10) {
        return res.status(429).json({ error: 'rate_limited' });
      }
      item.id = crypto.randomUUID();
      item.ts = Date.now();
      item.status = 'new';
      item.uid = user.id;
      item.email = user.email;
      await store.saveItem(item);
      return res.status(201).json({ ok: true, item: pub(item) });
    }

    if (req.method === 'DELETE') {
      const b = req.body && typeof req.body === 'object' ? req.body : {};
      const id = String(b.id || '');
      if (!store.ID_RE.test(id)) return res.status(400).json({ error: 'invalid_id' });
      // laluan fail mengandungi ID pengguna sendiri, jadi hanya miliknya boleh dipadam
      if (!(await store.getItem(user.id, id))) return res.status(404).json({ error: 'not_found' });
      await store.removeItem(user.id, id);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server' });
  }
};
