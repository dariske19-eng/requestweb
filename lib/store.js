// Penyimpanan menggunakan Vercel Blob (private store).
// Satu fail JSON bagi setiap permintaan: requests/<uid>/<id>.json
const crypto = require('crypto');
const { put, get, list, del } = require('@vercel/blob');

const UID_RE = /^[0-9a-fA-F-]{36}$/;
const ID_RE = /^[0-9a-f-]{36}$/;
const path = (uid, id) => `requests/${uid}/${id}.json`;

function configured() { return !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID); }

async function readJson(pathname) {
  const r = await get(pathname, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200 || !r.stream) return null;
  return JSON.parse(await new Response(r.stream).text());
}
async function writeJson(pathname, obj) {
  await put(pathname, JSON.stringify(obj), {
    access: 'private', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json', cacheControlMaxAge: 60,
  });
}
async function listBlobs(prefix, max = 1000) {
  let cursor, blobs = [];
  do {
    const r = await list({ prefix, cursor, limit: Math.min(1000, max - blobs.length) });
    blobs = blobs.concat(r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor && blobs.length < max);
  return blobs;
}
async function mapLimit(arr, n, fn) {
  const out = new Array(arr.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, arr.length) }, async () => {
    while (i < arr.length) { const k = i++; out[k] = await fn(arr[k]); }
  }));
  return out;
}
async function readMany(blobs) {
  const items = await mapLimit(blobs, 10, (b) => readJson(b.pathname).catch(() => null));
  return items.filter(Boolean);
}

module.exports = {
  UID_RE, ID_RE, configured,
  saveItem: (item) => writeJson(path(item.uid, item.id), item),
  getItem: (uid, id) => readJson(path(uid, id)),
  removeItem: (uid, id) => del(path(uid, id)),
  listUser: async (uid) => readMany(await listBlobs(`requests/${uid}/`, 200)),
  listEverything: async () => readMany(await listBlobs('requests/', 1000)),
  // bilangan permintaan pengguna yang dicipta dalam tempoh sejam lepas
  countRecent: async (uid, sinceMs) => (await listBlobs(`requests/${uid}/`, 1000))
    .filter((b) => new Date(b.uploadedAt).getTime() > sinceMs).length,
  // sekatan percubaan kata laluan admin yang salah (anggaran, bukan atomik)
  isLocked: async (ip) => {
    const f = await readJson('fail/' + hash(ip) + '.json').catch(() => null);
    return !!(f && f.count >= 10 && Date.now() < f.until);
  },
  recordFail: async (ip) => {
    const p = 'fail/' + hash(ip) + '.json';
    const f = await readJson(p).catch(() => null);
    const now = Date.now();
    const count = f && now < f.until ? f.count + 1 : 1;
    await writeJson(p, { count, until: now + 15 * 60 * 1000 });
  },
};
function hash(s) { return crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 32); }
