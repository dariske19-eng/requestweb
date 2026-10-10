// Jana kad "Request Of: <nama>" daripada templat (assets/card-template.png).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Kedudukan teks pada templat 1672x941 (hujung kiri, garis dasar, lebar maksimum)
const X = 1215, BASELINE = 498, MAX_W = 360, START = 74, MIN = 38;
const ASSETS = path.join(__dirname, '..', 'assets');

function secret() { return process.env.CARD_SECRET || process.env.ADMIN_PASSWORD || ''; }
function sign(name) { return crypto.createHmac('sha256', secret()).update(String(name)).digest('hex').slice(0, 32); }
function verify(name, sig) {
  if (!secret()) return false;
  const a = Buffer.from(sign(name)), b = Buffer.from(String(sig || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function baseUrl() {
  const u = process.env.PUBLIC_BASE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : '');
  return u.replace(/\/$/, '');
}
// pautan awam bertandatangan supaya hanya server ini boleh menjana kad
function cardUrl(name) {
  const base = baseUrl();
  if (!base || !secret()) return '';
  return base + '/api/card?name=' + encodeURIComponent(name) + '&sig=' + sign(name);
}

function fit(ctx, name) {
  for (let s = START; s >= MIN; s -= 2) {
    ctx.font = s + 'px "CardFont"';
    if (ctx.measureText(name).width <= MAX_W) return { text: name, size: s };
  }
  ctx.font = MIN + 'px "CardFont"';
  let t = name;
  while (t.length > 1 && ctx.measureText(t + '…').width > MAX_W) t = t.slice(0, -1);
  return { text: t.trimEnd() + '…', size: MIN };
}

let cache; // muat templat sekali bagi setiap instance fungsi
async function renderCard(name) {
  const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
  if (!cache) {
    GlobalFonts.registerFromPath(path.join(ASSETS, 'card-font.ttf'), 'CardFont');
    cache = await loadImage(fs.readFileSync(path.join(ASSETS, 'card-template.png')));
  }
  const canvas = createCanvas(cache.width, cache.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(cache, 0, 0);
  const { text, size } = fit(ctx, name);
  ctx.font = size + 'px "CardFont"';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillText(text, X + 3, BASELINE + 3);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, X, BASELINE);
  return canvas.toBuffer('image/png');
}
module.exports = { renderCard, cardUrl, sign, verify, fit };
