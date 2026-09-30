import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
let s = readFileSync(root + 'public/account.js', 'utf8');
s = s.replace(/^\/\*[\s\S]*?\*\/\n\(\(\) => \{\n/, '');
s = s.replace(/\n\}\)\(\);\s*$/, '');
const header = `import {
  paymentsEnabled, serviceLabels, stateLabels, getClient, esc, status,
  openModal as open, setServiceMessageTimer, signedPhoto, uploadPhoto,
} from './core.js';

export function bootPetCity() {
`;
writeFileSync(root + 'public/js/app.js', header + s + '\n}\n');
