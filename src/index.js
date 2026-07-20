const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra }
});

const clean = (v) => String(v ?? "").trim();
const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const integer = (v, fallback = 0) => Number.isInteger(Number(v)) ? Number(v) : fallback;

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function productFromRow(r) {
  return {
    id: String(r.id), sku: r.sku || "", name: r.nome || "", description: r.descricao || "",
    category: r.categoria || "Outros", subcategory: r.subcategoria || "", unit: r.unidade || "Unidade",
    brand: r.marca || "", model: r.modelo || "", supplier: r.fornecedor || "", location: r.localizacao_estoque || "",
    warranty: num(r.garantia), cost: num(r.preco_custo), margin: num(r.margem), price: num(r.preco_venda),
    stock: num(r.estoque), min: num(r.estoque_minimo), image: r.imagem_url || "",
    published: num(r.publicado, 1) === 1, active: num(r.ativo, 1) === 1,
    createdAt: r.criado_em, updatedAt: r.atualizado_em
  };
}

function saleFromRow(r, items = []) {
  return {
    id: r.codigo || String(r.id), date: r.criado_em, customerId: r.cliente_id ? String(r.cliente_id) : "",
    customerName: r.cliente_nome || "", customerPhone: r.cliente_whatsapp || "", items,
    total: num(r.total), cost: num(r.custo_total), profit: num(r.lucro), payment: r.forma_pagamento || "Pix",
    installments: Math.max(1, integer(r.parcelas, 1)), status: r.status || "Aguardando pagamento", deliveryMethod: r.tipo_entrega === "delivery" ? "Entrega" : "Retirada",
    deliveryFee: num(r.taxa_entrega), address: r.endereco_entrega || "", mapsLink: r.maps_link || ""
  };
}

async function columnNames(env, table) {
  const res = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
  return new Set((res.results || []).map(r => r.name));
}

