// MCastro Online Adapter v4.3 — todas as gravações passam pelo Cloudflare D1.
(() => {
  // Informa aos scripts legados que o checkout definitivo e online está ativo.
  window.mcastroOnlineCheckout = true;
  const API = '/api';
  let onlineReady = false;
  let syncing = false;
  const requestedAdmin = new URLSearchParams(location.search).get('modo') === 'admin';

  const password = () => sessionStorage.getItem('mcastro_admin_password') || '';
  const isAdmin = () => sessionStorage.getItem('mcastro_admin') === '1';
  const safeCache = () => {
    if (db?.settings) delete db.settings.adminPassword;
    localStorage.setItem(KEY, JSON.stringify(db));
  };
  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body) headers['content-type'] = 'application/json';
    if (isAdmin() || path === '/admin/login') headers['x-admin-password'] = options.password || password();
    const res = await fetch(API + path, { cache: 'no-store', ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
    return data;
  }
  async function verifyAdmin(value) {
    await request('/admin/login', { method: 'POST', password: value });
    sessionStorage.setItem('mcastro_admin_password', value);
    sessionStorage.setItem('mcastro_admin', '1');
  }
  async function askAdminOnDirectAccess() {
    if (!requestedAdmin || isAdmin()) return true;
    let value = '';
    while (!value) {
      value = prompt('Digite a senha administrativa:') || '';
      if (!value) { location.replace(location.pathname + '?modo=catalogo'); return false; }
      try {
        await verifyAdmin(value);
        location.reload();
        return false;
      }
      catch (_) { value = ''; alert('Senha inválida. Tente novamente.'); }
    }
    return true;
  }
  async function loadOnline(forceAdmin = isAdmin() || requestedAdmin) {
    try {
      const data = await request('/bootstrap' + (forceAdmin ? '?admin=1' : ''));
      db.products = data.products || [];
      db.settings = { ...(db.settings || {}), ...(data.settings || {}) };
      if (forceAdmin) {
        db.customers = data.customers || [];
        db.sales = data.sales || [];
        db.cash = data.cash || [];
      } else {
        // O catálogo público nunca persiste dados administrativos no aparelho.
        db.customers = [];
        db.sales = [];
        db.cash = [];
      }
      safeCache();
      onlineReady = true;
      renderAll();
      checkPublicLink();
      document.body.dataset.database = 'online';
      return true;
    } catch (error) {
      console.error(error);
      document.body.dataset.database = 'offline';
      if (!navigator.onLine) toast('Sem internet: dados apenas para consulta.');
      else alert('Não foi possível carregar o banco online: ' + error.message);
      renderAll();
      return false;
    }
  }
  async function reloadAdmin() {
    await loadOnline(true);
    renderAll();
  }

  const productForm = $('productForm');
  productForm.onsubmit = async event => {
    event.preventDefault();
    if (photoUploading || syncing) return;
    const product = {
      id: /^\d+$/.test($('productId').value) ? Number($('productId').value) : undefined,
      name: $('pName').value.trim(), category: $('pCategory').value, subcategory: $('pSubcategory').value,
      unit: $('pUnit').value, sku: $('pSku').value.trim(), brand: $('pBrand').value.trim(), model: $('pModel').value.trim(),
      warranty: +$('pWarranty').value, supplier: $('pSupplier').value.trim(), location: $('pLocation').value.trim(),
      cost: +$('pCost').value, margin: +$('pMargin').value, price: +$('pPrice').value,
      stock: +$('pStock').value, min: +$('pMin').value, image: photo, published: true
    };
    if (!product.name || !(product.price > 0) || product.stock < 0) return alert('Revise nome, preço e estoque.');
    syncing = true; setProductSaving(true);
    try {
      const data = await request('/products', { method: 'POST', body: JSON.stringify(product) });
      const index = db.products.findIndex(item => String(item.id) === String(data.product.id));
      if (index >= 0) db.products[index] = data.product; else db.products.unshift(data.product);
      safeCache(); renderAll(); closeM(); toast('Produto salvo no banco online');
    } catch (error) { alert('Não foi possível salvar: ' + error.message); }
    finally { syncing = false; setProductSaving(false); }
  };

  window.deleteProduct = async id => {
    if (!confirm('Excluir produto?')) return;
    try {
      await request('/products/' + encodeURIComponent(id), { method: 'DELETE' });
      db.products = db.products.filter(product => String(product.id) !== String(id));
      safeCache(); renderAll(); toast('Produto excluído');
    } catch (error) { alert('Não foi possível excluir: ' + error.message); }
  };

  $('saveSettings').addEventListener('click', async event => {
    if (!isAdmin()) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const newPassword = $('adminPassword').value.trim();
    if (newPassword && newPassword.length < 6) return alert('A nova senha deve ter pelo menos 6 caracteres.');
    const payload = {
      storeName: $('storeName').value.trim() || 'MCastro Solutions', pixKey: $('pixKey').value.trim(),
      whatsapp: $('whatsapp').value.trim(), deliveryFee: Math.max(0, +$('deliveryFee').value || 0),
      cloudinaryCloudName: $('cloudinaryCloudName').value.trim(), cloudinaryUploadPreset: $('cloudinaryUploadPreset').value.trim(),
      catalogUrl: $('catalogUrl').value.trim()
    };
    if (newPassword) payload.adminPassword = newPassword;
    try {
      const data = await request('/settings', { method: 'PUT', body: JSON.stringify(payload) });
      db.settings = { ...db.settings, ...data.settings };
      if (newPassword) sessionStorage.setItem('mcastro_admin_password', newPassword);
      $('adminPassword').value = '';
      safeCache(); renderAll(); toast('Configurações salvas online');
    } catch (error) { alert('Falha ao salvar configurações: ' + error.message); }
  }, true);

  $('customerForm').addEventListener('submit', async event => {
    if (!isAdmin()) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const customer = { id: $('cId').value || undefined, name: $('cName').value.trim(), phone: $('cPhone').value.trim(), cpf: $('cCpf').value.trim(), address: $('cAddress').value.trim() };
    try {
      await request('/customers', { method: 'POST', body: JSON.stringify(customer) });
      await reloadAdmin(); closeM(); toast('Cliente salvo no banco online');
    } catch (error) { alert('Não foi possível salvar o cliente: ' + error.message); }
  }, true);

  $('cashForm').addEventListener('submit', async event => {
    if (!isAdmin()) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const movement = { type: $('mType').value === 'in' ? 'in' : 'out', description: $('mDescription').value.trim(), value: +$('mValue').value, method: $('mMethod').value, date: new Date($('mDate').value).toISOString() };
    try {
      await request('/cash', { method: 'POST', body: JSON.stringify(movement) });
      await reloadAdmin(); closeM(); toast('Lançamento salvo no banco online');
    } catch (error) { alert('Não foi possível salvar o lançamento: ' + error.message); }
  }, true);

  $('finishSale').addEventListener('click', async event => {
    event.preventDefault(); event.stopImmediatePropagation();
    if (!onlineReady) return alert('Sem conexão com o banco. Tente novamente quando a internet voltar.');
    if (!cart.length) return alert('Carrinho vazio.');
    const publicMode = document.body.classList.contains('public-mode');
    const delivery = publicMode && $('deliveryMethod').value === 'delivery';
    const customer = publicMode ? {
      name: $('publicCustomerName').value.trim(), phone: $('publicCustomerPhone').value,
      email: $('publicCustomerEmail').value.trim(), cep: $('deliveryCep').value.trim(), street: $('deliveryStreet').value.trim(),
      number: $('deliveryNumber').value.trim(), complement: $('deliveryAddress').value.trim(), district: $('deliveryDistrict').value.trim(),
      city: $('deliveryCity').value.trim(), state: 'PI'
    } : null;
    if (publicMode && (customer.name.length < 3 || customer.phone.replace(/\D/g, '').length < 10)) return alert('Informe nome e WhatsApp válidos.');
    if (delivery && (!customer.street || !customer.number || !customer.district)) return alert('Preencha rua, número e bairro.');
    const address = customer ? [customer.street, customer.number && 'nº ' + customer.number, customer.district, customer.city, customer.cep && 'CEP ' + customer.cep, customer.complement].filter(Boolean).join(', ') : '';
    const payload = {
      customer, customerId: publicMode ? undefined : $('saleCustomer').value,
      items: cart.map(item => ({ id: item.id, qty: item.qty })), deliveryMethod: delivery ? 'delivery' : 'pickup',
      address, mapsLink: publicMode ? $('mapsLink').value.trim() : '',
      payment: publicMode ? 'Pix' : $('payment').value, installments: publicMode ? 1 : +$('installments').value,
      discount: publicMode ? 0 : +$('discount').value
    };
    const button = $('finishSale'); button.disabled = true; button.textContent = 'Registrando pedido...';
    try {
      const data = await request('/orders', { method: 'POST', body: JSON.stringify(payload) });
      const purchased = [...cart]; cart = []; $('discount').value = 0;
      if (publicMode) {
        const lines = purchased.map((item, index) => { const product = db.products.find(p => String(p.id) === String(item.id)); return `${index + 1}. ${product.name}\n   ${item.qty} × ${money(product.price)}`; }).join('\n');
        const target = String(db.settings.whatsapp || '').replace(/\D/g, '');
        const message = [`Olá! Quero concluir meu pedido na ${db.settings.storeName}.`, `*Pedido:* ${data.order.code}`, `*Cliente:* ${customer.name}`, '', lines, '', `*Total:* ${money(data.order.total)}`, delivery ? `*Endereço:* ${address}` : '', 'Vou enviar o comprovante PIX nesta conversa.'].filter(Boolean).join('\n');
        await loadOnline(false);
        if (target) location.href = `https://wa.me/${target}?text=${encodeURIComponent(message)}`;
        else alert('Pedido registrado: ' + data.order.code);
      } else {
        await reloadAdmin(); toast('Venda registrada no banco online'); go('dashboard');
      }
    } catch (error) { alert('Não foi possível registrar o pedido: ' + error.message); }
    finally { button.disabled = false; button.textContent = publicMode ? 'Concluir pedido pelo WhatsApp' : 'Finalizar venda'; }
  }, true);

  window.completeSale = async id => {
    if (!isAdmin()) return alert('Entre como administrador para concluir a venda.');
    if (!confirm('Confirmar o recebimento do comprovante e concluir esta venda?')) return;
    try {
      await request('/orders/' + encodeURIComponent(id) + '/complete', { method: 'POST' });
      await reloadAdmin();
      toast('Venda concluída, estoque e caixa atualizados');
    } catch (error) {
      alert('Não foi possível concluir a venda: ' + error.message);
    }
  };

  window.cancelSale = async id => {
    if (!isAdmin()) return alert('Entre como administrador para cancelar o pedido.');
    if (!confirm('Cancelar este pedido? Ele permanecerá no histórico sem alterar estoque ou caixa.')) return;
    try {
      await request('/orders/' + encodeURIComponent(id) + '/cancel', { method: 'POST' });
      await reloadAdmin();
      toast('Pedido cancelado');
    } catch (error) {
      alert('Não foi possível cancelar o pedido: ' + error.message);
    }
  };

  window.refundSale = async id => {
    if (!isAdmin()) return alert('Entre como administrador para estornar a venda.');
    const choice = prompt('ESTORNAR VENDA\n\nDigite 1: produto em bom estado (volta ao estoque)\nDigite 2: produto com defeito (não volta ao estoque)\n\nPara sair, toque em Cancelar.');
    if (choice === null) return;
    if (choice !== '1' && choice !== '2') return alert('Escolha 1 ou 2.');
    const returnToStock = choice === '1';
    if (!confirm(`Confirmar estorno? ${returnToStock ? 'Os produtos voltarão ao estoque.' : 'Os produtos defeituosos não voltarão ao estoque.'}`)) return;
    try {
      await request('/orders/' + encodeURIComponent(id) + '/refund', { method: 'POST', body: JSON.stringify({ returnToStock }) });
      await reloadAdmin();
      toast('Venda estornada e caixa atualizado');
    } catch (error) {
      alert('Não foi possível estornar a venda: ' + error.message);
    }
  };

  $('adminLoginForm').addEventListener('submit', async event => {
    event.preventDefault(); event.stopImmediatePropagation();
    const value = $('adminLoginPassword').value;
    try {
      await verifyAdmin(value); $('adminLoginPassword').value = '';
      await loadOnline(true); closeM();
      location.href = location.pathname + '?modo=admin';
    } catch (error) { alert('Senha administrativa incorreta.'); }
  }, true);

  const oldLogout = $('logoutAdmin').onclick;
  $('logoutAdmin').onclick = event => {
    sessionStorage.removeItem('mcastro_admin_password');
    sessionStorage.removeItem('mcastro_admin');
    if (oldLogout) oldLogout.call($('logoutAdmin'), event);
  };

  const cachedProducts = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}').products || []; } catch (_) { return []; } })();
  askAdminOnDirectAccess().then(async allowed => {
    if (!allowed) return;
    await loadOnline(requestedAdmin || isAdmin());
    if (requestedAdmin && onlineReady && cachedProducts.length && !db.products.length && confirm(`Encontrei ${cachedProducts.length} produto(s) locais. Deseja migrá-los para o banco online?`)) {
      let migrated = 0;
      for (const product of cachedProducts) {
        try { await request('/products', { method: 'POST', body: JSON.stringify({ ...product, id: undefined }) }); migrated++; } catch (error) { console.error(error); }
      }
      await reloadAdmin(); alert(`${migrated} produto(s) migrado(s).`);
    }
  });
})();
