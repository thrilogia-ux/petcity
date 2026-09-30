import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const file of ['public/account.js', 'public/js/core.js', 'public/js/shell.js', 'public/js/app.js']) {
  execFileSync(process.execPath, ['--check', root + file]);
}
const html = readFileSync(root + 'public/index.html', 'utf8');
let count = 0;
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (!/\bsrc\s*=/.test(match[1]) && !/type=["'](?:application\/ld\+json|importmap)/.test(match[1])) {
    new Script(match[2]);
    count++;
  }
}
for (const path of ['account.js', 'js/core.js', 'js/shell.js', 'js/app.js', 'refined.css', 'demo.html', 'demo-cat.webp', 'demo-park.webp', 'demo-walk.webp']) {
  if (!existsSync(root + 'public/' + path)) throw Error('Missing asset: ' + path);
}
JSON.parse(readFileSync(root + 'vercel.json', 'utf8'));
if (!existsSync(root + 'supabase/006_sitter_public_profile.sql')) throw Error('Missing migration 006');
console.log(`PASS: JS modules, ${count} inline scripts, assets and Vercel config.`);
