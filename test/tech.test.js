import test from 'node:test';
import assert from 'node:assert/strict';
import { D1 } from './helpers/d1.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import worker from '../src/index.js';
import { quoteItems, publicQuote, validatePhoto } from '../src/tech.js';

const adminHeaders={'x-admin-password':'senha-teste'};
async function call(env,path,method='GET',body,admin=false,extra={}){
  const headers={...(admin?adminHeaders:{}),...extra};
  if(body!==undefined && !(body instanceof FormData)){headers['content-type']='application/json';body=JSON.stringify(body);}
  const res=await worker.fetch(new Request('https://loja.test'+path,{method,headers,body}),env);
  return {status:res.status,data:await res.json(),headers:res.headers};
}
async function setup(path){const env={DB:new D1(path)};await call(env,'/api/health');await env.DB.prepare("UPDATE configuracoes SET valor='senha-teste' WHERE chave='admin_password'").run();return env;}
async function fixtures(env){
  const c=await call(env,'/api/tech/admin/categorias','POST',{nome:'Instalações',campos:[{key:'ambiente',label:'Ambiente',type:'selecao',required:true,options:['Interno','Externo']}]},true);assert.equal(c.status,200);
  const s=await call(env,'/api/tech/admin/servicos','POST',{nome:'Instalar câmera',categoria_id:c.data.id,tipo_preco:'apartir',preco:150,campos:[{key:'altura',label:'Altura',type:'numero'}]},true);assert.equal(s.status,200);return {category:c.data.id,service:s.data.id};
}
function submission(service,key='a'.repeat(64),overrides={},files=[]){const f=new FormData();f.append('dados',JSON.stringify({chave_envio:key,servico_id:service,nome:'João Silva',telefone:'86999999999',endereco:'Teresina',descricao:'Instalar câmera na garagem',quantidade:1,respostas:{ambiente:'Externo',altura:3},...overrides}));files.forEach(file=>f.append('fotos',file,'foto.png'));return f;}
const proposal=(extra={})=>({itens:[{tipo:'Equipamentos',nome:'Câmera',quantidade:1,preco:400,custo:164.9,reposicao:220},{tipo:'Materiais',nome:'Cabo',quantidade:2.5,preco:4,custo:2},{tipo:'Mão de obra',nome:'Instalação',quantidade:1,preco:150,custo:40}],desconto:10,validade:new Date(Date.now()+86400000).toISOString(),prazo:'Até 3 dias após agendamento',garantia:'90 dias',observacoes:'Combinar acesso ao local',...extra});