async function addMissingColumns(env, table, definitions) {
  const cols = await columnNames(env, table);
  for (const [name, definition] of definitions) {
    if (!cols.has(name)) await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`).run();
  }
}

async function ensureSchema(env) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS produtos (id INTEGER PRIMARY KEY AUTOINCREMENT, sku TEXT UNIQUE, nome TEXT NOT NULL, descricao TEXT, categoria TEXT, subcategoria TEXT, unidade TEXT DEFAULT 'Unidade', marca TEXT, modelo TEXT, fornecedor TEXT, localizacao_estoque TEXT, garantia INTEGER DEFAULT 0, preco_custo REAL DEFAULT 0, margem REAL DEFAULT 0, preco_venda REAL NOT NULL, estoque INTEGER DEFAULT 0, estoque_minimo INTEGER DEFAULT 0, imagem_url TEXT, publicado INTEGER DEFAULT 1, ativo INTEGER DEFAULT 1, criado_em TEXT DEFAULT CURRENT_TIMESTAMP, atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS clientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, whatsapp TEXT NOT NULL, email TEXT, cpf TEXT, cep TEXT, endereco TEXT, numero TEXT, complemento TEXT, bairro TEXT, cidade TEXT, estado TEXT, referencia TEXT, criado_em TEXT DEFAULT CURRENT_TIMESTAMP, atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS pedidos (id INTEGER PRIMARY KEY AUTOINCREMENT, codigo TEXT UNIQUE, cliente_id INTEGER, cliente_nome TEXT, cliente_whatsapp TEXT, status TEXT DEFAULT 'aguardando_pagamento', tipo_entrega TEXT DEFAULT 'pickup', endereco_entrega TEXT, maps_link TEXT, forma_pagamento TEXT DEFAULT 'Pix', parcelas INTEGER DEFAULT 1, subtotal REAL DEFAULT 0, taxa_entrega REAL DEFAULT 0, desconto REAL DEFAULT 0, total REAL DEFAULT 0, custo_total REAL DEFAULT 0, lucro REAL DEFAULT 0, comprovante_url TEXT, observacoes TEXT, criado_em TEXT DEFAULT CURRENT_TIMESTAMP, atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS itens_pedido (id INTEGER PRIMARY KEY AUTOINCREMENT, pedido_id INTEGER NOT NULL, produto_id INTEGER NOT NULL, nome_produto TEXT NOT NULL, quantidade INTEGER NOT NULL, preco_unitario REAL NOT NULL, custo_unitario REAL DEFAULT 0, subtotal REAL NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS movimentacoes_estoque (id INTEGER PRIMARY KEY AUTOINCREMENT, produto_id INTEGER NOT NULL, tipo TEXT NOT NULL, quantidade INTEGER NOT NULL, estoque_anterior INTEGER DEFAULT 0, estoque_novo INTEGER DEFAULT 0, motivo TEXT, pedido_id INTEGER, criado_em TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY, valor TEXT, atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS caixa (id INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT NOT NULL, descricao TEXT, valor REAL NOT NULL, metodo TEXT, pedido_id INTEGER, criado_em TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE INDEX IF NOT EXISTS idx_produtos_publicado ON produtos(publicado, ativo)`,
    `CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id)`,
    `CREATE TRIGGER IF NOT EXISTS trg_produtos_estoque_valido BEFORE UPDATE OF estoque ON produtos WHEN NEW.estoque < 0 BEGIN SELECT RAISE(ABORT, 'estoque_insuficiente'); END`,
    `INSERT OR IGNORE INTO configuracoes(chave,valor) VALUES ('admin_password','1234')`,
    `INSERT OR IGNORE INTO configuracoes(chave,valor) VALUES ('storeName','MCastro Solutions')`,
    `INSERT OR IGNORE INTO configuracoes(chave,valor) VALUES ('cloudinaryCloudName','fzklkuxa')`,
    `INSERT OR IGNORE INTO configuracoes(chave,valor) VALUES ('cloudinaryUploadPreset','mcastro_produtos')`
  ];
  for (const sql of statements) await env.DB.prepare(sql).run();

  // Migra automaticamente bancos criados pelas versões anteriores sem apagar dados.
  await addMissingColumns(env, "produtos", [
    ["unidade", "TEXT DEFAULT 'Unidade'"], ["margem", "REAL DEFAULT 0"],
    ["publicado", "INTEGER DEFAULT 1"], ["ativo", "INTEGER DEFAULT 1"],
    ["atualizado_em", "TEXT"]
  ]);
  await addMissingColumns(env, "pedidos", [
    ["cliente_nome", "TEXT"], ["cliente_whatsapp", "TEXT"], ["maps_link", "TEXT"], ["parcelas", "INTEGER DEFAULT 1"],
    ["custo_total", "REAL DEFAULT 0"], ["lucro", "REAL DEFAULT 0"],
    ["atualizado_em", "TEXT"]
  ]);
  await addMissingColumns(env, "itens_pedido", [["custo_unitario", "REAL DEFAULT 0"]]);
}

async function settingsObject(env, admin = false) {
  const res = await env.DB.prepare("SELECT chave, valor FROM configuracoes").all();
  const all = Object.fromEntries((res.results || []).map(r => [r.chave, r.valor]));
  const pub = {
    storeName: all.storeName || "MCastro Solutions", pixKey: all.pixKey || "", whatsapp: all.whatsapp || "",
    deliveryFee: num(all.deliveryFee), cloudinaryCloudName: all.cloudinaryCloudName || "fzklkuxa",
    cloudinaryUploadPreset: all.cloudinaryUploadPreset || "mcastro_produtos", catalogUrl: all.catalogUrl || ""
  };
  return pub;
}

async function adminAllowed(request, env) {
  const supplied = request.headers.get("x-admin-password") || "";
  if (!supplied) return false;
  const rows = await env.DB.prepare("SELECT chave,valor FROM configuracoes WHERE chave IN ('admin_password','admin_password_hash')").all();
  const values = Object.fromEntries((rows.results || []).map(r => [r.chave, r.valor]));
  if (values.admin_password_hash) return (await sha256(supplied)) === values.admin_password_hash;
  return supplied === (values.admin_password || "1234");
}

