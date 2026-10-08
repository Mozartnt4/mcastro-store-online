import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { configureD1 } from './configure-d1.mjs';

export function originalWrangler(root=resolve(dirname(fileURLToPath(import.meta.url)),'..')) {
  const packageDir=resolve(root,'node_modules/wrangler');
  const pkg=JSON.parse(readFileSync(resolve(packageDir,'package.json'),'utf8'));
  const bin=typeof pkg.bin==='string'?pkg.bin:pkg.bin?.wrangler;
  if(!bin)throw new Error('Wrangler não instalado. Execute npm install.');
  const file=resolve(packageDir,bin);
  if(!file.startsWith(packageDir+'/'))throw new Error('Executável Wrangler inválido.');
  return file;
}
export async function guardedWrangler(args) {
  if(args[0]==='deploy'||(args[0]==='versions'&&args[1]==='upload'))await configureD1({required:true});
  const result=spawnSync(process.execPath,[originalWrangler(),...args],{stdio:'inherit'});
  if(result.error)throw result.error;process.exitCode=result.status??1;
}
// A entrada gerada em node_modules/.bin importa esta função com os argumentos originais.
