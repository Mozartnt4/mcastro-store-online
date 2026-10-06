import { ensureTechSchema } from './tech-schema.js';
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' } });
class InputError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const fail = (message, status) => { throw new InputError(message, status); };
function str(value, max = 2000, min = 0) {
  if (value !== undefined && value !== null && typeof value !== 'string') fail('Texto inválido.');
  const s = (value || '').trim();
  if (s.length < min || s.length > max) fail(`Preencha o texto com ${min} a ${max} caracteres.`);
  return s;
}
function number(value, max = 100000000, min = 0, whole = false) {
  if (!['number', 'string'].includes(typeof value) || value === '' || !Number.isFinite(Number(value))) fail('Valor numérico inválido.');
  const n = Number(value);
  if (n < min || n > max || (whole && !Number.isInteger(n))) fail('Valor fora do limite permitido.');
  return n;
}
const idOf = v => number(v, Number.MAX_SAFE_INTEGER, 1, true);
const cents = v => Math.round(number(v) * 100);
const parse = s => JSON.parse(s || '[]');
export const quoteCode = id => `MC-ORC-${String(id).padStart(6, '0')}`;
const token = () => crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
const codePattern = /^[a-f0-9]{64}$/;
const codeOf = row => ({ ...row, numero: quoteCode(row.solicitacao_id || row.id) });
function fields(value) {
  if (!Array.isArray(value) || value.length > 20) fail('Use até 20 perguntas personalizadas.');
  const seen = new Set();
  return value.map(f => {
    const key = str(f.key, 40, 1);
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key) || seen.has(key)) fail('Identificador de pergunta inválido ou repetido.');
    seen.add(key);
    if (!['texto', 'numero', 'selecao'].includes(f.type)) fail('Tipo de pergunta inválido.');
    const options = f.type === 'selecao' ? (Array.isArray(f.options) ? [...new Set(f.options.map(v => str(v, 100, 1)))] : []) : [];
    if (f.type === 'selecao' && (!options.length || options.length > 20)) fail('Informe entre 1 e 20 opções.');
    return { key, label: str(f.label, 150, 1), type: f.type, required: f.required === true, options };
  });
}
function mergedFields(category, service) {
  return [...new Map([...parse(category), ...parse(service)].map(f => [f.key, f])).values()];
}
function answers(input, specs) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Respostas inválidas.');
  if (Object.keys(input).some(k => !specs.some(f => f.key === k))) fail('Pergunta não pertence a este serviço.');
  return specs.map(f => {
    const val = input[f.key];
    if (val === undefined || val === '') { if (f.required) fail(`Responda: ${f.label}`); return { ...f, value: '' }; }
    const value = f.type === 'numero' ? number(val, 1000000) : str(val, 1000, f.required ? 1 : 0);
    if (f.type === 'selecao' && !f.options.includes(value)) fail(`Opção inválida: ${f.label}`);
    return { key: f.key, label: f.label, value };
  });
}
export function quoteItems(input, discount = 0) {
  if (!Array.isArray(input) || !input.length || input.length > 100) fail('Informe entre 1 e 100 itens.');
  const items = input.map(i => {
    if (!['Equipamentos', 'Materiais', 'Mão de obra', 'Deslocamento'].includes(i.tipo)) fail('Tipo de item inválido.');
    const quantidade = number(i.quantidade, 9999, 0.001);
    if (Math.abs(quantidade * 1000 - Math.round(quantidade * 1000)) > 0.00001) fail('Use até três casas decimais na quantidade.');
    const preco_centavos = cents(i.preco);
    const produto_id=i.produto_id?idOf(i.produto_id):null;if(produto_id&&quantidade!==Math.floor(quantidade))fail('Produtos vinculados ao estoque usam quantidades inteiras.');
    return { tipo: i.tipo, nome: str(i.nome, 200, 1), quantidade, produto_id, preco_centavos, custo_centavos: cents(i.custo ?? 0), reposicao_centavos: cents(i.reposicao ?? 0), subtotal_centavos: Math.round(quantidade * preco_centavos) };
  });
  const subtotal = items.reduce((s, i) => s + i.subtotal_centavos, 0), desconto = cents(discount);
  if (subtotal > 10000000000 || desconto > subtotal) fail('Total ou desconto inválido.');
  return { items, desconto, total: subtotal - desconto };
}
export function publicQuote(row) {
  return { numero: quoteCode(row.solicitacao_id), servico: row.servico_nome, itens: parse(row.itens_json).map(i => ({ tipo: i.tipo, nome: i.nome, quantidade: i.quantidade, preco_centavos: i.preco_centavos, subtotal_centavos: i.subtotal_centavos })), desconto_centavos: row.desconto_centavos, total_centavos: row.total_centavos, validade: row.validade, prazo: row.prazo, garantia: row.garantia, observacoes: row.observacoes, status: effectiveStatus(row), versao: row.versao, decidido_em: row.decidido_em };
}
async function linkProductCosts(env,items){
  const ids=[...new Set(items.map(i=>i.produto_id).filter(Boolean))];if(!ids.length)return items;
  const rows=await env.DB.prepare(`SELECT id,preco_custo,custo_reposicao FROM produtos WHERE ativo=1 AND id IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all();
  if(rows.results.length!==ids.length)fail('Produto vinculado não encontrado ou inativo.');const byId=new Map(rows.results.map(p=>[Number(p.id),p]));
  return items.map(i=>{const p=i.produto_id?byId.get(i.produto_id):null;return p?{...i,custo_centavos:cents(p.preco_custo),reposicao_centavos:cents(p.custo_reposicao)}:i;});
}
function effectiveStatus(q) { return q.status === 'Aguardando aprovação' && new Date(q.validade).getTime() <= Date.now() ? 'Expirado' : q.status; }
async function limitedBody(request, limit) {
  if (Number(request.headers.get('content-length')) > limit) fail('Envio muito grande.', 413);
  const reader = request.body?.getReader();
  if (!reader) fail('Envio vazio.');
  const chunks = []; let size = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); fail('Envio muito grande.', 413); } chunks.push(value); }
  return new Blob(chunks);
}
async function bodyJSON(request) {
  const blob = await limitedBody(request, 100000);
  try { const b = JSON.parse(await blob.text()); if (!b || typeof b !== 'object' || Array.isArray(b)) fail('Dados inválidos.'); return b; } catch { fail('JSON inválido.'); }
}
async function rateLimit(request, env) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(request.headers.get('cf-connecting-ip') || 'local'));
  const key = Array.from(new Uint8Array(digest), v => v.toString(16).padStart(2, '0')).join('');
  const window = Math.floor(Date.now() / 600000);
  const result = await env.DB.prepare(`INSERT INTO tech_limites(chave,janela,quantidade) VALUES(?,?,1) ON CONFLICT(chave) DO UPDATE SET janela=excluded.janela,quantidade=CASE WHEN tech_limites.janela=excluded.janela THEN tech_limites.quantidade+1 ELSE 1 END RETURNING quantidade`).bind(key, window).first();
  if (result.quantidade > 8) fail('Muitos envios. Aguarde 10 minutos para tentar novamente.', 429);
  await env.DB.prepare('DELETE FROM tech_limites WHERE janela<?').bind(window - 144).run();
}
export async function validatePhoto(file) {
  if (!(file instanceof Blob) || !file.size || file.size > 3 * 1024 * 1024) fail('Cada foto deve ter até 3 MB.');
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const detected = b[0] === 255 && b[1] === 216 && b[2] === 255 ? 'image/jpeg' : b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71 && b[4] === 13 && b[5] === 10 && b[6] === 26 && b[7] === 10 ? 'image/png' : String.fromCharCode(...b.slice(0,4)) === 'RIFF' && String.fromCharCode(...b.slice(8,12)) === 'WEBP' ? 'image/webp' : '';
  if (!detected || file.type !== detected) fail('Use fotos JPEG, PNG ou WebP válidas.');
  return detected;
}
async function uploadPhoto(file, settings) {
  const data = new FormData(); data.append('file', file, 'tech-foto'); data.append('upload_preset', settings.cloudinaryUploadPreset);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(settings.cloudinaryCloudName)}/image/upload`, { method: 'POST', body: data, signal: AbortSignal.timeout(30000) });
  const uploaded = await res.json();
  if (!res.ok || !uploaded.secure_url) fail('Não foi possível enviar a foto. Tente novamente.', 502);
  const url = new URL(uploaded.secure_url);
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || !url.pathname.startsWith(`/${settings.cloudinaryCloudName}/`)) fail('Resposta de imagem inválida.', 502);
  return { url: url.href, public_id: uploaded.public_id || '' };
}
async function requestQuote(request, env, settings) {
  await rateLimit(request, env);
  const blob = await limitedBody(request, 19 * 1024 * 1024);
  let form, b;
  try { form = await new Response(blob, { headers: { 'content-type': request.headers.get('content-type') || '' } }).formData(); b = JSON.parse(form.get('dados')); } catch { fail('Formulário inválido.'); }
  if (!b || typeof b !== 'object') fail('Formulário inválido.');
  const key = str(b.chave_envio, 64, 64); if (!codePattern.test(key)) fail('Identificador de envio inválido.');
  const existing = await env.DB.prepare('SELECT id FROM tech_solicitacoes WHERE chave_envio=?').bind(key).first();
  if (existing) return response({ ok: true, numero: quoteCode(existing.id) });
  const service = await env.DB.prepare(`SELECT s.*,c.campos_json categoria_campos FROM tech_servicos s JOIN tech_categorias c ON c.id=s.categoria_id WHERE s.id=? AND s.ativo=1 AND s.excluido=0 AND c.ativo=1 AND c.excluido=0`).bind(idOf(b.servico_id)).first();
  if (!service) fail('Serviço indisponível.', 404);
  const name = str(b.nome, 120, 3), phone = str(b.telefone, 30, 10).replace(/\D/g, '');
  if (phone.length < 10 || phone.length > 15) fail('Informe um WhatsApp válido.');
  const address = str(b.endereco, 500, 3), location=str(b.localizacao,500), description = str(b.descricao, 3000, 5), qty = number(b.quantidade, 9999, 1, true);
  const priority=str(b.prioridade||'Normal',30,3);if(!['Baixa','Normal','Alta','Urgente'].includes(priority))fail('Prioridade inválida.');
  const desired=str(b.data_desejada,40);if(desired&&!Number.isFinite(new Date(desired).getTime()))fail('Data desejada inválida.');
  const preference = str(b.preferencia, 200), notes = str(b.observacoes, 2000);
  const reply = answers(b.respostas || {}, mergedFields(service.categoria_campos, service.campos_json));
  const files = form.getAll('fotos').filter(f => f instanceof Blob && f.size);
  if (files.length > 6) fail('Envie no máximo 6 fotos.');
  for (const file of files) await validatePhoto(file);
  const photos = [];
  for (const file of files) photos.push(await uploadPhoto(file, settings));
  // Reutiliza cliente por telefone sem sobrescrever cadastro anterior. Batch evita gravações parciais.
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO clientes(nome,whatsapp,endereco) SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM clientes WHERE whatsapp=?)`).bind(name, phone, address, phone),
    env.DB.prepare(`INSERT OR IGNORE INTO tech_solicitacoes(chave_envio,cliente_id,servico_id,servico_nome,nome,telefone,endereco,localizacao,descricao,quantidade,prioridade,data_desejada,preferencia,observacoes,respostas_json,fotos_json) VALUES(?,(SELECT id FROM clientes WHERE whatsapp=? ORDER BY id DESC LIMIT 1),?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(key, phone, service.id, service.nome, name, phone, address, location, description, qty, priority, desired||null, preference, notes, JSON.stringify(reply), JSON.stringify(photos))
  ]);
  const row = await env.DB.prepare('SELECT id FROM tech_solicitacoes WHERE chave_envio=?').bind(key).first();
  return response({ ok: true, numero: quoteCode(row.id) }, 201);
}
async function catalog(env, admin, settings) {
  const categories = await env.DB.prepare(`SELECT * FROM tech_categorias WHERE excluido=0 ${admin ? '' : 'AND ativo=1'} ORDER BY nome`).all();
  const services = await env.DB.prepare(`SELECT s.*,c.campos_json categoria_campos FROM tech_servicos s JOIN tech_categorias c ON c.id=s.categoria_id WHERE s.excluido=0 ${admin ? '' : 'AND s.ativo=1 AND c.ativo=1 AND c.excluido=0'} ORDER BY s.nome`).all();
  return { categorias: categories.results.map(c => ({ ...c, campos: parse(c.campos_json), campos_json: undefined })), servicos: services.results.map(s => ({ ...s, campos: parse(s.campos_json), perguntas: mergedFields(s.categoria_campos, s.campos_json), campos_json: undefined, categoria_campos: undefined })), whatsapp: settings.whatsapp };
}
async function saveCatalog(request, env, type, id) {
  const table = type === 'categorias' ? 'tech_categorias' : 'tech_servicos';
  if (id && !await env.DB.prepare(`SELECT id FROM ${table} WHERE id=? AND excluido=0`).bind(id).first()) fail('Cadastro não encontrado.', 404);
  if (request.method === 'DELETE') {
    if (type === 'categorias' && await env.DB.prepare('SELECT id FROM tech_servicos WHERE categoria_id=? AND excluido=0 LIMIT 1').bind(id).first()) fail('Exclua ou transfira os serviços desta categoria primeiro.', 409);
    await env.DB.prepare(`UPDATE ${table} SET excluido=1,ativo=0 WHERE id=?`).bind(id).run(); return response({ ok: true });
  }
  const b = await bodyJSON(request);
  const values = { nome: str(b.nome, 150, 2), descricao: str(b.descricao, 3000), campos_json: JSON.stringify(fields(b.campos || [])), ativo: b.ativo === false ? 0 : 1 };
  if (type === 'servicos') {
    const category = idOf(b.categoria_id);
    if (!await env.DB.prepare('SELECT id FROM tech_categorias WHERE id=? AND excluido=0').bind(category).first()) fail('Categoria inválida.');
    if (!['orcamento', 'fixo', 'apartir'].includes(b.tipo_preco)) fail('Tipo de preço inválido.');
    let image = str(b.imagem_url, 2000);
    if (image) { try { const u = new URL(image); if (u.protocol !== 'https:') fail('A imagem deve usar HTTPS.'); image = u.href; } catch { fail('URL de imagem inválida.'); } }
    Object.assign(values, { categoria_id: category, imagem_url: image, tipo_preco: b.tipo_preco, preco_centavos: b.tipo_preco === 'orcamento' ? 0 : cents(b.preco), tempo: str(b.tempo, 300), materiais: str(b.materiais, 2000), garantia: str(b.garantia, 2000), observacoes: str(b.observacoes, 2000) });
  }
  const keys = Object.keys(values);
  const statement = id ? env.DB.prepare(`UPDATE ${table} SET ${keys.map(k => k + '=?').join(',')} WHERE id=?`).bind(...Object.values(values), id) : env.DB.prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`).bind(...Object.values(values));
  const result = await statement.run(); return response({ ok: true, id: id || result.meta.last_row_id });
}
async function saveQuote(request, env, requestId) {
  const b = await bodyJSON(request), order = await env.DB.prepare('SELECT id FROM tech_solicitacoes WHERE id=?').bind(requestId).first();
  if (!order) fail('Solicitação não encontrada.', 404);
  const normalized = quoteItems(b.itens, b.desconto ?? 0);
  normalized.items=await linkProductCosts(env,normalized.items);
  const validity = new Date(str(b.validade, 40, 10));
  if (!Number.isFinite(validity.getTime()) || validity.getTime() <= Date.now()) fail('Informe uma validade futura.');
  const values = [JSON.stringify(normalized.items), normalized.desconto, normalized.total, validity.toISOString(), str(b.prazo, 500, 1), str(b.garantia, 2000), str(b.observacoes, 3000)];
  const existing = await env.DB.prepare('SELECT * FROM tech_orcamentos WHERE solicitacao_id=?').bind(requestId).first();
  if (existing) {
    const result = await env.DB.prepare(`UPDATE tech_orcamentos SET itens_json=?,desconto_centavos=?,total_centavos=?,validade=?,prazo=?,garantia=?,observacoes=?,versao=versao+1 WHERE solicitacao_id=? AND status='Orçamento preparado' AND versao=?`).bind(...values, requestId, number(b.versao, 1000000, 1, true)).run();
    if (!result.meta.changes) fail('Orçamento alterado ou já enviado. Atualize a página.', 409);
  } else {
    const result = await env.DB.prepare(`INSERT OR IGNORE INTO tech_orcamentos(itens_json,desconto_centavos,total_centavos,validade,prazo,garantia,observacoes,solicitacao_id,token) VALUES(?,?,?,?,?,?,?,?,?)`).bind(...values, requestId, token()).run();
    if (!result.meta.changes) fail('Outro administrador já criou o orçamento. Atualize.', 409);
  }
  await audit(env,'orcamento',requestId,existing?'alterado':'criado',{anterior:existing?{itens_json:existing.itens_json,total_centavos:existing.total_centavos,versao:existing.versao}:null,novo:{itens_json:JSON.stringify(normalized.items),total_centavos:normalized.total,versao:existing?existing.versao+1:1}});
  return response({ ok: true });
}
const ORDER_STATES = ['Aguardando agendamento','Agendado','Em deslocamento','Em execução','Aguardando material','Pausado','Concluído','Cancelado'];
async function audit(env, entity, id, event, data = {}) {
  await env.DB.prepare('INSERT INTO tech_auditoria(entidade,entidade_id,evento,dados_json) VALUES(?,?,?,?)').bind(entity,id,event,JSON.stringify(data)).run();
}
async function createOrderFromApproval(env, row, approvedAt) {
  const items = parse(row.itens_json), orderNo = `MC-OS-${String(row.solicitacao_id).padStart(6, '0')}`, publicToken=token();
  const statements = [
    env.DB.prepare(`UPDATE tech_orcamentos SET status='Aprovado',decidido_em=?,versao=versao+1 WHERE id=? AND status='Aguardando aprovação' AND validade>? AND versao=?`).bind(approvedAt,row.id,approvedAt,row.versao),
    env.DB.prepare(`UPDATE tech_solicitacoes SET status='Orçamento aprovado' WHERE id=? AND EXISTS(SELECT 1 FROM tech_orcamentos WHERE id=? AND status='Aprovado' AND decidido_em=?)`).bind(row.solicitacao_id,row.id,approvedAt),
    env.DB.prepare(`INSERT INTO tech_ordens(numero,token_publico,solicitacao_id,orcamento_id,cliente_id,endereco,telefone,servico_nome,descricao,itens_json,total_centavos) SELECT ?,?,s.id,q.id,s.cliente_id,s.endereco,s.telefone,s.servico_nome,s.descricao,q.itens_json,q.total_centavos FROM tech_solicitacoes s JOIN tech_orcamentos q ON q.solicitacao_id=s.id WHERE q.id=? AND q.status='Aprovado' AND q.decidido_em=?`).bind(orderNo,publicToken,row.id,approvedAt)
  ];
  for (const i of items) statements.push(env.DB.prepare(`INSERT INTO tech_ordem_itens(ordem_id,tipo,nome,produto_id,quantidade,custo_centavos,reposicao_centavos,preco_centavos,subtotal_centavos) SELECT id,?,?,?,?,?,?,?,? FROM tech_ordens WHERE orcamento_id=?`).bind(i.tipo,i.nome,i.produto_id,i.quantidade,i.custo_centavos,i.reposicao_centavos,i.preco_centavos,i.subtotal_centavos,row.id));
  statements.push(env.DB.prepare(`INSERT INTO tech_historico(ordem_id,tipo,descricao,dados_json) SELECT id,'Aprovação','Orçamento aprovado e ordem criada',? FROM tech_ordens WHERE orcamento_id=?`).bind(JSON.stringify({numero:orderNo,total_centavos:row.total_centavos}),row.id));
  statements.push(env.DB.prepare(`INSERT INTO tech_auditoria(entidade,entidade_id,evento,dados_json) SELECT 'orcamento',id,'aprovado',? FROM tech_orcamentos WHERE id=? AND status='Aprovado' AND decidido_em=?`).bind(JSON.stringify({ordem:orderNo,total_centavos:row.total_centavos}),row.id,approvedAt));
  const results = await env.DB.batch(statements);
  if (!results[0].meta.changes) fail('Este orçamento já recebeu uma decisão, foi alterado ou expirou. Atualize a página.',409);
}
async function orderDetail(env,id) {
  const order=await env.DB.prepare(`SELECT o.*,s.nome cliente_nome,s.respostas_json,q.prazo,q.garantia,q.decidido_em aceite_em FROM tech_ordens o LEFT JOIN tech_solicitacoes s ON s.id=o.solicitacao_id LEFT JOIN tech_orcamentos q ON q.id=o.orcamento_id WHERE o.id=?`).bind(id).first();
  if(!order)fail('Ordem de serviço não encontrada.',404);
  const [items,photos,history,payments,expenses,addons]=await Promise.all([
    env.DB.prepare('SELECT i.*,p.nome produto_nome,p.estoque FROM tech_ordem_itens i LEFT JOIN produtos p ON p.id=i.produto_id WHERE i.ordem_id=? ORDER BY i.id').bind(id).all(),
    env.DB.prepare('SELECT * FROM tech_fotos WHERE ordem_id=? ORDER BY criado_em,id').bind(id).all(),
    env.DB.prepare('SELECT * FROM tech_historico WHERE ordem_id=? ORDER BY criado_em DESC,id DESC').bind(id).all(),
    env.DB.prepare('SELECT id,valor_centavos,metodo,observacoes,criado_em FROM tech_pagamentos WHERE ordem_id=? ORDER BY criado_em DESC').bind(id).all(),
    env.DB.prepare('SELECT id,categoria,descricao,valor_centavos,criado_em FROM tech_despesas WHERE ordem_id=? ORDER BY criado_em DESC').bind(id).all(),
    env.DB.prepare('SELECT id,total_centavos,motivo,status,token,versao,criado_em,decidido_em FROM tech_aditivos WHERE ordem_id=? ORDER BY criado_em DESC').bind(id).all()
  ]);
  const {respostas_json,token_publico,...safe}=order;
  return {ordem:{...safe,public_link:'/tech/acompanhar/'+token_publico},itens:items.results,fotos:photos.results,historico:history.results,pagamentos:payments.results,despesas:expenses.results,aditivos:addons.results.map(a=>({...a,link:'/tech/aditivo/'+a.token}))};
}
async function dashboard(env) {
  const [counts,money,top,pending]=await Promise.all([
    env.DB.prepare(`SELECT SUM(CASE WHEN status NOT IN ('Concluído','Cancelado') THEN 1 ELSE 0 END) abertas,SUM(CASE WHEN status='Aguardando agendamento' THEN 1 ELSE 0 END) aguardando,SUM(CASE WHEN status='Agendado' THEN 1 ELSE 0 END) agendados,SUM(CASE WHEN status='Em execução' THEN 1 ELSE 0 END) execucao,SUM(CASE WHEN status='Concluído' THEN 1 ELSE 0 END) concluidos,(SELECT COUNT(*) FROM tech_solicitacoes WHERE status IN ('Novo','Em análise','Aguardando informações')) solicitacoes_abertas,(SELECT COUNT(*) FROM tech_orcamentos WHERE status='Aprovado') orcamentos_aprovados FROM tech_ordens`).first(),
    env.DB.prepare(`SELECT COALESCE(SUM(total_centavos),0) contratado,COALESCE(SUM(pago_centavos),0) recebido,COALESCE(SUM(total_centavos-pago_centavos),0) a_receber FROM tech_ordens WHERE status<>'Cancelado'`).first(),
    env.DB.prepare(`SELECT servico_nome nome,COUNT(*) quantidade FROM tech_ordens GROUP BY servico_nome ORDER BY quantidade DESC LIMIT 8`).all(),
    env.DB.prepare(`SELECT c.id,c.nome,c.whatsapp,COUNT(o.id) ordens,COALESCE(SUM(o.total_centavos-o.pago_centavos),0) pendente FROM clientes c JOIN tech_ordens o ON o.cliente_id=c.id WHERE o.total_centavos>o.pago_centavos AND o.status<>'Cancelado' GROUP BY c.id ORDER BY pendente DESC LIMIT 10`).all()
  ]);
  // Separate aggregates avoid a payments × expenses cross product.
  const totals=await env.DB.prepare(`SELECT (SELECT COALESCE(SUM(valor_centavos),0) FROM tech_pagamentos) recebido,(SELECT COALESCE(SUM(valor_centavos),0) FROM tech_despesas) despesas,(SELECT COALESCE(SUM(i.quantidade_utilizada*i.custo_centavos),0) FROM tech_ordem_itens i JOIN tech_ordens o ON o.id=i.ordem_id WHERE o.status='Concluído') custo_historico,(SELECT COALESCE(SUM(i.quantidade_utilizada*i.reposicao_centavos),0) FROM tech_ordem_itens i JOIN tech_ordens o ON o.id=i.ordem_id WHERE o.status='Concluído') reserva_reposicao,(SELECT COUNT(*) FROM tech_orcamentos WHERE status='Aguardando aprovação' AND validade>datetime('now')) orcamentos_pendentes,(SELECT COALESCE(SUM(i.quantidade_utilizada),0) FROM tech_ordem_itens i JOIN tech_ordens o ON o.id=i.ordem_id WHERE o.status='Concluído' AND i.produto_id IS NOT NULL) materiais_utilizados,(SELECT COUNT(*) FROM tech_ordem_itens i JOIN tech_ordens o ON o.id=i.ordem_id WHERE o.status='Concluído' AND i.produto_id IS NOT NULL AND i.quantidade_utilizada>0 AND i.reposicao_centavos=0) materiais_sem_reposicao`).first();
  const received=Number(totals.recebido||0), expenses=Number(totals.despesas||0), reserve=Number(totals.reserva_reposicao||0);
  const nominal=received-expenses-Number(totals.custo_historico||0),available=received-expenses-reserve;
  return {indicadores:{...counts,...money,orcamentos_pendentes:Number(totals.orcamentos_pendentes),receita_servicos:received/100,despesas_centavos:expenses,custo_historico_centavos:totals.custo_historico,reserva_reposicao_centavos:totals.reserva_reposicao,resultado_disponivel_centavos:available,materiais_utilizados:totals.materiais_utilizados,materiais_sem_reposicao:totals.materiais_sem_reposicao,lucro_nominal_centavos:nominal,margem_nominal_pct:received?Math.round(nominal/received*10000)/100:0,margem_disponivel_pct:received?Math.round(available/received*10000)/100:0},servicos_mais_vendidos:top.results,clientes_pendentes:pending.results};
}
async function techRoute(request, env, url, helpers) {
  await ensureTechSchema(env);
  const path = url.pathname.slice('/api/tech'.length), method = request.method;
  const settings = await helpers.settingsObject(env);
  if (path === '/catalogo' && method === 'GET') return response(await catalog(env, false, settings));
  if (method !== 'GET' && request.headers.get('origin') && request.headers.get('origin') !== url.origin) fail('Origem inválida.', 403);
  if (path === '/solicitacoes' && method === 'POST') return requestQuote(request, env, settings);
  const publicMatch = path.match(/^\/orcamentos\/([a-f0-9]{64})(\/decisao)?$/);
  if (publicMatch) {
    const row = await env.DB.prepare(`SELECT q.*,s.servico_nome FROM tech_orcamentos q JOIN tech_solicitacoes s ON s.id=q.solicitacao_id WHERE q.token=? AND q.enviado_em IS NOT NULL`).bind(publicMatch[1]).first();
    if (!row) fail('Orçamento não encontrado.', 404);
    if (method === 'GET' && !publicMatch[2]) return response({ ...publicQuote(row), whatsapp: settings.whatsapp });
    if (method === 'POST' && publicMatch[2]) {
      const b = await bodyJSON(request);
      if (!['Aprovado', 'Recusado'].includes(b.decisao)) fail('Decisão inválida.');
      if (b.decisao === 'Aprovado') await createOrderFromApproval(env,row,new Date().toISOString());
      else {
        const at=new Date().toISOString();
        const result = await env.DB.prepare(`UPDATE tech_orcamentos SET status='Recusado',decidido_em=?,versao=versao+1 WHERE id=? AND status='Aguardando aprovação' AND validade>? AND versao=?`).bind(at,row.id,at,number(b.versao, 1000000, 1, true)).run();
        if (!result.meta.changes) fail('Este orçamento já recebeu uma decisão, foi alterado ou expirou. Atualize a página.', 409);
        await env.DB.prepare(`UPDATE tech_solicitacoes SET status='Orçamento recusado' WHERE id=?`).bind(row.solicitacao_id).run();
        await audit(env,'orcamento',row.id,'recusado',{em:at});
      }
      return response({ ok: true });
    }
    fail('Rota não encontrada.', 404);
  }
  const tracking=path.match(/^\/acompanhar\/([a-f0-9]{64})$/);
  if(tracking&&method==='GET'){
    const order=await env.DB.prepare('SELECT numero,status,servico_nome,agendado_para,criado_em,atualizado_em,concluido_em,total_centavos,pago_centavos FROM tech_ordens WHERE token_publico=?').bind(tracking[1]).first();if(!order)fail('Acompanhamento não encontrado.',404);
    const [photos,history,items]=await Promise.all([env.DB.prepare('SELECT etapa,url,criado_em FROM tech_fotos WHERE ordem_id=(SELECT id FROM tech_ordens WHERE token_publico=?) ORDER BY criado_em').bind(tracking[1]).all(),env.DB.prepare(`SELECT tipo,descricao,criado_em FROM tech_historico WHERE ordem_id=(SELECT id FROM tech_ordens WHERE token_publico=?) AND tipo IN ('Status','Agendamento','Aprovação') ORDER BY criado_em`).bind(tracking[1]).all(),env.DB.prepare('SELECT nome,quantidade,preco_centavos,subtotal_centavos FROM tech_ordem_itens WHERE ordem_id=(SELECT id FROM tech_ordens WHERE token_publico=?) ORDER BY id').bind(tracking[1]).all()]);
    return response({ordem:order,fotos:photos.results,historico:history.results,itens:items.results});
  }
  if (!path.startsWith('/admin/') && !path.startsWith('/aditivos/')) fail('Rota não encontrada.', 404);
  if (path.startsWith('/admin/') && !await helpers.adminAllowed(request, env)) fail('Entre com a senha administrativa.', 401);
  if (path === '/admin/catalogo' && method === 'GET') return response(await catalog(env, true, settings));
  const customerHistory=path.match(/^\/admin\/clientes\/(\d+)\/historico$/);
  if(customerHistory&&method==='GET'){
    const id=idOf(customerHistory[1]),customer=await env.DB.prepare('SELECT id,nome,whatsapp,email,endereco,cidade,estado FROM clientes WHERE id=?').bind(id).first();if(!customer)fail('Cliente não encontrado.',404);
    const [sales,requests,orders]=await Promise.all([env.DB.prepare(`SELECT id,codigo,status,total,criado_em FROM pedidos WHERE cliente_id=? ORDER BY id DESC LIMIT 100`).bind(id).all(),env.DB.prepare(`SELECT id,servico_nome,status,criado_em FROM tech_solicitacoes WHERE cliente_id=? ORDER BY id DESC LIMIT 100`).bind(id).all(),env.DB.prepare(`SELECT id,numero,status,total_centavos,pago_centavos,criado_em FROM tech_ordens WHERE cliente_id=? ORDER BY id DESC LIMIT 100`).bind(id).all()]);return response({cliente:customer,compras:sales.results,solicitacoes:requests.results,ordens:orders.results});
  }
  if (path === '/admin/dashboard' && method === 'GET') return response(await dashboard(env));
  if (path === '/admin/ordens' && method === 'GET') {
    const rows=await env.DB.prepare(`SELECT id,numero,cliente_id,status,responsavel,endereco,telefone,servico_nome,total_centavos,pago_centavos,agendado_para,criado_em FROM tech_ordens ORDER BY CASE status WHEN 'Concluído' THEN 2 WHEN 'Cancelado' THEN 3 ELSE 1 END,COALESCE(agendado_para,criado_em) DESC LIMIT 250`).all();
    return response({ordens:rows.results});
  }
  const orderRoute=path.match(/^\/admin\/ordens\/(\d+)(?:\/(status|agendamento|itens|fotos|pagamentos|despesas|aditivos))?$/);
  if(orderRoute){
    const id=idOf(orderRoute[1]), action=orderRoute[2];
    if(method==='GET'&&!action)return response(await orderDetail(env,id));
    if(method==='PUT'&&action==='status'){
      const b=await bodyJSON(request), order=await env.DB.prepare('SELECT status FROM tech_ordens WHERE id=?').bind(id).first();if(!order)fail('Ordem de serviço não encontrada.',404);
      if(!ORDER_STATES.includes(b.status))fail('Status inválido.');if(order.status==='Concluído'||order.status==='Cancelado')fail('Uma ordem encerrada não pode ser reaberta. Crie um aditivo ou uma nova solicitação.',409);
      const at=new Date().toISOString(),result=await env.DB.batch([env.DB.prepare(`UPDATE tech_ordens SET status=?,atualizado_em=?,inicio_em=CASE WHEN ?='Em execução' AND inicio_em IS NULL THEN ? ELSE inicio_em END,concluido_em=CASE WHEN ?='Concluído' THEN ? ELSE concluido_em END WHERE id=? AND status=?`).bind(b.status,at,b.status,at,b.status,at,id,order.status),env.DB.prepare(`INSERT INTO tech_historico(ordem_id,tipo,descricao,dados_json) SELECT ?, 'Status',?,? WHERE EXISTS(SELECT 1 FROM tech_ordens WHERE id=? AND status=?)`).bind(id,`Status: ${order.status} → ${b.status}`,JSON.stringify({anterior:order.status,novo:b.status}),id,b.status)]);if(!result[0].meta.changes)fail('A ordem foi atualizada por outro usuário.',409);
      await audit(env,'ordem',id,'status',{anterior:order.status,novo:b.status,em:at});return response({ok:true});
    }
    if(method==='PUT'&&action==='agendamento'){
      const b=await bodyJSON(request), scheduled=str(b.agendado_para,40), responsible=str(b.responsavel,120), notes=str(b.observacoes,3000);
      if(scheduled&&!Number.isFinite(new Date(scheduled).getTime()))fail('Data de agendamento inválida.');
      const result=await env.DB.batch([env.DB.prepare(`UPDATE tech_ordens SET agendado_para=?,responsavel=?,observacoes=?,status=CASE WHEN ?<>'' AND status='Aguardando agendamento' THEN 'Agendado' ELSE status END,atualizado_em=CURRENT_TIMESTAMP WHERE id=? AND status NOT IN ('Concluído','Cancelado')`).bind(scheduled||null,responsible,notes,scheduled,id),env.DB.prepare(`INSERT INTO tech_historico(ordem_id,tipo,descricao,dados_json) SELECT ?, 'Agendamento',?,? WHERE EXISTS(SELECT 1 FROM tech_ordens WHERE id=? AND agendado_para IS ?)`).bind(id,scheduled?`Agendada para ${scheduled}`:'Agendamento atualizado',JSON.stringify({agendado_para:scheduled,responsavel}),id,scheduled||null)]);if(!result[0].meta.changes)fail('Ordem inexistente ou encerrada.',409);
      await audit(env,'ordem',id,'agendamento',{agendado_para:scheduled,responsavel});return response({ok:true});
    }
    if(method==='PUT'&&action==='itens'){
      const b=await bodyJSON(request);if(!Array.isArray(b.itens)||b.itens.length>100)fail('Lista de materiais inválida.');
      const order=await env.DB.prepare(`SELECT status FROM tech_ordens WHERE id=?`).bind(id).first();if(!order)fail('Ordem de serviço não encontrada.',404);if(order.status==='Concluído'||order.status==='Cancelado')fail('A ordem está encerrada.',409);
      const rows=await env.DB.prepare('SELECT id,produto_id,quantidade FROM tech_ordem_itens WHERE ordem_id=?').bind(id).all();const updates=[];
      for(const item of b.itens){const current=rows.results.find(r=>r.id===Number(item.id));if(!current)fail('Item da OS não encontrado.');const qty=number(item.quantidade_utilizada,9999,0);if(Math.abs(qty*1000-Math.round(qty*1000))>0.00001)fail('Use até três casas decimais.');if(current.produto_id&&qty!==Math.floor(qty))fail('O estoque da Store controla unidades inteiras.');if(qty>current.quantidade)fail('A quantidade utilizada não pode ultrapassar a prevista sem um aditivo.');updates.push(env.DB.prepare('UPDATE tech_ordem_itens SET quantidade_utilizada=? WHERE id=? AND ordem_id=?').bind(qty,current.id,id));}
      if(updates.length)await env.DB.batch(updates);await env.DB.prepare('INSERT INTO tech_historico(ordem_id,tipo,descricao,dados_json) VALUES(?,?,?,?)').bind(id,'Materiais','Materiais utilizados atualizados',JSON.stringify({itens:b.itens})).run();await audit(env,'ordem',id,'materiais_utilizados',{itens:b.itens});return response({ok:true});
    }
    if(method==='POST'&&action==='fotos'){
      const blob=await limitedBody(request,19*1024*1024),form=await new Response(blob,{headers:{'content-type':request.headers.get('content-type')||''}}).formData(),stage=form.get('etapa');if(!['antes','depois'].includes(stage))fail('Etapa da foto inválida.');const files=form.getAll('fotos').filter(f=>f instanceof Blob&&f.size);if(!files.length||files.length>6)fail('Envie entre 1 e 6 fotos.');
      const order=await env.DB.prepare('SELECT id,status FROM tech_ordens WHERE id=?').bind(id).first();if(!order)fail('Ordem de serviço não encontrada.',404);for(const file of files)await validatePhoto(file);const uploaded=[];for(const file of files)uploaded.push(await uploadPhoto(file,settings));
      await env.DB.batch(uploaded.map(f=>env.DB.prepare('INSERT INTO tech_fotos(ordem_id,etapa,url,public_id) VALUES(?,?,?,?)').bind(id,stage,f.url,f.public_id)));await env.DB.prepare('INSERT INTO tech_historico(ordem_id,tipo,descricao,dados_json) VALUES(?,?,?,?)').bind(id,'Fotos',`${uploaded.length} foto(s) adicionada(s) à etapa ${stage}`,JSON.stringify({etapa:stage,quantidade:uploaded.length})).run();await audit(env,'ordem',id,'fotos',{etapa:stage,quantidade:uploaded.length});return response({ok:true,quantidade:uploaded.length},201);
    }
    if(method==='POST'&&action==='pagamentos'){
      const b=await bodyJSON(request), key=str(b.chave,100,8), methodName=str(b.metodo,60,2), notes=str(b.observacoes,500), amount=cents(b.valor);if(amount<=0)fail('Informe um recebimento positivo.');
      if(await env.DB.prepare('SELECT id FROM tech_pagamentos WHERE chave=?').bind(key).first())fail('Este recebimento já foi registrado.',409);
      const order=await env.DB.prepare('SELECT * FROM tech_ordens WHERE id=?').bind(id).first();if(!order)fail('Ordem de serviço não encontrada.',404);if(order.status==='Cancelado')fail('Não é possível receber por uma ordem cancelada.',409);if(Number(order.pago_centavos)+amount>Number(order.total_centavos))fail('O recebimento ultrapassa o saldo da ordem.',409);
      const description=`Serviço ${order.numero} · ${order.servico_nome}`;
      const result=await env.DB.batch([
        env.DB.prepare(`INSERT OR IGNORE INTO tech_pagamentos(ordem_id,chave,valor_centavos,metodo,observacoes) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM tech_ordens WHERE id=?)`).bind(id,key,amount,methodName,notes,id),
        env.DB.prepare(`UPDATE tech_ordens SET pago_centavos=pago_centavos+?,atualizado_em=CURRENT_TIMESTAMP WHERE id=? AND pago_centavos+?<=total_centavos AND EXISTS(SELECT 1 FROM tech_pagamentos WHERE chave=? AND caixa_id IS NULL AND valor_centavos=?)`).bind(amount,id,amount,key,amount),
        env.DB.prepare(`INSERT INTO caixa(tipo,descricao,valor,metodo,tech_pagamento_id) SELECT 'in',?,?,?,p.id FROM tech_pagamentos p WHERE p.chave=? AND p.caixa_id IS NULL`).bind(description,amount/100,methodName,key),
        env.DB.prepare(`UPDATE tech_pagamentos SET caixa_id=(SELECT id FROM caixa WHERE tech_pagamento_id=tech_pagamentos.id) WHERE chave=? AND caixa_id IS NULL`).bind(key),
        env.DB.prepare(`INSERT INTO tech_historico(ordem_id,tipo,descricao,dados_json) SELECT ?, 'Pagamento',?,? WHERE EXISTS(SELECT 1 FROM tech_pagamentos WHERE chave=? AND caixa_id IS NOT NULL)`).bind(id,`Recebimento ${amount/100} via ${methodName}`,JSON.stringify({valor_centavos:amount,metodo:methodName}),key)
      ]);
      if(!result[1].meta.changes)fail('Recebimento não aplicado: confira o saldo ou a chave idempotente.',409);await audit(env,'ordem',id,'pagamento',{valor_centavos:amount,metodo:methodName,chave:key});return response({ok:true});
    }
    if(method==='POST'&&action==='despesas'){
      const b=await bodyJSON(request),key=str(b.chave,100,8),category=str(b.categoria,80,2),description=str(b.descricao,300,2),amount=cents(b.valor);if(amount<=0)fail('Informe uma despesa positiva.');
      if(await env.DB.prepare('SELECT id FROM tech_despesas WHERE chave=?').bind(key).first())fail('Esta despesa já foi registrada.',409);
      const order=await env.DB.prepare('SELECT numero FROM tech_ordens WHERE id=?').bind(id).first();if(!order)fail('Ordem de serviço não encontrada.',404);
      const result=await env.DB.batch([
        env.DB.prepare(`INSERT OR IGNORE INTO tech_despesas(ordem_id,chave,categoria,descricao,valor_centavos) VALUES(?,?,?,?,?)`).bind(id,key,category,description,amount),
        env.DB.prepare(`INSERT INTO caixa(tipo,descricao,valor,metodo,tech_despesa_id) SELECT 'out',?,?,?,d.id FROM tech_despesas d WHERE d.chave=? AND d.caixa_id IS NULL`).bind(`Despesa ${order.numero} · ${description}`,amount/100,category,key),
        env.DB.prepare(`UPDATE tech_despesas SET caixa_id=(SELECT id FROM caixa WHERE tech_despesa_id=tech_despesas.id) WHERE chave=? AND caixa_id IS NULL`).bind(key),
        env.DB.prepare(`INSERT INTO tech_historico(ordem_id,tipo,descricao,dados_json) VALUES(?,?,?,?)`).bind(id,'Despesa',description,JSON.stringify({categoria:category,valor_centavos:amount}))
      ]);if(!result[0].meta.changes)fail('Esta despesa não pôde ser registrada.',409);await audit(env,'ordem',id,'despesa',{categoria:category,descricao:description,valor_centavos:amount});return response({ok:true},201);
    }
    if(method==='POST'&&action==='aditivos'){
      const b=await bodyJSON(request),normalized=quoteItems(b.itens,b.desconto||0),reason=str(b.motivo,1000,5),key=token(),order=await env.DB.prepare('SELECT id,status FROM tech_ordens WHERE id=?').bind(id).first();if(!order)fail('Ordem de serviço não encontrada.',404);if(['Concluído','Cancelado'].includes(order.status))fail('Não é possível alterar uma ordem encerrada.',409);if(normalized.total<=0)fail('O valor do aditivo deve ser positivo.');normalized.items=await linkProductCosts(env,normalized.items);if(normalized.desconto)normalized.items.push({tipo:'Mão de obra',nome:'Desconto do aditivo',quantidade:1,produto_id:null,preco_centavos:-normalized.desconto,custo_centavos:0,reposicao_centavos:0,subtotal_centavos:-normalized.desconto});
      const result=await env.DB.prepare(`INSERT INTO tech_aditivos(ordem_id,token,itens_json,total_centavos,motivo) VALUES(?,?,?,?,?)`).bind(id,key,JSON.stringify(normalized.items),normalized.total,reason).run();await audit(env,'aditivo',result.meta.last_row_id,'criado',{ordem_id:id,total_centavos:normalized.total,motivo:reason});return response({ok:true,link:'/tech/aditivo/'+key},201);
    }
  }
  const addonPublic=path.match(/^\/aditivos\/([a-f0-9]{64})(\/decisao)?$/);
  if(addonPublic){const a=await env.DB.prepare(`SELECT a.*,o.numero,o.servico_nome FROM tech_aditivos a JOIN tech_ordens o ON o.id=a.ordem_id WHERE a.token=?`).bind(addonPublic[1]).first();if(!a)fail('Aditivo não encontrado.',404);if(method==='GET'&&!addonPublic[2])return response({numero:a.numero,servico:a.servico_nome,motivo:a.motivo,itens:parse(a.itens_json).map(i=>({tipo:i.tipo,nome:i.nome,quantidade:i.quantidade,preco_centavos:i.preco_centavos,subtotal_centavos:i.subtotal_centavos})),total_centavos:a.total_centavos,status:a.status,versao:a.versao});if(method==='POST'&&addonPublic[2]){const b=await bodyJSON(request);if(!['Aprovado','Recusado'].includes(b.decisao))fail('Decisão inválida.');const at=new Date().toISOString();if(b.decisao==='Recusado'){const r=await env.DB.prepare(`UPDATE tech_aditivos SET status='Recusado',decidido_em=?,versao=versao+1 WHERE id=? AND status='Aguardando aprovação' AND versao=?`).bind(at,a.id,number(b.versao,1000000,1,true)).run();if(!r.meta.changes)fail('Aditivo já decidido ou alterado.',409);await audit(env,'aditivo',a.id,'recusado',{em:at});return response({ok:true});}
      const items=parse(a.itens_json),order=await env.DB.prepare('SELECT * FROM tech_ordens WHERE id=?').bind(a.ordem_id).first(),full=[...parse(order.itens_json),...items],statements=[env.DB.prepare(`UPDATE tech_aditivos SET status='Aprovado',decidido_em=?,versao=versao+1 WHERE id=? AND status='Aguardando aprovação' AND versao=?`).bind(at,a.id,number(b.versao,1000000,1,true)),env.DB.prepare(`UPDATE tech_ordens SET total_centavos=total_centavos+?,itens_json=?,atualizado_em=CURRENT_TIMESTAMP WHERE id=? AND status NOT IN ('Concluído','Cancelado') AND EXISTS(SELECT 1 FROM tech_aditivos WHERE id=? AND status='Aprovado' AND decidido_em=?)`).bind(a.total_centavos,JSON.stringify(full),a.ordem_id,a.id,at)];for(const i of items)statements.push(env.DB.prepare(`INSERT INTO tech_ordem_itens(ordem_id,tipo,nome,produto_id,quantidade,custo_centavos,reposicao_centavos,preco_centavos,subtotal_centavos) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM tech_aditivos WHERE id=? AND status='Aprovado' AND decidido_em=?)`).bind(a.ordem_id,i.tipo,i.nome,i.produto_id,i.quantidade,i.custo_centavos,i.reposicao_centavos,i.preco_centavos,i.subtotal_centavos,a.id,at));statements.push(env.DB.prepare(`INSERT INTO tech_historico(ordem_id,tipo,descricao,dados_json) VALUES(?,'Aditivo',?,?)`).bind(a.ordem_id,`Aditivo aprovado: ${a.motivo}`,JSON.stringify({aditivo:a.id,total_centavos:a.total_centavos})));const r=await env.DB.batch(statements);if(!r[0].meta.changes||!r[1].meta.changes)fail('Aditivo já decidido ou ordem encerrada.',409);await audit(env,'aditivo',a.id,'aprovado',{ordem_id:a.ordem_id,total_centavos:a.total_centavos});return response({ok:true});}fail('Rota não encontrada.',404);}
  const catalogMatch = path.match(/^\/admin\/(categorias|servicos)(?:\/(\d+))?$/);
  if (catalogMatch && ((method === 'POST' && !catalogMatch[2]) || (['PUT','DELETE'].includes(method) && catalogMatch[2]))) return saveCatalog(request, env, catalogMatch[1], catalogMatch[2] ? idOf(catalogMatch[2]) : null);
  if (path === '/admin/solicitacoes' && method === 'GET') {
    const page = number(url.searchParams.get('pagina') || 1, 100000, 1, true);
    const rows = await env.DB.prepare(`SELECT s.*,q.status orcamento_status,q.validade,q.total_centavos FROM tech_solicitacoes s LEFT JOIN tech_orcamentos q ON q.solicitacao_id=s.id ORDER BY s.id DESC LIMIT 50 OFFSET ?`).bind((page - 1) * 50).all();
    return response({ solicitacoes: rows.results.map(s => { const { chave_envio, fotos_json, respostas_json, ...rest } = s; return codeOf({ ...rest, status: s.orcamento_status ? effectiveStatus({ status: s.orcamento_status, validade: s.validade }) : s.status }); }), pagina: page });
  }
  const detail = path.match(/^\/admin\/solicitacoes\/(\d+)(?:\/(orcamento|enviar|status|cancelar))?$/);
  if (detail) {
    const id = idOf(detail[1]);
    if (method === 'GET' && !detail[2]) {
      const s = await env.DB.prepare('SELECT * FROM tech_solicitacoes WHERE id=?').bind(id).first();
      if (!s) fail('Solicitação não encontrada.', 404);
      const q = await env.DB.prepare('SELECT * FROM tech_orcamentos WHERE solicitacao_id=?').bind(id).first();
      const { chave_envio, ...safe } = s;
      return response({ solicitacao: codeOf({ ...safe, fotos: parse(s.fotos_json), respostas: parse(s.respostas_json), fotos_json: undefined, respostas_json: undefined }), orcamento: q ? { ...codeOf(q), status: effectiveStatus(q), itens: parse(q.itens_json), itens_json: undefined, link: q.enviado_em ? '/tech/orcamento/' + q.token : null } : null });
    }
    if (method === 'PUT' && detail[2] === 'orcamento') return saveQuote(request, env, id);
    if (method === 'POST' && detail[2] === 'enviar') {
      const b = await bodyJSON(request);
      const result = await env.DB.prepare(`UPDATE tech_orcamentos SET status='Aguardando aprovação',enviado_em=?,versao=versao+1 WHERE solicitacao_id=? AND status='Orçamento preparado' AND validade>? AND versao=?`).bind(new Date().toISOString(), id, new Date().toISOString(), number(b.versao, 1000000, 1, true)).run();
      if (!result.meta.changes) fail('Orçamento alterado, enviado ou vencido. Atualize.', 409);
      await audit(env,'orcamento',id,'enviado',{em:new Date().toISOString()});
      return response({ ok: true });
    }
    if(method==='POST'&&detail[2]==='cancelar'){
      const at=new Date().toISOString(),result=await env.DB.prepare(`UPDATE tech_orcamentos SET status='Cancelado',decidido_em=?,versao=versao+1 WHERE solicitacao_id=? AND status IN ('Orçamento preparado','Aguardando aprovação')`).bind(at,id).run();if(!result.meta.changes)fail('Orçamento aprovado, recusado, expirado ou cancelado não pode ser cancelado.',409);await env.DB.prepare(`UPDATE tech_solicitacoes SET status='Orçamento cancelado' WHERE id=?`).bind(id).run();await audit(env,'orcamento',id,'cancelado',{em:at});return response({ok:true});
    }
    if (method === 'PUT' && detail[2] === 'status') {
      const b = await bodyJSON(request);
      if (!['Novo','Em análise','Aguardando informações'].includes(b.status)) fail('Status inválido.');
      const result = await env.DB.prepare(`UPDATE tech_solicitacoes SET status=? WHERE id=? AND NOT EXISTS(SELECT 1 FROM tech_orcamentos WHERE solicitacao_id=?)`).bind(b.status, id, id).run();
      if (!result.meta.changes) fail('Solicitação inexistente ou já tem orçamento.', 409);
      await audit(env,'solicitacao',id,'status',{status:b.status});
      return response({ ok: true });
    }
  }
  fail('Rota não encontrada.', 404);
}
export async function techApi(request, env, url, helpers) {
  try { return await techRoute(request, env, url, helpers); }
  catch (error) { if (error instanceof InputError) return response({ error: error.message }, error.status); if (/estoque_insuficiente/i.test(String(error?.message))) return response({error:'Estoque insuficiente para concluir a OS. Ajuste os materiais utilizados ou reponha o estoque.'},409); throw error; }
}
