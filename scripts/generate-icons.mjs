#!/usr/bin/env node
/**
 * Icon generator — edit the ICONS config below, then run:
 *   node scripts/generate-icons.mjs
 *
 * Requires macOS (uses `sips` for SVG→PNG conversion).
 */

import { writeFileSync, rmSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, '..', 'icons');

// ─── Edit these values to tweak the icon design ───────────────────────────────

const ICONS = [
  {
    size: 128,
    rx: 16,           // corner radius of background rect
    whiteRing: 46,    // radius of outer white circle
    blueRing: 34,     // radius of middle blue circle
    whiteDot: 11,     // radius of central white dot
  },
  {
    size: 48,
    rx: 6,
    whiteRing: 17,
    blueRing: 13,
    whiteDot: 5,
  },
  {
    size: 16,
    rx: 2,
    whiteRing: 5.5,
    blueRing: 4,
    whiteDot: 1.75,
  },
];

const BLUE = '#3B82F6';

// ─── Generation ───────────────────────────────────────────────────────────────

for (const { size, rx, whiteRing, blueRing, whiteDot } of ICONS) {
  const cx = size / 2;
  const svgPath = resolve(iconsDir, `icon-${size}.svg`);
  const pngPath = resolve(iconsDir, `icon-${size}.png`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BLUE}" rx="${rx}"/>
  <circle cx="${cx}" cy="${cx}" r="${whiteRing}" fill="white"/>
  <circle cx="${cx}" cy="${cx}" r="${blueRing}" fill="${BLUE}"/>
  <circle cx="${cx}" cy="${cx}" r="${whiteDot}" fill="white"/>
</svg>
`;

  writeFileSync(svgPath, svg);
  execSync(`sips -s format png "${svgPath}" --out "${pngPath}"`, { stdio: 'pipe' });
  rmSync(svgPath);
  console.log(`✓ icon-${size}.png`);
}

console.log('\nDone! Run `npm run build` to apply to dist/.');
