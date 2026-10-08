import initialCatalog from './tech-catalog.json' with { type: 'json' };

// Importa somente o catálogo real revisado; não sobrescreve cadastros nem importa dados de teste.
export async function importInitialCatalog(env) {
  const marker = await env.DB.prepare('SELECT versao FROM tech_catalogo_importacoes WHERE versao=?').bind(initialCatalog.versao).first();
  if (marker) return;
  const statements = [];
  for (const c of initialCatalog.categorias) statements.push(env.DB.prepare(`INSERT INTO tech_categorias(nome,descricao,campos_json,ativo) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM tech_categorias WHERE nome=?) AND NOT EXISTS(SELECT 1 FROM tech_catalogo_importacoes WHERE versao=?)`).bind(c.nome,c.descricao,c.campos_json,c.ativo,c.nome,initialCatalog.versao));
  for (const s of initialCatalog.servicos) statements.push(env.DB.prepare(`INSERT INTO tech_servicos(categoria_id,nome,descricao,imagem_url,tipo_preco,preco_centavos,tempo,materiais,garantia,observacoes,campos_json,ativo) SELECT c.id,?,?,?,?,?,?,?,?,?,?,? FROM tech_categorias c WHERE c.id=(SELECT id FROM tech_categorias WHERE nome=? AND excluido=0 ORDER BY id LIMIT 1) AND NOT EXISTS(SELECT 1 FROM tech_servicos WHERE nome=? AND categoria_id=c.id) AND NOT EXISTS(SELECT 1 FROM tech_catalogo_importacoes WHERE versao=?)`).bind(s.nome,s.descricao,s.imagem_url,s.tipo_preco,s.preco_centavos,s.tempo,s.materiais,s.garantia,s.observacoes,s.campos_json,s.ativo,s.categoria,s.nome,initialCatalog.versao));
  statements.push(env.DB.prepare('INSERT OR IGNORE INTO tech_catalogo_importacoes(versao) VALUES(?)').bind(initialCatalog.versao));
  await env.DB.batch(statements);
}