test('Tech: fluxo persistente, edição concorrente, sigilo e decisão única',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'mcastro-tech-'));let env;
 try{
  const dbPath=join(dir,'test.sqlite');env=await setup(dbPath);const {service,category}=await fixtures(env);
  await env.DB.prepare("INSERT INTO clientes(nome,whatsapp,email,endereco) VALUES('Cadastro anterior','86999999999','preservar@teste.com','Endereço anterior')").run();
  const catalog=await call(env,'/api/tech/catalogo');assert.equal(catalog.data.servicos[0].perguntas.length,2);
  const created=await call(env,'/api/tech/solicitacoes','POST',submission(service));assert.equal(created.status,201);assert.equal(created.data.numero,'MC-ORC-000001');
  assert.equal((await call(env,'/api/tech/solicitacoes','POST',submission(service))).status,200);
  assert.equal((await env.DB.prepare('SELECT count(*) n FROM tech_solicitacoes').first()).n,1);
  assert.equal((await env.DB.prepare('SELECT email FROM clientes').first()).email,'preservar@teste.com');
  assert.equal((await call(env,'/api/tech/admin/solicitacoes')).status,401);
  assert.equal((await call(env,'/api/tech/admin/solicitacoes/1','GET')).status,401);
  assert.equal((await call(env,'/api/tech/admin/categorias/'+category,'DELETE',undefined,true)).status,409);
  assert.equal((await call(env,'/api/tech/admin/solicitacoes/1/status','PUT',{status:'Em análise'},true)).status,200);
  assert.equal((await call(env,'/api/tech/admin/solicitacoes/1/orcamento','PUT',proposal(),true)).status,200);
  let detail=(await call(env,'/api/tech/admin/solicitacoes/1','GET',undefined,true)).data;
  assert.equal(detail.orcamento.total_centavos,55000);assert.equal(detail.orcamento.link,null);
  const secret=detail.orcamento.token;
  assert.equal((await call(env,'/api/tech/orcamentos/'+secret)).status,404);
  assert.equal((await call(env,'/api/tech/admin/solicitacoes/1/orcamento','PUT',proposal({versao:1}),true)).status,200);
  assert.equal((await call(env,'/api/tech/admin/solicitacoes/1/orcamento','PUT',proposal({versao:1}),true)).status,409);
  assert.equal((await call(env,'/api/tech/admin/solicitacoes/1/enviar','POST',{versao:1},true)).status,409);
  assert.equal((await call(env,'/api/tech/admin/solicitacoes/1/enviar','POST',{versao:2},true)).status,200);
  assert.equal((await call(env,'/api/tech/admin/solicitacoes/1/orcamento','PUT',proposal({versao:3}),true)).status,409);
  let pub=await call(env,'/api/tech/orcamentos/'+secret);assert.equal(pub.status,200);assert.equal(pub.headers.get('cache-control'),'no-store');
  const text=JSON.stringify(pub.data);for(const key of ['custo','reposicao','cliente_id','telefone','token','fotos','chave_envio'])assert.equal(text.includes(key),false,key);
  assert.equal((await call(env,'/api/tech/orcamentos/'+'b'.repeat(64))).status,404);
  assert.equal((await call(env,'/api/tech/orcamentos/'+secret+'/decisao','POST',{decisao:'Aprovado',versao:3},false,{origin:'https://evil.test'})).status,403);
  env.DB.close();env={DB:new D1(dbPath)};
  pub=await call(env,'/api/tech/orcamentos/'+secret);assert.equal(pub.data.total_centavos,55000);
  assert.equal((await call(env,'/api/tech/orcamentos/'+secret+'/decisao','POST',{decisao:'Aprovado',versao:3})).status,200);
  assert.equal((await call(env,'/api/tech/orcamentos/'+secret+'/decisao','POST',{decisao:'Recusado',versao:3})).status,409);
  pub=await call(env,'/api/tech/orcamentos/'+secret);assert.equal(pub.data.status,'Aprovado');assert.ok(pub.data.decidido_em);
  const backup=await call(env,'/api/admin/backup','GET',undefined,true);assert.equal(backup.data.data.tech_solicitacoes.length,1);assert.equal(backup.data.data.tech_orcamentos.length,1);assert.equal(JSON.stringify(backup.data).includes('admin_password_hash'),false);
 }finally{env?.DB.close();rmSync(dir,{recursive:true,force:true});}
});

