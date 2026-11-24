// Draws the app icons and the link-preview image as PNGs, with no dependencies.
// Run from the repo root: node tools/make-icons.js
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OX = [110, 15, 34], OX_LIGHT = [150, 62, 80], LIME = [255, 255, 255],
  GOLD = [227, 178, 69], YARD = [239, 229, 220], STAGE = [138, 106, 79], STAGE_DARK = [97, 74, 55];
const BAYS = 20, DONE = 13; // bays 0..12 filled, bay 13 is "today"

// colour of one point; u,v in units where the theatre's outer radius is R
function theatre(u, v, R) {
  const r = Math.hypot(u, v);
  const rIn = R * 0.66;
  if (r > R) return null;
  if (r >= rIn) {
    let a = Math.atan2(v, u) + Math.PI / 2; // 0 at top, clockwise
    if (a < 0) a += 2 * Math.PI;
    const seg = a / (2 * Math.PI / BAYS), i = Math.floor(seg), f = seg - i;
    const gap = 0.07 * (R / r);
    if (f < gap / 2 || f > 1 - gap / 2 || r < rIn + R * 0.02 || r > R - R * 0.01) return OX;
    return i < DONE ? LIME : i === DONE ? GOLD : OX_LIGHT;
  }
  if (r > rIn - R * 0.04) return OX;
  // the yard, with the stage thrust in from the top
  const top = -rIn * 0.92, front = -rIn * 0.22, halfTop = rIn * 0.46, halfFront = rIn * 0.36;
  if (v > top && v < front) {
    const t = (v - top) / (front - top), half = halfTop + (halfFront - halfTop) * t;
    if (Math.abs(u) < half) return STAGE;
  }
  if (v >= front && v < front + rIn * 0.07 && Math.abs(u) < halfFront) return STAGE_DARK;
  return YARD;
}

function render(w, h, shade) {
  const px = Buffer.alloc(w * h * 3), S = 4;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let rr = 0, gg = 0, bb = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const c = shade(x + (sx + 0.5) / S, y + (sy + 0.5) / S);
      rr += c[0]; gg += c[1]; bb += c[2];
    }
    const o = (y * w + x) * 3, n = S * S;
    px[o] = rr / n; px[o + 1] = gg / n; px[o + 2] = bb / n;
  }
  return px;
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = b => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, px) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; px.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const out = path.join(__dirname, "..", "icons");
fs.mkdirSync(out, { recursive: true });
// square icon: scale = share of the half-width the theatre fills
function icon(size, scale, file) {
  const R = size / 2 * scale;
  const px = render(size, size, (x, y) => theatre(x - size / 2, y - size / 2, R) || OX);
  fs.writeFileSync(path.join(out, file), png(size, size, px));
  console.log("wrote", file);
}
icon(512, 0.86, "icon-512.png");
icon(192, 0.86, "icon-192.png");
icon(512, 0.70, "icon-maskable-512.png"); // stays inside the safe zone when a phone crops it to a circle
icon(180, 0.80, "apple-touch-icon.png");
icon(32, 0.96, "favicon-32.png");

// link-preview image, 1200 x 630: the theatre centred on a flat oxblood field, with a thatch-gold band along the foot
{
  const W = 1200, H = 630, R = 270, cx = 600, cy = 300;
  const px = render(W, H, (x, y) => {
    if (y > H - 22) return GOLD;
    return theatre(x - cx, y - cy, R) || OX;
  });
  fs.writeFileSync(path.join(out, "og-image.png"), png(W, H, px));
  console.log("wrote og-image.png");
}
