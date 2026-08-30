/**
 * Generates PNG app icons (192, 512) without external dependencies.
 * Draws the balloon motif from public/icons/icon.svg with raw pixel math
 * and encodes PNG using node's zlib.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256).map((_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c;
    });
  }
  let crc = -1;
  for (const b of buf) crc = (crc >>> 8) ^ table[(crc ^ b) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const bg = hexToRgb('#1a1f36');
  const balloon = hexToRgb('#ff8fa3');
  const highlight = hexToRgb('#ffffff');
  const spark = hexToRgb('#ffd280');
  const s = size / 512; // scale from the 512 design grid

  const put = (x, y, [r, g, b], a = 1) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const inv = 1 - a;
    rgba[i] = Math.round(r * a + rgba[i] * inv);
    rgba[i + 1] = Math.round(g * a + rgba[i + 1] * inv);
    rgba[i + 2] = Math.round(b * a + rgba[i + 2] * inv);
    rgba[i + 3] = 255;
  };

  // Background with rounded corners (radius 96 on the 512 grid).
  const radius = 96 * s;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = Math.min(x, size - 1 - x);
      const cy = Math.min(y, size - 1 - y);
      let alpha = 1;
      if (cx < radius && cy < radius) {
        const d = Math.hypot(radius - cx, radius - cy);
        alpha = d <= radius ? 1 : Math.max(0, 1 - (d - radius));
      }
      if (alpha > 0) put(x, y, bg, alpha);
    }
  }

  const inEllipse = (x, y, ex, ey, rx, ry) => {
    const dx = (x - ex) / rx;
    const dy = (y - ey) / ry;
    return dx * dx + dy * dy;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Balloon body
      let d = inEllipse(x, y, 256 * s, 220 * s, 130 * s, 150 * s);
      if (d <= 1) {
        put(x, y, balloon, Math.min(1, (1 - d) * 30 + 0.6));
        // Highlight
        const h = inEllipse(x, y, 210 * s, 160 * s, 34 * s, 48 * s);
        if (h <= 1) put(x, y, highlight, 0.35);
      }
      // Knot triangle (approximate with small ellipse)
      const k = inEllipse(x, y, 256 * s, 384 * s, 22 * s, 20 * s);
      if (k <= 1) put(x, y, balloon, 1);
      // Sparks (three short strokes as small circles along lines)
      const sparks = [
        [404, 120, 436, 88],
        [418, 176, 462, 170],
        [392, 76, 404, 34],
      ];
      for (const [x1, y1, x2, y2] of sparks) {
        for (let t = 0; t <= 1; t += 0.1) {
          const px = (x1 + (x2 - x1) * t) * s;
          const py = (y1 + (y2 - y1) * t) * s;
          if (Math.hypot(x - px, y - py) <= 7 * s) put(x, y, spark, 1);
        }
      }
    }
  }
  return encodePng(size, size, rgba);
}

mkdirSync(join(root, 'public/icons'), { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(join(root, `public/icons/icon-${size}.png`), renderIcon(size));
  console.log(`wrote public/icons/icon-${size}.png`);
}