async function customerUpsert(env, input) {
  const name = clean(input?.name), phone = clean(input?.phone).replace(/\D/g, "");
  if (name.length < 3) throw new Error("Informe um nome válido.");
  let customer = phone ? await env.DB.prepare("SELECT * FROM clientes WHERE whatsapp=? ORDER BY id DESC LIMIT 1").bind(phone).first() : null;
  const fields = [name, phone, clean(input?.email), clean(input?.cpf), clean(input?.cep), clean(input?.street || input?.address), clean(input?.number), clean(input?.complement), clean(input?.district), clean(input?.city), clean(input?.state), clean(input?.reference)];
  if (customer) {
    await env.DB.prepare("UPDATE clientes SET nome=?,whatsapp=?,email=?,cpf=?,cep=?,endereco=?,numero=?,complemento=?,bairro=?,cidade=?,estado=?,referencia=?,atualizado_em=CURRENT_TIMESTAMP WHERE id=?").bind(...fields, customer.id).run();
    return Number(customer.id);
  }
  const result = await env.DB.prepare("INSERT INTO clientes(nome,whatsapp,email,cpf,cep,endereco,numero,complemento,bairro,cidade,estado,referencia) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(...fields).run();
  return Number(result.meta.last_row_id);
}

async function readBody(request) {
  try { return await request.json(); } catch { return {}; }
}

async function api(request, env, url) {
  if (!env.DB) return json({ ok: false, error: "Banco D1 não vinculado. Adicione a associação D1 com nome DB." }, 503);
  await ensureSchema(env);

  if (url.pathname === "/api/health") {
    const row = await env.DB.prepare("SELECT COUNT(*) total FROM produtos").first();
    return json({ ok: true, database: true, products: num(row?.total) });
  }

  if (url.pathname === "/api/bootstrap" && request.method === "GET") {
    const admin = url.searchParams.get("admin") === "1" && await adminAllowed(request, env);
    const productSql = admin ? "SELECT * FROM produtos WHERE ativo=1 ORDER BY id DESC" : "SELECT * FROM produtos WHERE ativo=1 AND publicado=1 AND estoque>0 ORDER BY id DESC";
    const products = await env.DB.prepare(productSql).all();
    const payload = { products: (products.results || []).map(productFromRow), settings: await settingsObject(env, admin) };
    if (admin) {
      const customers = await env.DB.prepare("SELECT * FROM clientes ORDER BY id DESC LIMIT 500").all();
      const orders = await env.DB.prepare("SELECT * FROM pedidos ORDER BY id DESC LIMIT 500").all();
      const items = await env.DB.prepare("SELECT * FROM itens_pedido ORDER BY id DESC LIMIT 3000").all();
      const byOrder = new Map();
      for (const i of items.results || []) {
        const arr = byOrder.get(i.pedido_id) || [];
        arr.push({ id: String(i.produto_id), name: i.nome_produto, qty: num(i.quantidade), price: num(i.preco_unitario), cost: num(i.custo_unitario) });
        byOrder.set(i.pedido_id, arr);
      }
      const cash = await env.DB.prepare("SELECT * FROM caixa ORDER BY id DESC LIMIT 1000").all();
      payload.customers = (customers.results || []).map(c => ({ id: String(c.id), name: c.nome, phone: c.whatsapp, email: c.email || "", address: c.endereco || "" }));
      payload.sales = (orders.results || []).map(o => saleFromRow(o, byOrder.get(o.id) || []));
      payload.cash = (cash.results || []).map(c => ({ id: String(c.id), date: c.criado_em, type: c.tipo, description: c.descricao, value: num(c.valor), method: c.metodo || "", saleId: c.pedido_id ? String(c.pedido_id) : "" }));
    }
    return json(payload);
  }

  if (url.pathname === "/api/admin/login" && request.method === "POST") {
    return (await adminAllowed(request, env)) ? json({ ok: true }) : json({ ok: false, error: "Senha inválida." }, 401);
  }

  if (url.pathname === "/api/products" && request.method === "POST") {
    if (!(await adminAllowed(request, env))) return json({ error: "Senha administrativa inválida." }, 401);
    const p = await readBody(request);
    if (!clean(p.name)) return json({ error: "Informe o nome do produto." }, 400);
    if (!(num(p.price) > 0)) return json({ error: "Informe um preço válido." }, 400);
    const vals = [clean(p.sku) || null, clean(p.name), clean(p.description), clean(p.category) || "Outros", clean(p.subcategory), clean(p.unit) || "Unidade", clean(p.brand), clean(p.model), clean(p.supplier), clean(p.location), num(p.warranty), num(p.cost), num(p.margin), num(p.price), Math.max(0, Math.floor(num(p.stock))), Math.max(0, Math.floor(num(p.min))), clean(p.image), p.published === false ? 0 : 1];
    const id = Number(p.id);
    if (Number.isInteger(id) && id > 0) {
      await env.DB.prepare(`UPDATE produtos SET sku=?,nome=?,descricao=?,categoria=?,subcategoria=?,unidade=?,marca=?,modelo=?,fornecedor=?,localizacao_estoque=?,garantia=?,preco_custo=?,margem=?,preco_venda=?,estoque=?,estoque_minimo=?,imagem_url=?,publicado=?,atualizado_em=CURRENT_TIMESTAMP WHERE id=?`).bind(...vals, id).run();
      return json({ product: productFromRow(await env.DB.prepare("SELECT * FROM produtos WHERE id=?").bind(id).first()) });
    }
    const result = await env.DB.prepare(`INSERT INTO produtos(sku,nome,descricao,categoria,subcategoria,unidade,marca,modelo,fornecedor,localizacao_estoque,garantia,preco_custo,margem,preco_venda,estoque,estoque_minimo,imagem_url,publicado,ativo) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`).bind(...vals).run();
    return json({ product: productFromRow(await env.DB.prepare("SELECT * FROM produtos WHERE id=?").bind(result.meta.last_row_id).first()) }, 201);
  }

  const productMatch = url.pathname.match(/^\/api\/products\/(\d+)$/);
  if (productMatch && request.method === "DELETE") {
    if (!(await adminAllowed(request, env))) return json({ error: "Senha administrativa inválida." }, 401);
    await env.DB.prepare("UPDATE produtos SET ativo=0, atualizado_em=CURRENT_TIMESTAMP WHERE id=?").bind(Number(productMatch[1])).run();
    return json({ ok: true });
  }

  if (url.pathname === "/api/settings" && request.method === "PUT") {
    if (!(await adminAllowed(request, env))) return json({ error: "Senha administrativa inválida." }, 401);
    const body = await readBody(request);
    if (body.adminPassword !== undefined && clean(body.adminPassword).length < 6) return json({ error: "A nova senha deve ter pelo menos 6 caracteres." }, 400);
    const map = { storeName: "storeName", pixKey: "pixKey", whatsapp: "whatsapp", deliveryFee: "deliveryFee", cloudinaryCloudName: "cloudinaryCloudName", cloudinaryUploadPreset: "cloudinaryUploadPreset", catalogUrl: "catalogUrl" };
    for (const [key, dbKey] of Object.entries(map)) {
      if (body[key] !== undefined) await env.DB.prepare("INSERT INTO configuracoes(chave,valor,atualizado_em) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor, atualizado_em=CURRENT_TIMESTAMP").bind(dbKey, String(body[key])).run();
    }
    if (body.adminPassword !== undefined) {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO configuracoes(chave,valor,atualizado_em) VALUES('admin_password_hash',?,CURRENT_TIMESTAMP) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor, atualizado_em=CURRENT_TIMESTAMP").bind(await sha256(body.adminPassword)),
        env.DB.prepare("DELETE FROM configuracoes WHERE chave='admin_password'")
      ]);
    }
    return json({ ok: true, settings: await settingsObject(env) });
  }

  if (url.pathname === "/api/customers" && request.method === "POST") {
    if (!(await adminAllowed(request, env))) return json({ error: "Senha administrativa inválida." }, 401);
    const body = await readBody(request);
    try {
      const requestedId = integer(body.id);
      if (requestedId > 0) {
        if (clean(body.name).length < 3) return json({ error: "Informe um nome válido." }, 400);
        await env.DB.prepare("UPDATE clientes SET nome=?,whatsapp=?,cpf=?,endereco=?,atualizado_em=CURRENT_TIMESTAMP WHERE id=?").bind(clean(body.name), clean(body.phone).replace(/\D/g, ""), clean(body.cpf), clean(body.address), requestedId).run();
        return json({ ok: true, id: String(requestedId) });
      }
      return json({ ok: true, id: String(await customerUpsert(env, body)) }, 201);
    } catch (error) { return json({ error: error.message }, 400); }
  }

  if (url.pathname === "/api/cash" && request.method === "POST") {
    if (!(await adminAllowed(request, env))) return json({ error: "Senha administrativa inválida." }, 401);
    const body = await readBody(request);
    const type = body.type === "in" ? "in" : "out", value = num(body.value);
    if (!clean(body.description) || !(value > 0)) return json({ error: "Informe descrição e valor válidos." }, 400);
    const createdAt = /^\d{4}-\d{2}-\d{2}T/.test(clean(body.date)) ? clean(body.date) : new Date().toISOString();
    const result = await env.DB.prepare("INSERT INTO caixa(tipo,descricao,valor,metodo,criado_em) VALUES(?,?,?,?,?)").bind(type, clean(body.description), value, clean(body.method), createdAt).run();
    return json({ ok: true, id: String(result.meta.last_row_id) }, 201);
  }

  if (url.pathname === "/api/orders" && request.method === "POST") {
    const body = await readBody(request);
    const isAdmin = await adminAllowed(request, env);
    let name = clean(body.customer?.name) || (isAdmin ? "Consumidor não identificado" : "");
    let phone = clean(body.customer?.phone).replace(/\D/g, "");
    if (!isAdmin && (name.length < 3 || phone.length < 10)) return json({ error: "Informe nome e WhatsApp válidos." }, 400);
    if (!Array.isArray(body.items) || !body.items.length) return json({ error: "Carrinho vazio." }, 400);

    let customerId = integer(body.customerId);
    if (customerId > 0 && isAdmin) {
      const exists = await env.DB.prepare("SELECT id,nome,whatsapp FROM clientes WHERE id=?").bind(customerId).first();
      if (!exists) return json({ error: "Cliente não encontrado." }, 400);
      name = exists.nome;
      phone = exists.whatsapp || "";
    } else if (phone) {
      try { customerId = await customerUpsert(env, body.customer); } catch (error) { return json({ error: error.message }, 400); }
    } else customerId = 0;

    const quantities = new Map();
    for (const item of body.items) {
      const id = integer(item.id), qty = integer(item.qty);
      if (id <= 0 || qty <= 0 || qty > 9999) return json({ error: "Produto ou quantidade inválida no carrinho." }, 400);
      quantities.set(id, (quantities.get(id) || 0) + qty);
    }
    const ids = [...quantities.keys()];
    const placeholders = ids.map(() => "?").join(",");
    const pr = await env.DB.prepare(`SELECT * FROM produtos WHERE id IN (${placeholders}) AND ativo=1 AND publicado=1`).bind(...ids).all();
    const products = new Map((pr.results || []).map(p => [Number(p.id), p]));
    let subtotal = 0, costTotal = 0;
    const normalized = [];
    for (const [id, qty] of quantities) {
      const p = products.get(id);
      if (!p || num(p.estoque) < qty) return json({ error: `Estoque insuficiente para ${p?.nome || "um produto"}.` }, 409);
      subtotal += num(p.preco_venda) * qty; costTotal += num(p.preco_custo) * qty;
      normalized.push({ p, qty });
    }
    const deliveryFeeSetting = await env.DB.prepare("SELECT valor FROM configuracoes WHERE chave='deliveryFee'").first();
    const deliveryFee = body.deliveryMethod === "delivery" ? Math.max(0, num(deliveryFeeSetting?.valor)) : 0;
    const discount = isAdmin ? Math.min(subtotal, Math.max(0, num(body.discount))) : 0;
    const total = subtotal + deliveryFee - discount;
    const code = "PED-" + crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
    const address = clean(body.address);
    if (!isAdmin && body.deliveryMethod === "delivery" && address.length < 8) return json({ error: "Informe o endereço de entrega." }, 400);
    const payment = isAdmin ? clean(body.payment) || "Pix" : "Pix";
    const installments = isAdmin ? Math.max(1, Math.min(24, integer(body.installments, 1))) : 1;
    const statements = [env.DB.prepare(`INSERT INTO pedidos(codigo,cliente_id,cliente_nome,cliente_whatsapp,status,tipo_entrega,endereco_entrega,maps_link,forma_pagamento,parcelas,subtotal,taxa_entrega,desconto,total,custo_total,lucro,observacoes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(code, customerId || null, name, phone, isAdmin ? "concluido" : "aguardando_comprovante", body.deliveryMethod === "delivery" ? "delivery" : "pickup", address, clean(body.mapsLink), payment, installments, subtotal, deliveryFee, discount, total, costTotal, total - costTotal, clean(body.notes))];
    for (const { p, qty } of normalized) {
      statements.push(
        env.DB.prepare("UPDATE produtos SET estoque=estoque-?,atualizado_em=CURRENT_TIMESTAMP WHERE id=?").bind(qty, p.id),
        env.DB.prepare("INSERT INTO itens_pedido(pedido_id,produto_id,nome_produto,quantidade,preco_unitario,custo_unitario,subtotal) VALUES((SELECT id FROM pedidos WHERE codigo=?),?,?,?,?,?,?)").bind(code, p.id, p.nome, qty, num(p.preco_venda), num(p.preco_custo), num(p.preco_venda) * qty),
        env.DB.prepare("INSERT INTO movimentacoes_estoque(produto_id,tipo,quantidade,estoque_anterior,estoque_novo,motivo,pedido_id) SELECT id,'saida',?,estoque+?,estoque,?,(SELECT id FROM pedidos WHERE codigo=?) FROM produtos WHERE id=?").bind(qty, qty, "Pedido " + code, code, p.id)
      );
    }
    statements.push(env.DB.prepare("INSERT INTO caixa(tipo,descricao,valor,metodo,pedido_id) VALUES('in',?,?,?,(SELECT id FROM pedidos WHERE codigo=?))").bind("Pedido " + code, total, payment, code));
    try { await env.DB.batch(statements); }
    catch (error) {
      if (/estoque_insuficiente/i.test(String(error?.message))) return json({ error: "O estoque mudou durante a compra. Atualize o carrinho e tente novamente." }, 409);
      throw error;
    }
    const order = await env.DB.prepare("SELECT id FROM pedidos WHERE codigo=?").bind(code).first();
    return json({ ok: true, order: { id: String(order.id), code, subtotal, deliveryFee, discount, total } }, 201);
  }

  return json({ error: "Rota não encontrada." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) return await api(request, env, url);
      if (!env.ASSETS) return new Response("ASSETS binding ausente.", { status: 500 });
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return url.pathname.startsWith("/api/") ? json({ error: error?.message || "Erro interno." }, 500) : new Response("Erro interno", { status: 500 });
    }
  }
};
