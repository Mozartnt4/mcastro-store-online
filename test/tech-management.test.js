import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { D1 } from './helpers/d1.js';
import worker from '../src/index.js';
import { ensureTechSchema } from '../src/tech-schema.js';
import { financialSummary } from '../src/tech-management.js';

async function call(env,path,method='GET',body,admin=true){
 const headers=admin?{'x-admin-password':'management-test'}:{};
 if(body!==undefined){headers['content-type']='application/json';body=JSON.stringify(body);}
 const r=await worker.fetch(new Request('https://test.local/api/tech'+path,{method,headers,body}),env);return {status:r.status,data:await r.json()};
}
async function setup(env){await worker.fetch(new Request('https://test.local/api/health'),env);await env.DB.prepare("UPDATE configuracoes SET valor='management-test' WHERE chave='admin_password'").run();}
async function order(env){
 const c=await call(env,'/admin/categorias','POST',{nome:'Segurança'});
 const s=await call(env,'/admin/servicos','POST',{nome:'Câmera',categoria_id:c.data.id,tipo_preco:'orcamento'});
 const f=new FormData();f.append('dados',JSON.stringify({chave_envio:'d'.repeat(64),servico_id:s.data.id,nome:'Cliente Real',telefone:'86999999998',endereco:'Rua B, 20',descricao:'Instalar câmera externa',quantidade:1}));
 assert.equal((await worker.fetch(new Request('https://test.local/api/tech/solicitacoes',{method:'POST',body:f}),env)).status,201);
 await env.DB.prepare("INSERT INTO produtos(nome,preco_venda,preco_custo,custo_reposicao,estoque) VALUES('Câmera',400,164.90,220,3)").run();
 assert.equal((await call(env,'/admin/solicitacoes/1/orcamento','PUT',{itens:[{tipo:'Equipamentos',nome:'Câmera',produto_id:1,quantidade:1,preco:400}],validade:new Date(Date.now()+86400000).toISOString(),prazo:'2 dias',garantia:'90 dias'})).status,200);
 assert.equal((await call(env,'/admin/solicitacoes/1/enviar','POST',{versao:1})).status,200);
 const q=(await call(env,'/admin/solicitacoes/1')).data.orcamento;
 assert.equal((await call(env,'/orcamentos/'+q.token+'/decisao','POST',{versao:1,decisao:'Aprovado'},false)).status,409);
 assert.equal((await call(env,'/orcamentos/'+q.token+'/decisao','POST',{versao:2,decisao:'Aprovado'},false)).status,200);
 return (await call(env,'/admin/ordens/1')).data;
}

test('Catálogo real: importação uma vez, preserva cadastros, exclusões e serviços ao reabrir SQLite',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'catalog-')),file=join(dir,'d1.sqlite');let env={DB:new D1(file),TECH_IMPORT_CATALOG:'catalogo-real-20260923-v1'};
 try{
  await setup(env);const d=(await call(env,'/catalogo','GET',undefined,false)).data;assert.equal(d.categorias.length,7);assert.equal(d.servicos.length,15);assert.ok(d.servicos.every(s=>s.tipo_preco==='orcamento'&&s.preco_centavos===0));
  const service=d.servicos[0];assert.equal((await call(env,'/admin/servicos/'+service.id,'DELETE')).status,200);
  env.DB.close();env={DB:new D1(file),TECH_IMPORT_CATALOG:'catalogo-real-20260923-v1'};
  assert.equal((await call(env,'/catalogo','GET',undefined,false)).data.servicos.length,14);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) n FROM tech_servicos').first()).n,15);
 }finally{env.DB.close();rmSync(dir,{recursive:true,force:true});}
 const other={DB:new D1(),TECH_IMPORT_CATALOG:'catalogo-real-20260923-v1'};
 try{await setup(other);await ensureTechSchema(other);await other.DB.prepare("INSERT INTO tech_categorias(nome,descricao) VALUES('Climatização','Descrição do proprietário')").run();await call(other,'/catalogo','GET',undefined,false);assert.equal((await other.DB.prepare("SELECT descricao FROM tech_categorias WHERE nome='Climatização'").first()).descricao,'Descrição do proprietário');}finally{other.DB.close();}
});

