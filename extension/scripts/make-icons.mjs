import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "icons");

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function png(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    const start = y * (size * 4 + 1);
    raw[start] = 0;
    for (let x = 0; x < size * 4; x += 1) raw[start + 1 + x] = rgba[y * size * 4 + x];
  }
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function inside(x, y, size, radius) {
  if (x < radius && y < radius) return (x - radius) ** 2 + (y - radius) ** 2 <= radius ** 2;
  if (x >= size - radius && y < radius) {
    return (x - (size - radius - 1)) ** 2 + (y - radius) ** 2 <= radius ** 2;
  }
  if (x < radius && y >= size - radius) {
    return (x - radius) ** 2 + (y - (size - radius - 1)) ** 2 <= radius ** 2;
  }
  if (x >= size - radius && y >= size - radius) {
    return (x - (size - radius - 1)) ** 2 + (y - (size - radius - 1)) ** 2 <= radius ** 2;
  }
  return x >= 0 && y >= 0 && x < size && y < size;
}

function draw(size) {
  const rgba = new Uint8Array(size * size * 4);
  const radius = Math.round(size * 0.22);
  const set = (x, y, red, green, blue, alpha) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const index = (y * size + x) * 4;
    rgba[index] = red;
    rgba[index + 1] = green;
    rgba[index + 2] = blue;
    rgba[index + 3] = alpha;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (inside(x, y, size, radius)) set(x, y, 62, 207, 178, 255);
    }
  }
  const margin = Math.round(size * 0.28);
  const thick = Math.max(2, Math.round(size * 0.11));
  const bottom = size - margin;
  const right = size - margin;
  const mid = Math.round(size / 2 - thick / 2);
  const paint = (x0, y0, x1, y1) => {
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) set(x, y, 6, 36, 29, 255);
    }
  };
  paint(margin, margin, margin + thick, bottom);
  paint(margin, margin, right, margin + thick);
  paint(margin, mid, margin + Math.round((right - margin) * 0.72), mid + thick);
  paint(margin, bottom - thick, right, bottom);
  return rgba;
}

mkdirSync(root, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  writeFileSync(path.join(root, `icon${size}.png`), png(size, draw(size)));
}
