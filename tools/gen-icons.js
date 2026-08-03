// Genera los iconos PWA oficiales de Miikaeru ("M" estilizado, paleta
// neón cian->verde sobre el fondo base #0B0F19 ya usado en toda la app —
// ver --bg-base/--neon-cyan/--neon-green en style.css). Rasteriza el
// glifo y el degradado a mano, píxel por píxel (sin Canvas/Playwright:
// el Chromium instalado en tools/ai-player/ está bloqueado por una
// directiva de Control de aplicaciones de Windows en esta máquina) y
// codifica PNG real con el zlib nativo de Node — sin procesos externos.
// Uso: node tools/gen-icons.js
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT_DIR = path.join(__dirname, "..", "miikaeru-web", "assets", "icons");
fs.mkdirSync(OUT_DIR, { recursive: true });

const BG_BASE = [0x0b, 0x0f, 0x19];
const BG_GLOW = [0x13, 0x20, 0x38];
const CYAN = [0x00, 0xf0, 0xff];
const GREEN = [0x00, 0xff, 0x9c];

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function lerpColor(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}
function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}
function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// Distancia mínima de un punto a un segmento (todo en coordenadas
// normalizadas 0..1) — usado para dibujar el trazo grueso de la "M".
function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby;
  let t = abLenSq === 0 ? 0 : (apx * abx + apy * aby) / abLenSq;
  t = clamp01(t);
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}

// Vértices del glifo "M" (5 puntos, 4 segmentos), en coordenadas 0..1.
// scale <1 encoge el glifo hacia el centro — usado en la variante
// "maskable" para que quepa dentro del círculo de zona segura (radio
// 0.4) sin que ningún launcher de Android lo recorte.
function mGlyphSegments(scale) {
  const pts = [
    [0.2, 0.78],
    [0.2, 0.22],
    [0.5, 0.55],
    [0.8, 0.22],
    [0.8, 0.78],
  ].map(([x, y]) => [0.5 + (x - 0.5) * scale, 0.5 + (y - 0.5) * scale]);
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1]]);
  return segs;
}

function renderPixels(size, { maskable, ring }) {
  const scale = maskable ? 0.75 : 1;
  const segs = mGlyphSegments(scale);
  const strokeHalf = (0.11 * scale) / 2;
  const aa = 1.3 / size; // ancho del suavizado de borde, en unidades normalizadas
  const glowHalf = strokeHalf + 5 / size;
  const ringRadius = 0.465;
  const ringHalf = 4 / size;

  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size;
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;

      // Fondo: resplandor radial suave centrado un poco arriba del medio.
      const dCenter = Math.hypot(u - 0.5, v - 0.46);
      const glowT = clamp01(1 - dCenter / 0.7);
      let color = lerpColor(BG_BASE, BG_GLOW, glowT * 0.7);

      // Anillo decorativo circular (solo variante "any", no a sangrado
      // completo — en la maskable se omite para no arriesgar recorte).
      if (ring) {
        const dRing = Math.abs(dCenter - ringRadius);
        const ringAlpha = 1 - smoothstep(ringHalf * 0.4, ringHalf, dRing);
        if (ringAlpha > 0) {
          color = lerpColor(color, CYAN, ringAlpha * 0.35);
        }
      }

      // Distancia mínima al trazo de la M.
      let dGlyph = Infinity;
      for (const [[ax, ay], [bx, by]] of segs) {
        const d = distToSegment(u, v, ax, ay, bx, by);
        if (d < dGlyph) dGlyph = d;
      }

      // Halo de resplandor neón detrás del glifo (blur aproximado por
      // una caída suave más ancha que el trazo real).
      const glowAlpha = 1 - smoothstep(glowHalf, glowHalf + 0.05, dGlyph);
      if (glowAlpha > 0) {
        color = lerpColor(color, CYAN, glowAlpha * 0.55);
      }

      // Trazo nítido de la M, con degradado diagonal cian->verde.
      const glyphAlpha = 1 - smoothstep(strokeHalf - aa, strokeHalf + aa, dGlyph);
      if (glyphAlpha > 0) {
        const gradT = clamp01((u + v) / 2);
        const glyphColor = lerpColor(CYAN, GREEN, gradT);
        color = lerpColor(color, glyphColor, glyphAlpha);
      }

      const i = (y * size + x) * 4;
      buf[i] = Math.round(color[0]);
      buf[i + 1] = Math.round(color[1]);
      buf[i + 2] = Math.round(color[2]);
      buf[i + 3] = 255; // opaco a sangrado completo (requisito de maskable/apple-touch-icon)
    }
  }
  return buf;
}

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(size, rgbaBuf) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Cada scanline necesita su byte de filtro (0 = sin filtro) al principio.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgbaBuf.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idatData = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idatData), chunk("IEND", Buffer.alloc(0))]);
}

function writeIcon(file, size, opts) {
  const px = renderPixels(size, opts);
  const png = encodePNG(size, px);
  fs.writeFileSync(path.join(OUT_DIR, file), png);
  console.log(`wrote ${file} (${size}x${size}, ${png.length} bytes)`);
}

writeIcon("icon-512.png", 512, { maskable: false, ring: true });
writeIcon("icon-192.png", 192, { maskable: false, ring: true });
writeIcon("icon-maskable-512.png", 512, { maskable: true, ring: false });
writeIcon("icon-maskable-192.png", 192, { maskable: true, ring: false });
writeIcon("apple-touch-icon.png", 180, { maskable: true, ring: false });
writeIcon("favicon-48.png", 48, { maskable: true, ring: false });
writeIcon("favicon-32.png", 32, { maskable: true, ring: false });
