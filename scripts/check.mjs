import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {Script} from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
execFileSync(process.execPath,['--check',root+'public/account.js']);
const html=readFileSync(root+'public/index.html','utf8');
let count=0;
for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
 if(!/\bsrc\s*=/.test(match[1])&&!/type=["'](?:application\/ld\+json|importmap)/.test(match[1])){new Script(match[2]);count++;}
}
for(const path of ['account.js','refined.css','demo-cat.webp','demo-park.webp','demo-walk.webp'])if(!existsSync(root+'public/'+path))throw Error('Missing asset: '+path);
JSON.parse(readFileSync(root+'vercel.json','utf8'));
console.log(`PASS: account.js, ${count} inline scripts, assets and Vercel config. Does not test Supabase or payments.`);
