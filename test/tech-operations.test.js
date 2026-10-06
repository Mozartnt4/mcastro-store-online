import test from 'node:test';
import assert from 'node:assert/strict';
import { D1 } from './helpers/d1.js';
import worker from '../src/index.js';

const headers={'x-admin-password':'op-test'};
async function call(env,path,method='GET',body,admin=false,extra={}){
  const h={...(admin?headers:{}),...extra};if(body!==undefined){h['content-type']='application/json';body=JSON.stringify(body);}
  const r=await worker.fetch(new Request('https://test.local'+path,{method,headers:h,body}),env);return {status:r.status,data:await r.json()};
}
test('Tech: aprovação cria OS única, estoque só baixa ao concluir, pagamentos e despesas entram no caixa',async()=>{
  const env={DB:new D1()};
  try{
    await call(env,'/api/health');await env.DB.prepare("UPDATE configuracoes SET valor='op-test' WHERE chave='admin_password'").run();
    const category=await call(env,'/api/tech/admin/categorias','POST',{nome:'Manutenção'},true);
    const service=await call(env,'/api/tech/admin/servicos','POST',{nome:'Instalação',categoria_id:category.data.id,tipo_preco:'orcamento'},true);
    const request=await call(env,'/api/tech/solicitacoes','POST',new FormData());
    assert.equal(request.status,400);
    const form=new FormData();form.append('dados',JSON.stringify({chave_envio:'c'.repeat(64),servico_id:service.data.id,nome:'Cliente Teste',telefone:'86999999999',endereco:'Rua A, 10',descricao:'Instalar câmera',quantidade:1,respostas:{}}));
    const created=await worker.fetch(new Request('https://test.local/api/tech/solicitacoes',{method:'POST',body:form}),env);assert.equal(created.status,201);
    await env.DB.prepare("INSERT INTO produtos(nome,preco_venda,preco_custo,custo_reposicao,estoque) VALUES('Câmera',250,100,140,3)").run();
    const quote={itens:[{tipo:'Equipamentos',nome:'Câmera',produto_id:1,quantidade:1,preco:250,custo:100,reposicao:140}],desconto:0,validade:new Date(Date.now()+86400000).toISOString(),prazo:'2 dias'};
    assert.equal((await call(env,'/api/tech/admin/solicitacoes/1/orcamento','PUT',quote,true)).status,200);
    assert.equal((await call(env,'/api/tech/admin/solicitacoes/1/enviar','POST',{versao:1},true)).status,200);
    const detail=(await call(env,'/api/tech/admin/solicitacoes/1','GET',undefined,true)).data;
    const token=detail.orcamento.token;
    const decision=await call(env,'/api/tech/orcamentos/'+token+'/decisao','POST',{decisao:'Aprovado',versao:2});assert.equal(decision.status,200,JSON.stringify(decision.data));
    assert.equal((await call(env,'/api/tech/admin/ordens','GET',undefined,true)).data.ordens.length,1);
    assert.equal((await env.DB.prepare('SELECT estoque FROM produtos WHERE id=1').first()).estoque,3);
    const order=(await call(env,'/api/tech/admin/ordens/1','GET',undefined,true)).data;
    assert.equal(order.ordem.numero,'MC-OS-000001');
    const publicTrack=await call(env,'/api/tech/acompanhar/'+order.ordem.public_link.split('/').pop());assert.equal(publicTrack.status,200);
    const addon=await call(env,'/api/tech/admin/ordens/1/aditivos','POST',{motivo:'Cliente pediu novo ponto',itens:[{tipo:'Mão de obra',nome:'Ponto adicional',quantidade:1,preco:20,custo:5,reposicao:0}]},true);
    assert.equal(addon.status,201,JSON.stringify(addon.data));
    const addonKey=addon.data.link.split('/').pop();assert.equal((await call(env,'/api/tech/aditivos/'+addonKey)).status,200);
    assert.equal((await call(env,'/api/tech/aditivos/'+addonKey+'/decisao','POST',{decisao:'Aprovado',versao:1})).status,200);
    assert.equal((await call(env,'/api/tech/admin/ordens/1/itens','PUT',{itens:[{id:1,quantidade_utilizada:1}]},true)).status,200);
    await env.DB.prepare('UPDATE produtos SET estoque=0 WHERE id=1').run();
    assert.equal((await call(env,'/api/tech/admin/ordens/1/status','PUT',{status:'Concluído'},true)).status,409);
    await env.DB.prepare('UPDATE produtos SET estoque=3 WHERE id=1').run();
    assert.equal((await call(env,'/api/tech/admin/ordens/1/status','PUT',{status:'Concluído'},true)).status,200);
    assert.equal((await env.DB.prepare('SELECT estoque FROM produtos WHERE id=1').first()).estoque,2);
    assert.equal((await env.DB.prepare('SELECT ordem_servico_id FROM movimentacoes_estoque').first()).ordem_servico_id,1);
    assert.equal((await call(env,'/api/tech/admin/ordens/1/pagamentos','POST',{chave:'pgto-1-valid',valor:250,metodo:'Pix'},true)).status,200);
    assert.equal((await call(env,'/api/tech/admin/ordens/1/despesas','POST',{chave:'despesa-1',categoria:'Deslocamento',descricao:'Combustível',valor:20},true)).status,201);
    assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM caixa WHERE tech_pagamento_id IS NOT NULL").first()).n,1);
    assert.equal((await env.DB.prepare("SELECT COUNT(*) n FROM caixa WHERE tech_despesa_id IS NOT NULL").first()).n,1);
    assert.equal((await call(env,'/api/tech/admin/dashboard','GET',undefined,true)).data.indicadores.resultado_disponivel_centavos,9000);
    assert.equal((await call(env,'/api/tech/admin/dashboard','GET',undefined,true)).data.indicadores.a_receber,2000);
    assert.equal((await call(env,'/api/tech/admin/ordens/1/status','PUT',{status:'Em execução'},true)).status,409);
  }finally{env.DB.close();}
});