test('Equipamento, garantia, retorno e termos: servidor persiste histórico e isola dados internos',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'management-')),file=join(dir,'d1.sqlite');let env={DB:new D1(file)};
 try{
  await setup(env);const o=await order(env);
  assert.equal((await call(env,'/admin/ordens/1/agendamento','PUT',{agendado_para:'2026-10-09T17:30:00.000Z',responsavel:'Técnico',observacoes:'Confirmado'})).status,200);assert.equal((await call(env,'/admin/agenda')).data.ordens[0].responsavel,'Técnico');
  const eq=await call(env,'/admin/equipamentos','POST',{ordem_id:1,produto_id:1,nome:'Câmera P15',serie:'SN-123',local:'Entrada',instalado_em:'2026-10-08',garantia_ate:'2027-01-06',cobertura:'Equipamento'});assert.equal(eq.status,201,JSON.stringify(eq.data));
  assert.equal((await call(env,'/admin/equipamentos','POST',{ordem_id:1,produto_id:999,nome:'Inválido',instalado_em:'2026-10-08'})).status,400);
  assert.equal((await call(env,'/admin/garantias','POST',{ordem_id:1,inicio:'2026-02-30',fim:'2026-10-09'})).status,400);
  assert.equal((await call(env,'/admin/garantias','POST',{ordem_id:1,equipamento_id:eq.data.id,inicio:'2026-10-08',fim:'2027-01-06'})).status,409);
  const g=(await call(env,'/admin/garantias')).data.garantias[0];assert.equal(g.equipamento_nome,'Câmera P15');
  const ret=await call(env,`/admin/garantias/${g.id}/retornos`,'POST',{descricao:'Cliente informou falha no sinal',responsavel:'Técnico'});assert.equal(ret.status,201);
  assert.equal((await call(env,'/admin/retornos/'+ret.data.id,'PUT',{status:'Concluído',solucao:''})).status,400);
  assert.equal((await call(env,'/admin/retornos/'+ret.data.id,'PUT',{status:'Concluído',solucao:'Conexão ajustada',responsavel:'Técnico'})).status,200);
  assert.equal((await env.DB.prepare('SELECT estoque FROM produtos WHERE id=1').first()).estoque,3);
  const m=await call(env,'/admin/termo-modelos','POST',{nome:'Instalação',prestador:'MCastro Solutions',pagamento:'Pix após execução',responsabilidades:'Conforme condições acordadas',limitacoes:'Escopo da proposta',condicoes:'Conferir local'});assert.equal(m.status,200);
  assert.equal((await call(env,'/admin/ordens/1/termos','POST',{modelo_id:m.data.id})).status,201);
  assert.equal((await call(env,'/admin/termo-modelos/'+m.data.id,'PUT',{nome:'Instalação',prestador:'MCastro revisado',versao:1})).status,200);
  assert.equal((await call(env,'/admin/termo-modelos/'+m.data.id,'PUT',{nome:'Instalação',prestador:'Sobrescrever',versao:1})).status,409);
  assert.equal((await call(env,'/admin/ordens/1/termos','POST',{modelo_id:m.data.id})).status,201);
  env.DB.close();env={DB:new D1(file)};
  const terms=(await call(env,'/admin/ordens/1/termos')).data.termos;assert.equal(terms.length,2);assert.equal(terms[1].documento.modelo.prestador,'MCastro Solutions');assert.equal(terms[0].documento.modelo.prestador,'MCastro revisado');assert.equal(terms[0].documento.garantia,'90 dias');assert.equal(terms[0].documento.itens[0].custo_centavos,undefined);
  const history=(await call(env,'/admin/clientes/1/historico')).data;assert.equal(history.equipamentos.length,1);assert.equal(history.garantias.length,1);assert.equal(history.solicitacoes[0].status,'Convertido em OS');
  const tracking=await call(env,'/acompanhar/'+o.ordem.public_link.split('/').pop(),'GET',undefined,false);assert.equal(tracking.status,200);assert.ok(!JSON.stringify(tracking.data).includes('custo_centavos'));
  for(const p of ['/admin/agenda','/admin/clientes','/admin/materiais','/admin/equipamentos','/admin/garantias','/admin/termo-modelos','/admin/ordens/1/termos','/admin/financeiro','/admin/configuracoes'])assert.equal((await call(env,p,'GET',undefined,false)).status,401,p);
  for(const p of ['/admin/equipamentos','/admin/garantias','/admin/garantias/1/retornos','/admin/termo-modelos','/admin/ordens/1/termos','/admin/financeiro/previsao'])assert.equal((await call(env,p,'POST',{},false)).status,401,p);
 }finally{env.DB.close();rmSync(dir,{recursive:true,force:true});}
});

