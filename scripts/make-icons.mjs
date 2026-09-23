/**
 * Draws Recall's app icons from the same shape as <Logo /> (src/components/Logo.tsx):
 * an ink square with a tilted card outline. No image tools needed — each pixel's
 * colour comes from a signed distance function, and the PNG is encoded by hand.
 *
 *   node scripts/make-icons.mjs
 */
import { writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';

const INK = [0x1c, 0x1b, 0x19];
const GROUND = [0xf5, 0xf3, 0xee];
const WHITE = [0xff, 0xff, 0xff];

// The logo mark is 32 px with a 14×18 card, 3 px corners, 2 px border, tilted −8°.
// Everything below is in "logo units" and scaled to the image size.
const CARD = { w: 14, h: 18, r: 3, stroke: 2, angle: (-8 * Math.PI) / 180 };

/** Distance from (x, y) to a rounded rectangle centred on the origin (negative = inside). */
function roundedRect(x, y, w, h, r) {
  const qx = Math.abs(x) - w / 2 + r;
  const qy = Math.abs(y) - h / 2 + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** Distance to the card outline, `scale` px per logo unit, centred at (cx, cy). */
function cardOutline(x, y, cx, cy, scale) {
  const dx = x - cx;
  const dy = y - cy;
  const cos = Math.cos(-CARD.angle);
  const sin = Math.sin(-CARD.angle);
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;
  const { w, h, r, stroke } = CARD;
  // The border sits inside the card's box, as with React Native's borderWidth.
  const outer = roundedRect(rx, ry, w * scale, h * scale, r * scale);
  const inner = roundedRect(rx, ry, (w - 2 * stroke) * scale, (h - 2 * stroke) * scale, Math.max(0, r - stroke) * scale);
  return Math.max(outer, -inner);
}

/** Anti-aliasing: a pixel half inside an edge is half covered. */
const cover = (d) => Math.min(1, Math.max(0, 0.5 - d));

/**
 * Renders `size`×`size` RGBA pixels. `layers` are painted in order; each is
 * { color, dist(x, y) } where dist ≤ 0 means inside.
 */
function render(size, layers) {
  const px = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let [r, g, b, a] = [0, 0, 0, 0];
      for (const layer of layers) {
        const c = cover(layer.dist(x + 0.5, y + 0.5));
        if (!c) continue;
        // "Source over" blending with premultiplied maths, kept simple.
        const na = c + a * (1 - c);
        r = (layer.color[0] * c + r * a * (1 - c)) / na;
        g = (layer.color[1] * c + g * a * (1 - c)) / na;
        b = (layer.color[2] * c + b * a * (1 - c)) / na;
        a = na;
      }
      const i = (y * size + x) * 4;
      px.set([Math.round(r), Math.round(g), Math.round(b), Math.round(a * 255)], i);
    }
  }
  return px;
}

/** Minimal PNG encoder: 8-bit RGBA (or RGB when `opaque`, which iOS wants for the app icon). */
function png(size, px, { opaque = false } = {}) {
  const channels = opaque ? 3 : 4;
  const raw = Buffer.alloc((size * channels + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * channels + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      raw.set(px.subarray(i, i + channels), row + 1 + x * channels);
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = opaque ? 2 : 6; // colour type: RGB / RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const everywhere = () => -1;

/** Card outline filling `cardHeight` of the image, on an optional background. */
function icon(file, size, { cardHeight, cardColor, background, backgroundRadius, opaque }) {
  const scale = (cardHeight * size) / CARD.h;
  const c = size / 2;
  const layers = [];
  if (background) {
    layers.push({
      color: background,
      dist: backgroundRadius == null ? everywhere : (x, y) => roundedRect(x - c, y - c, size, size, backgroundRadius * size),
    });
  }
  layers.push({ color: cardColor, dist: (x, y) => cardOutline(x, y, c, c, scale) });
  writeFileSync(new URL(`../assets/${file}`, import.meta.url), png(size, render(size, layers), { opaque }));
  console.log(`assets/${file}`);
}

// iOS app icon: square and opaque — iOS rounds the corners itself. Same proportions as <Logo />.
icon('icon.png', 1024, { cardHeight: 18 / 32, cardColor: GROUND, background: INK, opaque: true });

// Android adaptive icon: launchers crop the layers to a circle or squircle, so the
// card stays inside the middle 66% (the "safe zone"). The background is a colour in app.json.
icon('android-icon-foreground.png', 1024, { cardHeight: 0.4, cardColor: GROUND });
icon('android-icon-background.png', 1024, { cardHeight: 0, cardColor: INK, background: INK, opaque: true });
// Themed icons (Android 13+) tint this silhouette to match the wallpaper.
icon('android-icon-monochrome.png', 1024, { cardHeight: 0.4, cardColor: WHITE });

// Splash: the logo mark as a rounded square on the ground colour (set in app.json).
icon('splash-icon.png', 1024, { cardHeight: 18 / 32, cardColor: GROUND, background: INK, backgroundRadius: 9 / 32 });
icon('favicon.png', 48, { cardHeight: 18 / 32, cardColor: GROUND, background: INK, backgroundRadius: 9 / 32 });

// Android notification icon: white on transparent, 96 px. Android paints it in the plugin's `color`.
icon('notification-icon.png', 96, { cardHeight: 0.62, cardColor: WHITE });
