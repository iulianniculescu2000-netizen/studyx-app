#!/usr/bin/env node
/**
 * scripts/generate-premium-assets.cjs
 * Generează identitatea vizuală StudyX v2 (Premium Squircle)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// --- Utilitare pentru desenare premium ---
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function sdfSquircle(x, y, size, radius) {
    const half = size / 2;
    const qx = Math.abs(x) - half + radius;
    const qy = Math.abs(y) - half + radius;
    return Math.min(Math.max(qx, qy), 0.0) + Math.sqrt(Math.pow(Math.max(qx, 0), 2) + Math.pow(Math.max(qy, 0), 2)) - radius;
}

function sdfLine(px, py, ax, ay, bx, by, thickness) {
    const pax = px - ax, pay = py - ay;
    const bax = bx - ax, bay = by - ay;
    const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1);
    const dx = pax - bax * h, dy = pay - bay * h;
    return Math.sqrt(dx * dx + dy * dy) - thickness;
}

// --- Generare Sidebar BMP (Wizard-ul de instalare) ---
function writeBMP(width, height, pixelFunc, outPath) {
    const rowSize = Math.floor((width * 3 + 3) / 4) * 4;
    const dataSize = rowSize * height;
    const buf = Buffer.alloc(54 + dataSize);
    buf.write('BM', 0);
    buf.writeUInt32LE(54 + dataSize, 2);
    buf.writeUInt32LE(54, 10);
    buf.writeUInt32LE(40, 14);
    buf.writeInt32LE(width, 18);
    buf.writeInt32LE(-height, 22);
    buf.writeUInt16LE(1, 26);
    buf.writeUInt16LE(24, 28);
    buf.writeUInt32LE(dataSize, 34);

    let offset = 54;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const [r, g, b] = pixelFunc(x, y, width, height);
            buf[offset++] = b; buf[offset++] = g; buf[offset++] = r;
        }
        while ((offset - 54) % rowSize !== 0) buf[offset++] = 0;
    }
    fs.writeFileSync(outPath, buf);
}

// --- Generare Sidebar ---
writeBMP(164, 314, (x, y, w, h) => {
    const nx = x / w, ny = y / h;
    let r = Math.round(15 + 10 * (1 - ny));
    let g = Math.round(12 + 8 * (1 - ny));
    let b = Math.round(30 + 15 * (1 - ny));
    
    // Abstract patterns
    if ((x + y) % 40 < 2) { r += 5; g += 5; b += 10; }
    
    // Glowing accent at bottom
    const dist = Math.sqrt(Math.pow(x - w/2, 2) + Math.pow(y - h, 2));
    const glow = Math.max(0, (120 - dist) / 120);
    r = Math.min(255, r + glow * 50);
    g = Math.min(255, g + glow * 30);
    b = Math.min(255, b + glow * 120);
    
    return [r, g, b];
}, path.join(__dirname, '..', 'build', 'sidebar.bmp'));

// --- Generare Header ---
writeBMP(150, 57, (x, y, w, h) => {
    const nx = x / w;
    let r = Math.round(20 + nx * 15);
    let g = Math.round(18 + nx * 10);
    let b = Math.round(40 + nx * 20);
    return [r, g, b];
}, path.join(__dirname, '..', 'build', 'header.bmp'));

// --- Generare Iconita Premium PNG (512x512) ---
const SIZE = 512;
const scanlines = Buffer.alloc(SIZE * (SIZE * 4 + 1), 0);
let off = 0;

for (let y = 0; y < SIZE; y++) {
    scanlines[off++] = 0;
    for (let x = 0; x < SIZE; x++) {
        const cx = x - SIZE / 2, cy = y - SIZE / 2;
        
        // Squircle Base
        const dSquircle = sdfSquircle(cx, cy, 460, 120);
        if (dSquircle > 0) { off += 4; continue; }

        // Gradient Background (Deep Obsidian)
        const t = (cx / SIZE + cy / SIZE + 1) / 2;
        let r = Math.round(22 * (1 - t) + 12 * t);
        let g = Math.round(18 * (1 - t) + 10 * t);
        let b = Math.round(45 * (1 - t) + 25 * t);

        // Inner Shadow
        if (dSquircle > -15) {
            const shadow = (dSquircle + 15) / 15;
            r *= (1 - shadow * 0.4); g *= (1 - shadow * 0.4); b *= (1 - shadow * 0.4);
        }

        // The "Premium X" Symbol
        const dX1 = sdfLine(cx, cy, -100, -100, 100, 100, 22);
        const dX2 = sdfLine(cx, cy, -100, 100, 100, -100, 22);
        const dX = Math.min(dX1, dX2);

        if (dX < 0) {
            // Symbol color: Pure white with a hint of tech-blue
            r = 245; g = 248; b = 255;
            // Add a very subtle gradient on the symbol itself
            const symT = (cy + 100) / 200;
            r -= symT * 10; g -= symT * 5;
        } else if (dX < 50) {
            // Neon Bloom / Glow
            const bloom = Math.pow(1 - dX / 50, 2);
            r = Math.min(255, r + bloom * 120);
            g = Math.min(255, g + bloom * 80);
            b = Math.min(255, b + bloom * 255);
        }

        // Glass Reflection (Top)
        if (cy < -120 && dSquircle < -5) {
            const reflection = Math.max(0, 1 - Math.abs(cy + 180) / 80) * 35;
            r = Math.min(255, r + reflection);
            g = Math.min(255, g + reflection);
            b = Math.min(255, b + reflection);
        }

        scanlines[off++] = r; scanlines[off++] = g; scanlines[off++] = b; scanlines[off++] = 255;
    }
}

// Assemble PNG
function crc32(buf) {
    let crc = 0xFFFFFFFF;
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        table[i] = c;
    }
    for (const b of buf) crc = table[(crc ^ b) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}
function pngChunk(type, data) {
    const t = Buffer.from(type, 'ascii'), d = data || Buffer.alloc(0);
    const ln = Buffer.alloc(4); ln.writeUInt32BE(d.length);
    const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(Buffer.concat([t, d])));
    return Buffer.concat([ln, t, d, cr]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = 6;
const idat = zlib.deflateSync(scanlines, { level: 9 });
const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND')
]);

fs.writeFileSync(path.join(__dirname, '..', 'public', 'icon.png'), png);
console.log("🚀 Pictograma Premium v2 (Squircle Neon) generată cu succes!");