export async function financeRules(env) {
  const row = await env.DB.prepare("SELECT valor FROM tech_config WHERE chave='financeiro'").first();
  return row ? JSON.parse(row.valor) : { protecao_pct:null, margem_real_pct:null };
}
const tangible = i => ['Equipamentos','Materiais'].includes(i.tipo);
export function financialSummary(items, total, paid, expenses, rules, completed) {
  const quantities = i => completed ? (tangible(i) ? Number(i.quantidade_utilizada||0) : Number(i.quantidade)) : Number(i.quantidade);
  const cost = items.reduce((s,i)=>s+Math.round(quantities(i)*Number(i.custo_centavos||0)),0);
  const reserve = items.filter(tangible).reduce((s,i)=>s+Math.round(quantities(i)*Number(i.reposicao_centavos||0)),0);
  const missing = items.filter(i=>tangible(i)&&quantities(i)>0&&Number(i.reposicao_centavos||0)<=0).length;
  const operationalCost=items.filter(i=>!tangible(i)).reduce((s,i)=>s+Math.round(quantities(i)*Number(i.custo_centavos||0)),0);
  const protection = rules.protecao_pct===null ? null : Math.round(reserve*rules.protecao_pct/100);
  const minimum = protection===null || rules.margem_real_pct===null || missing ? null : Math.ceil((reserve+expenses+operationalCost+protection)/(1-rules.margem_real_pct/100));
  const income = completed ? paid : total;
  return { total_centavos:total, recebido_centavos:paid, despesas_centavos:expenses, custo_operacional_centavos:operationalCost, custo_estimado_centavos:cost,
    lucro_bruto_estimado_centavos:total-cost, margem_bruta_pct:total?Math.round((total-cost)/total*10000)/100:0,
    markup:cost?Math.round(total/cost*10000)/10000:null, markup_pct:cost?Math.round((total-cost)/cost*10000)/100:null, reposicao_centavos:reserve, materiais_sem_reposicao:missing,
    protecao_centavos:protection, preco_minimo_centavos:minimum,
    resultado_apos_reposicao_centavos:income-expenses-reserve-operationalCost,
    lucro_real_estimado_centavos:protection===null||rules.margem_real_pct===null||missing?null:income-expenses-reserve-operationalCost-protection,
    regras:rules, base:completed?'Recebimentos e materiais utilizados':'Proposta e quantidades previstas',
    completo:completed&&!missing&&protection!==null&&rules.margem_real_pct!==null };
}
export async function financeReport(env) {
  const rules = await financeRules(env);
  const [orders,items,expenses] = await Promise.all([
    env.DB.prepare(`SELECT id,numero,servico_nome,status,total_centavos,pago_centavos,criado_em FROM tech_ordens WHERE status<>'Cancelado' ORDER BY id DESC`).all(),
    env.DB.prepare('SELECT * FROM tech_ordem_itens').all(),
    env.DB.prepare('SELECT ordem_id,SUM(valor_centavos) total FROM tech_despesas GROUP BY ordem_id').all()
  ]);
  const rows=orders.results.map(o=>({ ...o, financeiro:financialSummary(items.results.filter(i=>i.ordem_id===o.id),o.total_centavos,o.pago_centavos,Number(expenses.results.find(e=>e.ordem_id===o.id)?.total||0),rules,o.status==='Concluído') }));
  const completed=rows.filter(o=>o.status==='Concluído');
  const sum=k=>completed.reduce((s,o)=>s+Number(o.financeiro[k]||0),0);
  return { regras:rules, ordens:rows, resumo:{ordens_concluidas:completed.length,ticket_medio_centavos:completed.length?Math.round(completed.reduce((s,o)=>s+o.total_centavos,0)/completed.length):0,
    lucro_bruto_estimado_centavos:sum('lucro_bruto_estimado_centavos'),reposicao_centavos:sum('reposicao_centavos'),despesas_centavos:sum('despesas_centavos'),protecao_centavos:rules.protecao_pct===null?null:sum('protecao_centavos'),
    lucro_real_estimado_centavos:completed.some(o=>!o.financeiro.completo)||rules.protecao_pct===null||rules.margem_real_pct===null?null:sum('lucro_real_estimado_centavos'),materiais_sem_reposicao:sum('materiais_sem_reposicao')} };
}

