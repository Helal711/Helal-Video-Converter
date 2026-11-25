import { promises as fs } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// Generates a crisp 256x256 PNG and valid Windows ICO container (build/icon.png & build/icon.ico)
// using pure Node.js without external native graphics dependencies.
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createAppIconPng(size = 256) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.44;
  const corner = size * 0.18;

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter type 0

    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 4;
      // Rounded square SDF
      const dx = Math.max(Math.abs(x - cx) - (radius - corner), 0);
      const dy = Math.max(Math.abs(y - cy) - (radius - corner), 0);
      const dist = Math.hypot(dx, dy) - corner;

      if (dist > 0) {
        raw[idx] = 0;
        raw[idx + 1] = 0;
        raw[idx + 2] = 0;
        raw[idx + 3] = 0;
        continue;
      }

      // Deep slate-blue gradient background
      const t = (x + y) / (size * 2);
      let r = Math.round(15 + t * 22);
      let g = Math.round(23 + t * 52);
      let b = Math.round(42 + t * 145);

      // Subtle inner border ring
      if (dist > -4) {
        r = 59;
        g = 130;
        b = 246;
      }

      // Crisp geometric play-frame emblem in center
      const px = (x - cx) / size;
      const py = (y - cy) / size;
      const inTriangle =
        px >= -0.13 &&
        px <= 0.18 &&
        Math.abs(py) <= (0.18 - px) * 0.72;

      if (inTriangle) {
        r = 248;
        g = 250;
        b = 252;
      }

      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw, { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function wrapPngInIco(pngBuffer, size = 256) {
  // ICONDIR (6 bytes) + ICONDIRENTRY (16 bytes) + PNG payload
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = 1 (ICO)
  header.writeUInt16LE(1, 4); // image count = 1

  header[6] = size === 256 ? 0 : size; // width (0 = 256)
  header[7] = size === 256 ? 0 : size; // height (0 = 256)
  header[8] = 0; // palette count
  header[9] = 0; // reserved
  header.writeUInt16LE(1, 10); // color planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(pngBuffer.length, 14);
  header.writeUInt32LE(22, 18); // offset

  return Buffer.concat([header, pngBuffer]);
}

async function main() {
  const buildDir = path.resolve(process.cwd(), 'build');
  await fs.mkdir(buildDir, { recursive: true });

  const png = createAppIconPng(256);
  const ico = wrapPngInIco(png, 256);

  await fs.writeFile(path.join(buildDir, 'icon.png'), png);
  await fs.writeFile(path.join(buildDir, 'icon.ico'), ico);

  console.log('[generate-win-icon] Created build/icon.png and build/icon.ico');
}

main().catch((err) => {
  console.error('[generate-win-icon] Failed:', err);
  process.exit(1);
});
