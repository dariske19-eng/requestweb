// Hantar bukti "completed" ke WhatsApp apabila admin tandakan permintaan sebagai Done.
// Dua cara (boleh guna salah satu):
//  1) WHAPI_TOKEN + WHATSAPP_CHANNEL_ID  -> terus ke Whapi.Cloud (tanpa bot sendiri)
//  2) WHATSAPP_WEBHOOK_URL (+ WHATSAPP_WEBHOOK_SECRET) -> bot anda sendiri
// Gambar: secara lalai kad "Request Of: <nama pemohon>" dijana oleh /api/card.
// NOTIFY_IMAGE_URL menggantikannya dengan gambar tetap; NOTIFY_IMAGE=off mematikan gambar.
const crypto = require('crypto');
const { cardUrl } = require('./card');

const LBL = {
  mob: 'New mob', wpn: 'Weapons & tools', blk: 'Blocks & dimensions', mech: 'Game mechanics',
  tex: 'Texture pack', oth: 'Other', bl: 'Bedrock (latest)', b120: 'Bedrock 1.20.x', java: 'Java (mod)',
};

function buildText(item, doneAt) {
  const date = new Date(doneAt).toLocaleDateString('en-GB', {
    timeZone: process.env.NOTIFY_TIMEZONE || 'Asia/Kuala_Lumpur', day: 'numeric', month: 'long', year: 'numeric',
  });
  // Tiada e-mel dalam mesej kerana channel ini awam.
  return [
    '✅ *Request completed!*',
    '',
    'Addon: ' + item.tajuk,
    'Type: ' + (LBL[item.jenis] || item.jenis) + ' • ' + (LBL[item.versi] || item.versi),
    'Requested by: ' + item.nama,
    'Completed: ' + date,
  ].join('\n');
}

async function post(url, init) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(url.split('/')[2] + ' ' + r.status);
}

async function sendWhapi(token, channel, text, imageUrl) {
  const headers = { accept: 'application/json', 'content-type': 'application/json', authorization: 'Bearer ' + token };
  const base = 'https://gate.whapi.cloud/messages/';
  if (imageUrl) {
    try {
      await post(base + 'image', { method: 'POST', headers, body: JSON.stringify({ to: channel, media: imageUrl, caption: text }) });
      return;
    } catch (e) {
      // jika gambar gagal, hantar teks sahaja supaya bukti tetap sampai
      console.error('image post failed, falling back to text:', e.message);
    }
  }
  await post(base + 'text', { method: 'POST', headers, body: JSON.stringify({ to: channel, body: text }) });
}

// pulangkan 'sent' | 'failed' | 'skipped'
async function notifyDone(item) {
  const token = process.env.WHAPI_TOKEN, channel = process.env.WHATSAPP_CHANNEL_ID;
  const hook = process.env.WHATSAPP_WEBHOOK_URL, secret = process.env.WHATSAPP_WEBHOOK_SECRET || '';
  const imageUrl = process.env.NOTIFY_IMAGE === 'off' ? '' : (process.env.NOTIFY_IMAGE_URL || cardUrl(item.nama));
  const jobs = [];
  const doneAt = Date.now();
  const text = buildText(item, doneAt);

  if (token && channel) jobs.push(sendWhapi(token, channel, text, imageUrl));
  if (hook) {
    const body = JSON.stringify({
      event: 'request.done', text, imageUrl: imageUrl || null,
      request: { id: item.id, tajuk: item.tajuk, nama: item.nama, jenis: item.jenis, versi: item.versi, desc: item.desc, doneAt },
    });
    const headers = { 'content-type': 'application/json' };
    if (secret) headers['x-signature'] = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
    jobs.push(post(hook, { method: 'POST', headers, body }));
  }
  if (!jobs.length) return 'skipped';
  try {
    const res = await Promise.allSettled(jobs);
    res.filter((r) => r.status === 'rejected').forEach((r) => console.error('notify failed:', r.reason && r.reason.message));
    return res.every((r) => r.status === 'fulfilled') ? 'sent' : 'failed';
  } catch (e) { return 'failed'; }
}
module.exports = { notifyDone, buildText };
