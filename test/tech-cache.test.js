import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('PWA ignora API, links Tech e páginas administrativas; atualiza cache antigo',async()=>{
 const handlers={},deleted=[];
 runInNewContext(readFileSync(new URL('../public/service-worker.js',import.meta.url),'utf8'),{
  self:{location:{origin:'https://loja.test'},addEventListener:(name,fn)=>handlers[name]=fn,clients:{claim(){}},skipWaiting(){}},
  URL,Promise,caches:{keys:async()=>['mcastro-v61','mcastro-v62','mcastro-v63','mcastro-v64','mcastro-v65','mcastro-v66','mcastro-v67'],delete:async key=>deleted.push(key)}
 });
 let activation;handlers.activate({waitUntil:p=>activation=p});await activation;assert.deepEqual(deleted,['mcastro-v61','mcastro-v62','mcastro-v63','mcastro-v64','mcastro-v65','mcastro-v66']);
 for(const path of ['/api/bootstrap?admin=1','/api/tech/orcamentos/segredo','/tech','/tech/admin','/tech/orcamento/segredo','/?modo=admin']){
  let intercepted=false;handlers.fetch({request:{method:'GET',url:'https://loja.test'+path,mode:'navigate',headers:new Headers()},respondWith:()=>intercepted=true});assert.equal(intercepted,false,path);
 }
});
