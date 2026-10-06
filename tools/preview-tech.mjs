// Prévia local Node 24: SQLite isolado. Não usa D1 remoto nem envia imagens à nuvem.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { D1 } from '../test/helpers/d1.js';
import worker from '../src/index.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const local=resolve(root,'.local-tech');
const assets=resolve(root,'public');
await mkdir(local,{recursive:true});
let config;
try{config=JSON.parse(await readFile(resolve(local,'access.json'),'utf8'));}
catch(error){if(error.code!=='ENOENT')throw error;config={password:randomBytes(6).toString('hex')};await writeFile(resolve(local,'access.json'),JSON.stringify(config),{mode:0o600});}
const env={DB:new D1(resolve(local,'preview.sqlite')),ASSETS:{async fetch(request){
 let pathname;try{pathname=decodeURIComponent(new URL(request.url).pathname);}catch{return new Response('Endereço inválido',{status:400});}
 const file=resolve(assets,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(assets+sep))return new Response('Não encontrado',{status:404});
 const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.webmanifest':'application/manifest+json'};
 try{return new Response(request.method==='HEAD'?null:await readFile(file),{headers:{'content-type':types[extname(file)]||'application/octet-stream','cache-control':'no-store'}});}catch{return new Response('Não encontrado',{status:404});}
}}};
// Neste processo de prévia, nenhuma chamada externa do Worker é enviada.
globalThis.fetch=async()=>Response.json({error:{message:'Uploads externos desativados na prévia local.'}},{status:503});
await worker.fetch(new Request('http://localhost/api/health'),env);
if(!await env.DB.prepare("SELECT valor FROM configuracoes WHERE chave='admin_password_hash'").first())await env.DB.prepare("UPDATE configuracoes SET valor=? WHERE chave='admin_password'").bind(config.password).run();
await env.DB.prepare("UPDATE configuracoes SET valor='' WHERE chave IN ('whatsapp','pixKey')").run();
const port=Number(process.env.TECH_PREVIEW_PORT||8787);
let queue=Promise.resolve();
const server=createServer((incoming,outgoing)=>{
 queue=queue.then(async()=>{
  const url=new URL(incoming.url,`http://localhost:${port}`);
  // Rejeita Host externo e chamadas de outras origens para este servidor local.
  if(!['localhost:'+port,'127.0.0.1:'+port].includes(incoming.headers.host)) {outgoing.writeHead(403);outgoing.end('Host inválido');return;}
  if(incoming.headers.origin&&!['http://localhost:'+port,'http://127.0.0.1:'+port].includes(incoming.headers.origin)){outgoing.writeHead(403);outgoing.end('Origem inválida');return;}
  const init={method:incoming.method,headers:incoming.headers};
  if(!['GET','HEAD'].includes(incoming.method)){init.body=incoming;init.duplex='half';}
  const response=await worker.fetch(new Request(url,init),env);
  outgoing.writeHead(response.status,Object.fromEntries(response.headers));outgoing.end(Buffer.from(await response.arrayBuffer()));
 }).catch(error=>{console.error(error);if(!outgoing.headersSent)outgoing.writeHead(500);outgoing.end('Erro na prévia local');});
});
server.listen(port,'127.0.0.1',()=>{
 console.log(`Prévia local: http://localhost:${port}/tech`);
 console.log(`Administração: http://localhost:${port}/tech/admin`);
 console.log(`Senha de teste: ${config.password}`);
 console.log('Banco SQLite separado em .local-tech/preview.sqlite. Não acessa a produção.');
 console.log('Teste solicitações sem fotos. Upload real será validado em ambiente Cloudflare.');
});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{env.DB.close();process.exit(0);}));