test('Tech: validação dos campos, serviços inativos, upload real simulado só no provedor e expiração',async()=>{
 const env=await setup();const originalFetch=globalThis.fetch;
 try{
  const {service}=await fixtures(env);
  assert.equal((await call(env,'/api/tech/solicitacoes','POST',submission(service,'c'.repeat(64),{respostas:{}}))).status,400);
  assert.equal((await call(env,'/api/tech/solicitacoes','POST',submission(service,'c'.repeat(64),{respostas:{ambiente:'Externo',fechadura:'errado'}}))).status,400);
  assert.equal((await call(env,'/api/tech/solicitacoes','POST',submission(service,'c'.repeat(64),{},[new Blob(['invalido'],{type:'image/png'})]))).status,400);
  const png=new Blob([Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0,0,0,0,0])],{type:'image/png'});
  assert.equal((await call(env,'/api/tech/solicitacoes','POST',submission(service,'c'.repeat(64),{},Array(7).fill(png)))).status,400);
  let uploads=0;globalThis.fetch=async(url,opts)=>{assert.match(String(url),/^https:\/\/api.cloudinary.com\/v1_1\/fzklkuxa\/image\/upload$/);assert.equal(opts.method,'POST');uploads++;return Response.json({secure_url:'https://res.cloudinary.com/fzklkuxa/image/upload/foto.png',public_id:'foto'});};
  assert.equal((await call(env,'/api/tech/solicitacoes','POST',submission(service,'c'.repeat(64),{},[png,png]))).status,201);assert.equal(uploads,2);
  let detail=(await call(env,'/api/tech/admin/solicitacoes/1','GET',undefined,true)).data;assert.equal(detail.solicitacao.fotos.length,2);
  await call(env,'/api/tech/admin/solicitacoes/1/orcamento','PUT',proposal(),true);await call(env,'/api/tech/admin/solicitacoes/1/enviar','POST',{versao:1},true);
  detail=(await call(env,'/api/tech/admin/solicitacoes/1','GET',undefined,true)).data;
  await env.DB.prepare("UPDATE tech_orcamentos SET validade='2020-01-01T00:00:00.000Z'").run();
  assert.equal((await call(env,'/api/tech/orcamentos/'+detail.orcamento.token)).data.status,'Expirado');
  assert.equal((await call(env,'/api/tech/orcamentos/'+detail.orcamento.token+'/decisao','POST',{decisao:'Aprovado',versao:2})).status,409);
  await env.DB.prepare('UPDATE tech_servicos SET ativo=0').run();
  assert.equal((await call(env,'/api/tech/catalogo')).data.servicos.length,0);
  assert.equal((await call(env,'/api/tech/solicitacoes','POST',submission(service,'d'.repeat(64)))).status,404);
 }finally{globalThis.fetch=originalFetch;env.DB.close();}
});

test('Tech: upload falho não grava solicitação; limite de abuso e exclusão preservam histórico',async()=>{
 const env=await setup(),originalFetch=globalThis.fetch;
 try{
  const {service,category}=await fixtures(env);
  const png=new Blob([Uint8Array.from([137,80,78,71,13,10,26,10])],{type:'image/png'});
  globalThis.fetch=async()=>Response.json({error:'falha'},{status:400});
  assert.equal((await call(env,'/api/tech/solicitacoes','POST',submission(service,'e'.repeat(64),{},[png]))).status,502);
  assert.equal((await env.DB.prepare('SELECT count(*) n FROM tech_solicitacoes').first()).n,0);
  assert.equal((await call(env,'/api/tech/solicitacoes','POST',submission(service))).status,201);
  for(let i=0;i<6;i++)await call(env,'/api/tech/solicitacoes','POST',submission(service));
  assert.equal((await call(env,'/api/tech/solicitacoes','POST',submission(service))).status,429);
  assert.equal((await call(env,'/api/tech/admin/servicos/'+service,'DELETE',undefined,true)).status,200);
  assert.equal((await call(env,'/api/tech/admin/categorias/'+category,'DELETE',undefined,true)).status,200);
  assert.equal((await call(env,'/api/tech/admin/solicitacoes/1','GET',undefined,true)).data.solicitacao.servico_nome,'Instalar câmera');
 }finally{globalThis.fetch=originalFetch;env.DB.close();}
});

test('Valores decimais, descontos e validação de fotos',async()=>{
 const result=quoteItems([{tipo:'Materiais',nome:'Cabo',quantidade:2.5,preco:1.99,custo:0.5}],0.01);assert.equal(result.total,497);
 assert.throws(()=>quoteItems([{tipo:'Materiais',nome:'Cabo',quantidade:-1,preco:10}]));
 assert.throws(()=>quoteItems([{tipo:'Materiais',nome:'Cabo',quantidade:1,preco:10}],11));
 assert.throws(()=>quoteItems([{tipo:'Materiais',nome:'Cabo',quantidade:1,preco:'NaN'}]));
 assert.throws(()=>quoteItems([{tipo:'Materiais',nome:'Cabo',quantidade:1,preco:10,custo:-2}]));
 await assert.rejects(()=>validatePhoto(new Blob([new Uint8Array(3*1024*1024+1)],{type:'image/png'})));
 await assert.rejects(()=>validatePhoto(new Blob(['<svg onload="alert(1)"/>'],{type:'image/svg+xml'})));
 const p=publicQuote({solicitacao_id:1,itens_json:'[]',status:'Aprovado',custo:999,token:'segredo'});assert.equal(p.token,undefined);assert.equal(p.custo,undefined);
});