test('Lucro Real MCastro: regras explícitas, reposição atual e preço sustentável sem percentuais arbitrários',async()=>{
 const env={DB:new D1()};try{
  await setup(env);await order(env);
  assert.deepEqual((await call(env,'/admin/configuracoes')).data.financeiro,{protecao_pct:null,margem_real_pct:null});
  assert.equal((await call(env,'/admin/configuracoes','PUT',{protecao_pct:10,margem_real_pct:100})).status,400);
  assert.equal((await call(env,'/admin/configuracoes','PUT',{protecao_pct:10,margem_real_pct:20})).status,200);
  const forecast=(await call(env,'/admin/financeiro/previsao','POST',{itens:[{tipo:'Equipamentos',nome:'Câmera',produto_id:1,quantidade:1,preco:400}]})).data;
  assert.equal(forecast.custo_estimado_centavos,16490);assert.equal(forecast.reposicao_centavos,22000);assert.equal(forecast.protecao_centavos,2200);assert.equal(forecast.preco_minimo_centavos,30250);assert.equal(forecast.lucro_real_estimado_centavos,15800);
  await call(env,'/admin/ordens/1/itens','PUT',{itens:[{id:1,quantidade_utilizada:1}]});await call(env,'/admin/ordens/1/status','PUT',{status:'Concluído'});
  assert.equal((await call(env,'/admin/ordens/1/pagamentos','POST',{chave:'after-completion',valor:400,metodo:'Pix'})).status,200);
  const report=(await call(env,'/admin/financeiro')).data;assert.equal(report.resumo.ticket_medio_centavos,40000);assert.equal(report.resumo.lucro_real_estimado_centavos,15800);assert.equal(report.ordens[0].financeiro.completo,true);
  assert.equal((await call(env,'/admin/dashboard')).data.indicadores.lucro_real_estimado_centavos,15800);
  const missing=financialSummary([{tipo:'Materiais',quantidade:1,quantidade_utilizada:1,custo_centavos:1000,reposicao_centavos:0}],4000,4000,0,{protecao_pct:0,margem_real_pct:0},true);assert.equal(missing.lucro_real_estimado_centavos,null);assert.equal(missing.preco_minimo_centavos,null);
  await call(env,'/admin/configuracoes','PUT',{protecao_pct:'',margem_real_pct:''});assert.equal((await call(env,'/admin/financeiro')).data.resumo.lucro_real_estimado_centavos,null);
 }finally{env.DB.close();}
});


test('Recebimentos concorrentes não ultrapassam o saldo nem deixam caixa divergente',async()=>{
 const env={DB:new D1()};try{
  await setup(env);await order(env);
  const results=await Promise.all([call(env,'/admin/ordens/1/pagamentos','POST',{chave:'concorrente-pgto-a',valor:300,metodo:'Pix'}),call(env,'/admin/ordens/1/pagamentos','POST',{chave:'concorrente-pgto-b',valor:300,metodo:'Pix'})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal((await env.DB.prepare('SELECT pago_centavos FROM tech_ordens WHERE id=1').first()).pago_centavos,30000);
  assert.equal((await env.DB.prepare('SELECT SUM(valor_centavos) total FROM tech_pagamentos').first()).total,30000);
  assert.equal((await env.DB.prepare('SELECT SUM(valor) total FROM caixa WHERE tech_pagamento_id IS NOT NULL').first()).total,300);
 }finally{env.DB.close();}
});
