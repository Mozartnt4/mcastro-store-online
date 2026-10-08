import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveExistingD1} from '../tools/configure-d1.mjs';
const config={account_id:'a'.repeat(32),name:'mcastro-store-online'};
const db='12345678-1234-1234-1234-123456789abc';
test('Publicação preserva D1 existente inclusive sem D1:Read; nunca cria banco nem consulta dados',async()=>{
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push(url);assert.equal(options.method,undefined);
  if(url.includes('/d1/'))return Response.json({success:false},{status:403});
  if(url.endsWith('/deployments'))return Response.json({success:true,result:{deployments:[{created_on:'2026-10-08',versions:[{version_id:'novo'}]},{created_on:'2026-10-07',versions:[{version_id:'anterior'}]}]}});
  if(url.endsWith('/versions/novo'))return Response.json({success:true,result:{resources:{bindings:[]}}});
  if(url.endsWith('/versions/anterior'))return Response.json({success:true,result:{resources:{bindings:[{name:'DB',type:'d1',id:db}]}}});
  throw new Error('Consulta inesperada');
 };
 const resolved=await resolveExistingD1(config,'token-teste',fetcher);assert.equal(resolved.d1_databases[0].database_id,db);assert.equal(resolved.d1_databases[0].database_name,'mcastro-database');assert.equal(calls.length,4);
 const already=await resolveExistingD1(resolved,null,()=>{throw Error('Não deve consultar se o banco está configurado');});assert.equal(already,resolved);
 await assert.rejects(()=>resolveExistingD1(config,null,fetcher),/indisponível/);
 await assert.rejects(()=>resolveExistingD1(config,'token-teste',async()=>Response.json({success:true,result:[]})),/nenhum banco foi criado/);
 const direct=await resolveExistingD1(config,'token-teste',async()=>Response.json({success:true,result:[{name:'mcastro-database',uuid:db}]}));assert.equal(direct.d1_databases[0].database_id,db);
});

test('Entrada npm protege deploy padrão e mantém o executável original do Wrangler',async()=>{
 const {mkdtempSync,mkdirSync,writeFileSync,copyFileSync,readFileSync,symlinkSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {spawnSync}=await import('node:child_process');
 const root=mkdtempSync(join(tmpdir(),'wrangler-guard-'));
 try{
  mkdirSync(join(root,'tools'));mkdirSync(join(root,'node_modules/wrangler/bin'),{recursive:true});mkdirSync(join(root,'node_modules/.bin'));
  writeFileSync(join(root,'package.json'),JSON.stringify({type:'module'}));
  for(const name of ['install-deploy-guard.mjs','wrangler-guard.mjs','configure-d1.mjs'])copyFileSync(new URL('../tools/'+name,import.meta.url),join(root,'tools',name));
  writeFileSync(join(root,'wrangler.jsonc'),JSON.stringify({...config,d1_databases:[{binding:'DB',database_name:'mcastro-database',database_id:db}]}));
  writeFileSync(join(root,'node_modules/wrangler/package.json'),JSON.stringify({type:'module',bin:{wrangler:'bin/wrangler.js'}}));
  const original="console.log('CLI original '+process.argv.slice(2).join(' '));";writeFileSync(join(root,'node_modules/wrangler/bin/wrangler.js'),original);
  symlinkSync('../wrangler/bin/wrangler.js',join(root,'node_modules/.bin/wrangler'));
  const install=spawnSync(process.execPath,['tools/install-deploy-guard.mjs'],{cwd:root,encoding:'utf8'});assert.equal(install.status,0,install.stderr);
  const deploy=spawnSync(process.execPath,['node_modules/.bin/wrangler','deploy'],{cwd:root,encoding:'utf8'});assert.equal(deploy.status,0,deploy.stderr);assert.match(deploy.stdout,/CLI original deploy/);
  const dev=spawnSync(process.execPath,['node_modules/.bin/wrangler','dev'],{cwd:root,encoding:'utf8'});assert.equal(dev.status,0);assert.match(dev.stdout,/CLI original dev/);
  assert.equal(readFileSync(join(root,'node_modules/wrangler/bin/wrangler.js'),'utf8'),original);
 }finally{rmSync(root,{recursive:true,force:true});}
});
