import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { originalWrangler } from './wrangler-guard.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
// Mantém o executável original do pacote. Substitui somente a entrada npm gerada.
originalWrangler(root);
const entry=resolve(root,'node_modules/.bin/wrangler');
mkdirSync(dirname(entry),{recursive:true});
if(existsSync(entry))unlinkSync(entry);
const moduleUrl=pathToFileURL(resolve(root,'tools/wrangler-guard.mjs')).href;
writeFileSync(entry,`#!/usr/bin/env node\nimport(${JSON.stringify(moduleUrl)}).then(m=>m.guardedWrangler(process.argv.slice(2))).catch(e=>{console.error(e.message);process.exitCode=1;});\n`,{mode:0o755});
console.log('Proteção DB instalada: npx wrangler deploy resolve o banco existente antes de publicar.');
