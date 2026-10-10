const { renderCard, verify } = require('../lib/card');

module.exports = async (req, res) => {
  try {
    const name = String((req.query && req.query.name) || '').trim();
    if (!name || name.length > 40) return res.status(400).json({ error: 'invalid_name' });
    if (!verify(name, req.query.sig)) return res.status(403).json({ error: 'bad_signature' });
    const png = await renderCard(name);
    res.setHeader('Content-Type', 'image/png');
    // URL ini tidak berubah bagi nama yang sama, jadi boleh dicache lama
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).end(png);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'render_failed' });
  }
};
