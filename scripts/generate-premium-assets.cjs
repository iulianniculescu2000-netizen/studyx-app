#!/usr/bin/env node
/**
 * scripts/generate-premium-assets.cjs
 * Generează iconița aplicației (PNG) și imaginile Wizard-ului (BMP)
 * cu un design premium, dark-mode, cu accente neon.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// --- Helper pentru scrierea fisierelor BMP (24-bit) ---
function writeBMP(width, height, pixelFunc, outPath) {
  const rowSize = Math.floor((width * 3 + 3) / 4) * 4;
  const dataSize = rowSize * height;
  const fileSize = 54 + dataSize;
  const buf = Buffer.alloc(fileSize);
  
  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(0, 6);
  buf.writeUInt32LE(54, 10);
  
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(-height, 22); // top-down
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(0, 30);
  buf.writeUInt32LE(dataSize, 34);
  buf.writeInt32LE(2835, 38);
  buf.writeInt32LE(2835, 42);
  buf.writeUInt32LE(0, 46);
  buf.writeUInt32LE(0, 50);

  let offset = 54;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelFunc(x, y, width, height);
      buf[offset++] = b;
      buf[offset++] = g;
      buf[offset++] = r;
    }
    while ((offset - 54) % rowSize !== 0) {
      buf[offset++] = 0;
    }
  }
  fs.writeFileSync(outPath, buf);
  console.log(`✅ Imagine BMP generată: ${outPath} (${width}x${height})`);
}

// --- Functii matematice pentru design (SDF) ---
function sdfLine(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay;
  const bax = bx - ax, bay = by - ay;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  const dx = pax - bax * h, dy = pay - bay * h;
  return Math.sqrt(dx * dx + dy * dy);
}

// --- Generare Sidebar BMP (164 x 314) pentru Wizard ---
writeBMP(164, 314, (x, y, w, h) => {
  const nx = x / w, ny = y / h;
  // Fundal Dark Gradient (Mov inchis spre Albastru inchis)
  let r = Math.round(30 * (1 - ny) + 15 * ny);
  let g = Math.round(27 * (1 - ny) + 23 * ny);
  let b = Math.round(75 * (1 - ny) + 42 * ny);
  
  // O rețea fină (grid) pentru un aspect "tech"
  if (x % 20 === 0 || y % 20 === 0) {
    r = Math.min(255, r + 15); g = Math.min(255, g + 15); b = Math.min(255, b + 25);
  }
  
  // Un "X" luminos în partea de sus
  const cx = x - w/2, cy = y - 80;
  const d1 = sdfLine(cx, cy, -30, -30, 30, 30);
  const d2 = sdfLine(cx, cy, -30, 30, 30, -30);
  const d = Math.min(d1, d2);
  
  if (d < 5) {
    r = 255; g = 255; b = 255; // Core X
  } else if (d < 20) {
    const glow = (20 - d) / 15;
    r = Math.min(255, r + glow * 100);
    g = Math.min(255, g + glow * 50);
    b = Math.min(255, b + glow * 200);
  }
  
  return [r, g, b];
}, path.join(__dirname, '..', 'build', 'sidebar.bmp'));

// --- Generare Header BMP (150 x 57) pentru Wizard ---
writeBMP(150, 57, (x, y, w, h) => {
  const nx = x / w, ny = y / h;
  let r = Math.round(20 + nx * 10);
  let g = Math.round(15 + nx * 10);
  let b = Math.round(35 + nx * 20);
  
  const cx = x - 120, cy = y - h/2;
  const d1 = sdfLine(cx, cy, -10, -10, 10, 10);
  const d2 = sdfLine(cx, cy, -10, 10, 10, -10);
  if (Math.min(d1, d2) < 3) {
    r = 167; g = 139; b = 250;
  }
  return [r, g, b];
}, path.join(__dirname, '..', 'build', 'header.bmp'));

// --- Generare Iconita Premium PNG (512 x 512) ---
const SIZE = 512;
const RADIUS = 110;
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[i] = c;
}
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const ln = Buffer.allocUnsafe(4); ln.writeUInt32BE(d.length);
  const cr = Buffer.allocUnsafe(4); cr.writeUInt32BE(crc32(Buffer.concat([t, d])));
  return Buffer.concat([ln, t, d, cr]);
}

const scanlines = Buffer.alloc(SIZE * (SIZE * 4 + 1), 0);
let off = 0;

for (let y = 0; y < SIZE; y++) {
  scanlines[off++] = 0;
  for (let x = 0; x < SIZE; x++) {
    const cx = x - SIZE / 2;
    const cy = y - SIZE / 2;
    
    const qx = Math.abs(cx) - (SIZE / 2 - RADIUS);
    const qy = Math.abs(cy) - (SIZE / 2 - RADIUS);
    const inRect = Math.abs(cx) < SIZE / 2 && Math.abs(cy) < SIZE / 2;
    const inCorner = qx > 0 && qy > 0;
    const inside = inRect && (!inCorner || qx * qx + qy * qy < RADIUS * RADIUS);

    if (!inside) { off += 4; continue; }

    // Fundal: Space Black -> Deep Violet
    const t = (x / SIZE * 0.5 + y / SIZE * 0.5);
    let r = Math.round(15 + 30 * t);
    let g = Math.round(10 + 20 * t);
    let b = Math.round(25 + 40 * t);

    // Border luminos (efect de sticlă / neon)
    const edgeDist = Math.max(0, SIZE/2 - Math.max(Math.abs(cx), Math.abs(cy)));
    if (edgeDist < 10) {
      r += 80; g += 80; b += 120;
    }

    // X luminos (StudyX)
    const d1 = sdfLine(cx, cy, -100, -100, 100, 100);
    const d2 = sdfLine(cx, cy, -100, 100, 100, -100);
    const dX = Math.min(d1, d2);
    
    if (dX < 15) {
      r = 255; g = 255; b = 255;
    } else if (dX < 60) {
      const glow = Math.pow((60 - dX) / 45, 1.5);
      r = Math.min(255, r + glow * 138); // #8A2BE2 neon glow
      g = Math.min(255, g + glow * 43);
      b = Math.min(255, b + glow * 226);
    }

    // Efect de reflexie 3D la partea de sus
    if (cy < 0) {
      const reflection = Math.pow(1 - Math.abs(cy)/(SIZE/2), 2) * 20;
      r = Math.min(255, r + reflection);
      g = Math.min(255, g + reflection);
      b = Math.min(255, b + reflection);
    }

    scanlines[off++] = r;
    scanlines[off++] = g;
    scanlines[off++] = b;
    scanlines[off++] = 255;
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = 6;
const idat = zlib.deflateSync(scanlines, { level: 9 });
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0)),
]);

const outPngPath = path.join(__dirname, '..', 'public', 'icon.png');
fs.writeFileSync(outPngPath, png);
console.log(`✅  Iconita Premium PNG generata: ${outPngPath}`);