export async function managementRoute(request, env, path, h) {
  const {response,fail,str,number,idOf,bodyJSON,audit} = h;
  const method=request.method;
  const rows=async(sql,...args)=>(await env.DB.prepare(sql).bind(...args).all()).results;
  const day=(value,required=true)=>{const s=str(value,10,required?10:0);if(!s&&!required)return '';if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)fail('Data inválida.');return s;};
  const order=async id=>{const o=await env.DB.prepare(`SELECT o.*,s.nome cliente_nome,q.prazo,q.garantia,q.desconto_centavos FROM tech_ordens o JOIN tech_solicitacoes s ON s.id=o.solicitacao_id JOIN tech_orcamentos q ON q.id=o.orcamento_id WHERE o.id=?`).bind(id).first();if(!o)fail('OS não encontrada.',404);return o;};
  if(path==='/admin/configuracoes') {
    if(method==='GET')return response({financeiro:await financeRules(env)});
    if(method==='PUT') {
      const b=await bodyJSON(request),rules={};
      for(const k of ['protecao_pct','margem_real_pct'])rules[k]=b[k]===null||b[k]===''?null:number(b[k],k==='margem_real_pct'?99.99:100);
      await env.DB.prepare("INSERT INTO tech_config(chave,valor) VALUES('financeiro',?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor").bind(JSON.stringify(rules)).run();
      await audit(env,'configuracoes',0,'financeiro',rules);return response({ok:true});
    }
  }
  if(path==='/admin/financeiro/previsao'&&method==='POST'){const b=await bodyJSON(request),n=h.quoteItems(b.itens,b.desconto??0);n.items=await h.linkProductCosts(env,n.items);return response(financialSummary(n.items,n.total,0,0,await financeRules(env),false));}
  if(path==='/admin/financeiro'&&method==='GET')return response(await financeReport(env));
  if(path==='/admin/agenda'&&method==='GET')return response({ordens:await rows(`SELECT o.id,o.numero,o.servico_nome,o.status,o.agendado_para,o.responsavel,s.nome cliente_nome FROM tech_ordens o JOIN tech_solicitacoes s ON s.id=o.solicitacao_id WHERE o.status NOT IN ('Concluído','Cancelado') ORDER BY o.agendado_para IS NULL,o.agendado_para`),retornos:await rows(`SELECT r.*,o.numero,e.nome equipamento_nome FROM tech_retornos r JOIN tech_garantias g ON g.id=r.garantia_id JOIN tech_ordens o ON o.id=g.ordem_id LEFT JOIN tech_equipamentos e ON e.id=g.equipamento_id WHERE r.status<>'Concluído' ORDER BY r.agendado_para IS NULL,r.agendado_para`)});
  if(path==='/admin/clientes'&&method==='GET')return response({clientes:await rows(`SELECT c.id,c.nome,c.whatsapp,COUNT(DISTINCT s.id) solicitacoes,COUNT(DISTINCT o.id) ordens FROM clientes c JOIN tech_solicitacoes s ON s.cliente_id=c.id LEFT JOIN tech_ordens o ON o.cliente_id=c.id GROUP BY c.id ORDER BY c.nome`)});
  if(path==='/admin/materiais'&&method==='GET')return response({produtos:await rows(`SELECT id,nome,categoria,estoque,preco_venda,preco_custo,custo_reposicao FROM produtos WHERE ativo=1 ORDER BY nome`)});
  if(path==='/admin/equipamentos'&&method==='GET')return response({equipamentos:await rows(`SELECT e.*,c.nome cliente_nome,o.numero,g.id garantia_id,g.fim garantia_ate FROM tech_equipamentos e JOIN clientes c ON c.id=e.cliente_id JOIN tech_ordens o ON o.id=e.ordem_id LEFT JOIN tech_garantias g ON g.equipamento_id=e.id WHERE e.ativo=1 ORDER BY e.instalado_em DESC,e.id DESC`)});
  if(path==='/admin/equipamentos'&&method==='POST') {
    const b=await bodyJSON(request),o=await order(idOf(b.ordem_id));if(!o.cliente_id||o.status==='Cancelado')fail('OS sem cliente ou cancelada.',409);
    const product=b.produto_id?idOf(b.produto_id):null;
    if(product&&!await env.DB.prepare(`SELECT id FROM tech_ordem_itens WHERE ordem_id=? AND produto_id=? AND tipo='Equipamentos'`).bind(o.id,product).first())fail('Vincule um equipamento previsto nesta OS.');
    const installed=day(b.instalado_em),until=day(b.garantia_ate,false);if(until&&until<installed)fail('Garantia termina antes da instalação.');
    const name=str(b.nome,200,2),serial=str(b.serie,150),local=str(b.local,500),notes=str(b.observacoes,2000),coverage=str(b.cobertura,2000);
    const key=crypto.randomUUID();
    const statements=[env.DB.prepare(`INSERT INTO tech_equipamentos(chave,ordem_id,cliente_id,produto_id,nome,serie,local,instalado_em,observacoes) VALUES(?,?,?,?,?,?,?,?,?)`).bind(key,o.id,o.cliente_id,product,name,serial,local,installed,notes)];
    if(until)statements.push(env.DB.prepare(`INSERT INTO tech_garantias(ordem_id,equipamento_id,inicio,fim,cobertura) SELECT ?,id,?,?,? FROM tech_equipamentos WHERE chave=?`).bind(o.id,installed,until,coverage,key));
    await env.DB.batch(statements);
    const e=await env.DB.prepare('SELECT id FROM tech_equipamentos WHERE chave=?').bind(key).first();
    await audit(env,'equipamento',e.id,'cadastrado',{ordem_id:o.id});return response({ok:true,id:e.id},201);
  }
  if(path==='/admin/garantias'&&method==='GET')return response({garantias:await rows(`SELECT g.*,o.numero,o.servico_nome,s.nome cliente_nome,e.nome equipamento_nome,CASE WHEN g.status='Cancelada' THEN 'Cancelada' WHEN g.fim<date('now') THEN 'Expirada' WHEN g.inicio>date('now') THEN 'Futura' ELSE 'Ativa' END situacao FROM tech_garantias g JOIN tech_ordens o ON o.id=g.ordem_id JOIN tech_solicitacoes s ON s.id=o.solicitacao_id LEFT JOIN tech_equipamentos e ON e.id=g.equipamento_id ORDER BY g.fim,g.id`),retornos:await rows(`SELECT r.*,o.numero FROM tech_retornos r JOIN tech_garantias g ON g.id=r.garantia_id JOIN tech_ordens o ON o.id=g.ordem_id ORDER BY r.id DESC`)});
  if(path==='/admin/garantias'&&method==='POST') {
    const b=await bodyJSON(request),o=await order(idOf(b.ordem_id));if(o.status==='Cancelado')fail('OS cancelada.',409);
    const start=day(b.inicio),end=day(b.fim);if(end<start)fail('Fim da garantia anterior ao início.');
    const equipment=b.equipamento_id?idOf(b.equipamento_id):null;
    if(equipment&&!await env.DB.prepare('SELECT id FROM tech_equipamentos WHERE id=? AND ordem_id=? AND ativo=1').bind(equipment,o.id).first())fail('Equipamento não pertence à OS.');
    if(equipment&&await env.DB.prepare('SELECT id FROM tech_garantias WHERE equipamento_id=?').bind(equipment).first())fail('Equipamento já possui garantia.',409);
    const r=await env.DB.prepare('INSERT INTO tech_garantias(ordem_id,equipamento_id,inicio,fim,cobertura) VALUES(?,?,?,?,?)').bind(o.id,equipment,start,end,str(b.cobertura,2000)).run();
    await audit(env,'garantia',r.meta.last_row_id,'cadastrada',{ordem_id:o.id});return response({ok:true,id:r.meta.last_row_id},201);
  }
  const warranty=path.match(/^\/admin\/garantias\/(\d+)(\/retornos)?$/);
  if(warranty) {
    const id=idOf(warranty[1]),g=await env.DB.prepare('SELECT * FROM tech_garantias WHERE id=?').bind(id).first();if(!g)fail('Garantia não encontrada.',404);
    if(method==='PUT'&&!warranty[2]) {
      const b=await bodyJSON(request);if(!['Ativa','Cancelada'].includes(b.status))fail('Status inválido.');
      await env.DB.prepare('UPDATE tech_garantias SET status=? WHERE id=?').bind(b.status,id).run();await audit(env,'garantia',id,'status',{status:b.status});return response({ok:true});
    }
    if(method==='POST'&&warranty[2]) {
      if(g.status==='Cancelada')fail('Garantia cancelada.',409);
      const b=await bodyJSON(request),scheduled=str(b.agendado_para,40);if(scheduled&&!Number.isFinite(Date.parse(scheduled)))fail('Agendamento inválido.');
      const r=await env.DB.prepare(`INSERT INTO tech_retornos(garantia_id,descricao,responsavel,agendado_para) VALUES(?,?,?,?)`).bind(id,str(b.descricao,2000,5),str(b.responsavel,120),scheduled||null).run();
      await audit(env,'retorno',r.meta.last_row_id,'aberto',{garantia_id:id,fora_prazo:g.fim<new Date().toISOString().slice(0,10)});return response({ok:true,id:r.meta.last_row_id},201);
    }
  }
  const returnRoute=path.match(/^\/admin\/retornos\/(\d+)$/);
  if(returnRoute&&method==='PUT') {
    const id=idOf(returnRoute[1]),b=await bodyJSON(request);if(!['Aberto','Agendado','Em execução','Concluído'].includes(b.status))fail('Status inválido.');
    const scheduled=str(b.agendado_para,40);if(scheduled&&!Number.isFinite(Date.parse(scheduled)))fail('Agendamento inválido.');const solution=str(b.solucao,3000,b.status==='Concluído'?5:0);
    const r=await env.DB.prepare(`UPDATE tech_retornos SET status=?,responsavel=?,agendado_para=?,solucao=?,concluido_em=CASE WHEN ?='Concluído' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=? AND status<>'Concluído'`).bind(b.status,str(b.responsavel,120),scheduled||null,solution,b.status,id).run();if(!r.meta.changes)fail('Retorno inexistente ou encerrado.',409);
    await audit(env,'retorno',id,'atualizado',{status:b.status});return response({ok:true});
  }
  const model=path.match(/^\/admin\/termo-modelos(?:\/(\d+))?$/);
  if(model) {
    if(method==='GET'&&!model[1])return response({modelos:await rows('SELECT * FROM tech_termo_modelos ORDER BY id')});
    if(['POST','PUT'].includes(method)&&Boolean(model[1])===(method==='PUT')) {
      const b=await bodyJSON(request),vals=[str(b.nome,150,2),str(b.prestador,2000,3),str(b.pagamento,2000),str(b.limitacoes,3000),str(b.responsabilidades,3000),str(b.condicoes,5000),b.ativo===false?0:1];
      const r=model[1]?await env.DB.prepare('UPDATE tech_termo_modelos SET nome=?,prestador=?,pagamento=?,limitacoes=?,responsabilidades=?,condicoes=?,ativo=?,versao=versao+1 WHERE id=? AND versao=?').bind(...vals,idOf(model[1]),idOf(b.versao)).run():await env.DB.prepare('INSERT INTO tech_termo_modelos(nome,prestador,pagamento,limitacoes,responsabilidades,condicoes,ativo) VALUES(?,?,?,?,?,?,?)').bind(...vals).run();
      if(!r.meta.changes)fail('Modelo alterado por outro acesso. Atualize.',409);const id=model[1]?Number(model[1]):r.meta.last_row_id;await audit(env,'termo_modelo',id,'salvo',{});return response({ok:true,id});
    }
  }
  const term=path.match(/^\/admin\/ordens\/(\d+)\/termos$/);
  if(term) {
    const id=idOf(term[1]),o=await order(id);
    if(method==='GET')return response({termos:(await rows('SELECT id,versao,documento_json,criado_em FROM tech_termos WHERE ordem_id=? ORDER BY versao DESC',id)).map(t=>({...t,documento:JSON.parse(t.documento_json),documento_json:undefined}))});
    if(method==='POST') {
      const b=await bodyJSON(request),m=await env.DB.prepare('SELECT * FROM tech_termo_modelos WHERE id=? AND ativo=1').bind(idOf(b.modelo_id)).first();if(!m)fail('Modelo ativo não encontrado.',404);
      const document={numero:o.numero,cliente:o.cliente_nome,telefone:o.telefone,endereco:o.endereco,servico:o.servico_nome,descricao:o.descricao,desconto_centavos:o.desconto_centavos,total_centavos:o.total_centavos,prazo:o.prazo,garantia:o.garantia,agendado_para:o.agendado_para,
        pagamentos:await rows('SELECT valor_centavos,metodo FROM tech_pagamentos WHERE ordem_id=?',id),itens:await rows('SELECT tipo,nome,quantidade,preco_centavos,subtotal_centavos FROM tech_ordem_itens WHERE ordem_id=?',id),modelo:{nome:m.nome,versao:m.versao,prestador:m.prestador,pagamento:m.pagamento,limitacoes:m.limitacoes,responsabilidades:m.responsabilidades,condicoes:m.condicoes}};
      const r=await env.DB.prepare('INSERT INTO tech_termos(ordem_id,modelo_id,versao,documento_json) SELECT ?,?,COALESCE(MAX(versao),0)+1,? FROM tech_termos WHERE ordem_id=?').bind(id,m.id,JSON.stringify(document),id).run();await audit(env,'termo',r.meta.last_row_id,'gerado',{ordem_id:id,modelo_id:m.id});return response({ok:true,id:r.meta.last_row_id},201);
    }
  }
  return null;
}