test('Store: catálogo protege custos; pedido, estoque e caixa continuam funcionando',async()=>{
 const env=await setup();try{
  const p=await call(env,'/api/products','POST',{name:'Câmera',price:400,cost:164.9,stock:5},true);assert.equal(p.status,201);
  const pub=await call(env,'/api/bootstrap');assert.equal(pub.data.products[0].cost,undefined);assert.equal(pub.data.products[0].price,400);
  const adm=await call(env,'/api/bootstrap?admin=1','GET',undefined,true);assert.equal(adm.data.products[0].cost,164.9);
  const sale=await call(env,'/api/orders','POST',{customer:{name:'Maria Silva',phone:'86988888888'},items:[{id:p.data.product.id,qty:1}]});assert.equal(sale.status,201);
  assert.equal((await env.DB.prepare('SELECT estoque FROM produtos').first()).estoque,4);
  assert.equal((await call(env,'/api/orders/'+sale.data.order.code+'/complete','POST',undefined,true)).status,200);
  assert.equal((await env.DB.prepare('SELECT count(*) n FROM caixa').first()).n,1);
  assert.equal((await call(env,'/api/orders/'+sale.data.order.code+'/complete','POST',undefined,true)).status,200);
  assert.equal((await env.DB.prepare('SELECT count(*) n FROM caixa').first()).n,1);
 }finally{env.DB.close();}
});

test('Rotas Tech usam HTML próprio e cabeçalhos privados sem interferir na Store',async()=>{
 const paths=[];const env={ASSETS:{fetch:async request=>{paths.push(new URL(request.url).pathname);return new Response('<html>Tech</html>');}}};
 const tech=await worker.fetch(new Request('https://loja.test/tech/orcamento/'+'a'.repeat(64)),env);assert.equal(paths[0],'/tech.html');assert.equal(tech.headers.get('cache-control'),'no-store');assert.match(tech.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 await worker.fetch(new Request('https://loja.test/?modo=catalogo'),env);assert.equal(paths[1],'/');
});

test('Tech: todas as mutações administrativas exigem autenticação; recusa e total são do servidor',async()=>{
 const env=await setup();try{
  const {service}=await fixtures(env);
  for(const [path,method] of [['categorias','POST'],['servicos','POST'],['servicos/1','DELETE'],['categorias/1','PUT'],['solicitacoes/1/orcamento','PUT'],['solicitacoes/1/enviar','POST'],['solicitacoes/1/status','PUT']]){
   assert.equal((await call(env,'/api/tech/admin/'+path,method,{})).status,401,path);
  }
  await call(env,'/api/tech/solicitacoes','POST',submission(service));
  await call(env,'/api/tech/admin/solicitacoes/1/orcamento','PUT',proposal({total_centavos:1}),true);
  await call(env,'/api/tech/admin/solicitacoes/1/enviar','POST',{versao:1},true);
  const q=(await call(env,'/api/tech/admin/solicitacoes/1','GET',undefined,true)).data.orcamento;
  assert.equal(q.total_centavos,55000);
  assert.equal((await call(env,'/api/tech/orcamentos/'+q.token+'/decisao','POST',{decisao:'Recusado',versao:2})).status,200);
  assert.equal((await call(env,'/api/tech/orcamentos/'+q.token)).data.status,'Recusado');
  assert.equal((await call(env,'/api/tech/orcamentos/'+q.token+'/decisao','POST',{decisao:'Aprovado',versao:3})).status,409);
 }finally{env.DB.close();}
});
