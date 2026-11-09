import { cpSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

// Copy manifest.json
cpSync(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'));
console.log('Copied manifest.json');

// Copy icons
mkdirSync(resolve(dist, 'icons'), { recursive: true });
for (const size of [16, 48, 128]) {
  cpSync(resolve(root, `icons/icon-${size}.png`), resolve(dist, `icons/icon-${size}.png`));
  console.log(`Copied icons/icon-${size}.png`);
}

console.log('Assets copied to dist/');
