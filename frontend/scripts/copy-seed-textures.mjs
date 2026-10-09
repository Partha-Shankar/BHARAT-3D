// Copy the satellite textures of the bundled demo areas (../data/seed/<key>/) into dist/tex/<key>/ so Cloudflare
// Pages serves them from its CDN. Run after `vite build` (npm run build:pages).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const seed = path.resolve(here, '..', '..', 'data', 'seed');
const out = path.resolve(here, '..', 'dist', 'tex');
let n = 0;
if (fs.existsSync(seed)) {
  for (const key of fs.readdirSync(seed)) {
    if (!/^[a-f0-9]{16}$/.test(key)) continue;
    for (const name of ['texture.jpg', 'context.jpg']) {
      const src = path.join(seed, key, name);
      if (!fs.existsSync(src)) continue;
      fs.mkdirSync(path.join(out, key), { recursive: true });
      fs.copyFileSync(src, path.join(out, key, name));
      n += 1;
    }
  }
}
console.log(`copied ${n} demo-area textures to dist/tex`);
