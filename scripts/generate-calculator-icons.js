const fs = require("node:fs");
const zlib = require("node:zlib");

const SIZE = 512;
const SCALE = 1200 / SIZE;
const pixels = Buffer.alloc(SIZE * SIZE * 4);

function inRoundRect(px, py, x, y, width, height, radius) {
  const cx = Math.max(x + radius, Math.min(px, x + width - radius));
  const cy = Math.max(y + radius, Math.min(py, y + height - radius));
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function inCircle(px, py, cx, cy, radius) {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function colorAt(x, y) {
  const px = (x + 0.5) * SCALE;
  const py = (y + 0.5) * SCALE;
  let color = [255, 255, 255, 255];

  if (inRoundRect(px, py, 150, 150, 900, 900, 155)) {
    color = [209, 219, 224, 255];
  }
  if (inRoundRect(px, py, 350, 250, 500, 700, 52)) {
    color = [32, 33, 41, 255];
  }
  if (inRoundRect(px, py, 425, 300, 350, 150, 26)) {
    color = [119, 119, 119, 255];
  }

  const light = [
    [450, 550], [600, 550], [450, 700], [600, 700]
  ];
  if (light.some(([cx, cy]) => inCircle(px, py, cx, cy, 50)) ||
      inRoundRect(px, py, 400, 800, 250, 100, 50)) {
    color = [222, 222, 222, 255];
  }

  const orange = [[750, 550], [750, 700], [750, 850]];
  if (orange.some(([cx, cy]) => inCircle(px, py, cx, cy, 50))) {
    color = [255, 173, 53, 255];
  }
  return color;
}

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const offset = (y * SIZE + x) * 4;
    pixels.set(colorAt(x, y), offset);
  }
}

const rowBytes = SIZE * 4 + 1;
const raw = Buffer.alloc(rowBytes * SIZE);
for (let y = 0; y < SIZE; y++) {
  const sourceStart = y * SIZE * 4;
  const targetStart = y * rowBytes;
  raw[targetStart] = 0;
  pixels.copy(raw, targetStart + 1, sourceStart, sourceStart + SIZE * 4);
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([name, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([length, name, data, crc]);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(SIZE, 0);
header.writeUInt32BE(SIZE, 4);
header[8] = 8;
header[9] = 6;
header[10] = 0;
header[11] = 0;
header[12] = 0;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", header),
  chunk("IDAT", zlib.deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0))
]);

fs.writeFileSync("apple-touch-icon.png", png);
fs.writeFileSync("calculadora-icon-512.png", png);

const icon192 = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < 192; y++) {
  for (let x = 0; x < 192; x++) {
    const sx = Math.floor(x * SIZE / 192);
    const sy = Math.floor(y * SIZE / 192);
    const src = (sy * SIZE + sx) * 4;
    const dst = (y * 192 + x) * 4;
    pixels.copy(icon192, dst, src, src + 4);
  }
}

function encodePng(size, rgba) {
  const stride = size * 4 + 1;
  const scanlines = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    const row = y * stride;
    scanlines[row] = 0;
    rgba.copy(scanlines, row + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(scanlines)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

fs.writeFileSync("calculadora-icon-192.png", encodePng(192, icon192));
