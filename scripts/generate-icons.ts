/**
 * Generates solid-color placeholder PNG icons using only Node built-ins.
 * Produces icon16.png, icon48.png, icon128.png in src/icons/.
 */
import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, '../src/icons');

// Inti brand blue
const R = 0x3b, G = 0x82, B = 0xf6;

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 1) ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.allocUnsafe(4);
  len.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBytes, data, crcBuf]);
}

function makePNG(size: number, r: number, g: number, b: number): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: width, height, 8-bit depth, RGB color type
  const ihdrData = Buffer.allocUnsafe(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type: RGB
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  // Raw image data: each row = filter byte (0) + size * 3 RGB bytes
  const rowSize = 1 + size * 3;
  const raw = Buffer.allocUnsafe(size * rowSize);
  for (let y = 0; y < size; y++) {
    const offset = y * rowSize;
    raw[offset] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      raw[offset + 1 + x * 3] = r;
      raw[offset + 2 + x * 3] = g;
      raw[offset + 3 + x * 3] = b;
    }
  }

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdrData),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(iconsDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const png = makePNG(size, R, G, B);
  const path = resolve(iconsDir, `icon${size}.png`);
  writeFileSync(path, png);
  console.log(`✓ ${path} (${size}×${size})`);
}
