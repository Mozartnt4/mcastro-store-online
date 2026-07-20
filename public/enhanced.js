(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const requestedMode = (params.get('modo') || '').toLowerCase();
  let isAdmin = sessionStorage.getItem('mcastro_admin') === '1';
  let publicMode = !isAdmin && requestedMode !== 'admin';
  let lastPixCode = '';

  function normalizeSettings() {
    db.settings = {
      storeName: 'MCastro Solutions', pixKey: '', whatsapp: '', deliveryFee: 0,
      catalogUrl: '', cloudinaryCloudName: 'fzklkuxa', cloudinaryUploadPreset: 'mcastro_produtos',
      ...(db.settings || {})
    };
  }

  function applyMode() {
    document.body.classList.toggle('public-mode', publicMode);
    document.body.classList.toggle('admin-mode', !publicMode);
    if (publicMode) {
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      $('salesView').classList.add('active');
      $('payment').value = 'Pix';
      $('payment').disabled = true;
      $('discount').value = 0;
      $('discount').closest('label').style.display = 'none';
      $('installments').value = '1';
      $('installments').closest('label').style.display = 'none';
      $('finishSale').textContent = 'Concluir pedido pelo WhatsApp';
    } else {
      $('payment').disabled = false;
      $('discount').closest('label').style.display = '';
      $('installments').closest('label').style.display = '';
      $('finishSale').textContent = 'Finalizar venda';
    }
    renderAll();
  }

  function requireAdmin(targetView) {
    if (isAdmin) return true;
    $('adminLoginModal').dataset.targetView = targetView || 'dashboard';
    $('adminLoginPassword').value = '';
    openM('adminLoginModal');
    setTimeout(() => $('adminLoginPassword').focus(), 80);
    return false;
  }

  document.addEventListener('click', e => {
    const nav = e.target.closest('[data-view]');
    if (!nav) return;
    const view = nav.dataset.view;
    if (view !== 'sales' && !isAdmin) {
      e.preventDefault();
      e.stopImmediatePropagation();
      requireAdmin(view);
    }
  }, true);

  $('adminEntry').onclick = () => requireAdmin('dashboard');
  $('adminLoginForm').onsubmit = e => {
    e.preventDefault();
  
  function renderLocalCatalogStatus(){
    const panel=document.getElementById('localCatalogStatus');
    if(!panel)return;
    const available=(db.products||[]).filter(p=>p.published!==false&&Number(p.stock)>0).length;
    panel.innerHTML=`<strong>${available} produto${available===1?'':'s'} disponível${available===1?'':'is'} no catálogo deste endereço.</strong><br><small>Endereço compartilhado: ${location.origin}. Enquanto não houver banco online, use sempre este mesmo domínio.</small>`;
  }
  const _renderAllLocal=renderAll;
  renderAll=function(){_renderAllLocal();renderLocalCatalogStatus();};
  normalizeSettings();
    if ($('adminLoginPassword').value !== String(db.settings.adminPassword || '1234')) {
      alert('Senha administrativa incorreta.');
      return;
    }
    isAdmin = true;
    publicMode = false;
    sessionStorage.setItem('mcastro_admin', '1');
    const target = $('adminLoginModal').dataset.targetView || 'dashboard';
    closeM();
    applyMode();
    go(target);
  };

  const originalRenderSettings = renderSettings;
  renderSettings = function () {
    normalizeSettings();
    originalRenderSettings();
    $('deliveryFee').value = Number(db.settings.deliveryFee || 0);
    $('adminPassword').value = '';
    $('adminPassword').placeholder = 'Deixe vazio para manter a senha atual';
    $('catalogUrl').value = db.settings.catalogUrl || defaultCatalogUrl();
    if ($('cloudinaryCloudName')) $('cloudinaryCloudName').value = db.settings.cloudinaryCloudName || 'fzklkuxa';
    if ($('cloudinaryUploadPreset')) $('cloudinaryUploadPreset').value = db.settings.cloudinaryUploadPreset || 'mcastro_produtos';
    renderStoreQr();
  };

  $('saveSettings').onclick = () => {
    normalizeSettings();
    const password = $('adminPassword').value.trim();
    if (password && password.length < 6) return alert('A nova senha deve ter pelo menos 6 caracteres.');
    db.settings = {
      ...db.settings,
      storeName: $('storeName').value.trim(),
      pixKey: $('pixKey').value.trim(),
      whatsapp: $('whatsapp').value.trim(),
      deliveryFee: Math.max(0, +$('deliveryFee').value || 0),
      catalogUrl: normalizeCatalogUrl($('catalogUrl').value),
      cloudinaryCloudName: $('cloudinaryCloudName') ? $('cloudinaryCloudName').value.trim() : 'fzklkuxa',
      cloudinaryUploadPreset: $('cloudinaryUploadPreset') ? $('cloudinaryUploadPreset').value.trim() : 'mcastro_produtos'
    };
    save();
    toast('Configurações salvas');
  };


  function defaultCatalogUrl() {
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      return location.origin + location.pathname.replace(/index\.html$/i, '') + '?modo=catalogo';
    }
    return '';
  }
  function normalizeCatalogUrl(value) {
    // Enquanto os produtos usam armazenamento local, administrador e catálogo
    // precisam estar exatamente na mesma origem. Isso evita catálogo vazio
    // quando um QR antigo aponta para outro Worker/domínio.
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('modo', 'catalogo');
    return url.toString();
  }

  function renderStoreQr() {
    if (!$('storeQr')) return;
    const url = normalizeCatalogUrl(($('catalogUrl') && $('catalogUrl').value) || db.settings.catalogUrl);
    $('catalogLink').value = url;
    if ($('catalogUrl')) { $('catalogUrl').value = url; $('catalogUrl').readOnly = true; $('catalogUrl').title = 'Detectado automaticamente para manter o catálogo no mesmo armazenamento do administrador.'; }
    $('storeQr').innerHTML = '';
    if (!url) { $('storeQr').innerHTML = '<small>Publique o site ou informe o link do Netlify.</small>'; return; }
    try { new QRCode($('storeQr'), { text: url, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M }); }
    catch (_) { $('storeQr').innerHTML = '<small>Não foi possível gerar o QR.</small>'; }
  }
  $('catalogUrl').oninput = renderStoreQr;
  $('copyCatalogLink').onclick = async () => {
    const url = $('catalogLink').value;
    if (!url) return alert('Informe o link público do catálogo.');
    try { await navigator.clipboard.writeText(url); toast('Link do catálogo copiado'); }
    catch (_) { $('catalogLink').select(); document.execCommand('copy'); toast('Link do catálogo copiado'); }
  };
  $('shareCatalog').onclick = async () => {
    const url = $('catalogLink').value;
    if (!url) return alert('Informe o link público do catálogo.');
    if (navigator.share) {
      try { await navigator.share({ title: db.settings.storeName || 'Catálogo', text: 'Acesse nosso catálogo:', url }); } catch (_) {}
    } else $('copyCatalogLink').click();
  };
  $('printStoreQr').onclick = () => {
    if (!$('catalogLink').value) return alert('Informe o link público do catálogo.');
    document.body.classList.add('print-store-qr');
    setTimeout(() => { print(); setTimeout(() => document.body.classList.remove('print-store-qr'), 400); }, 50);
  };

  function emv(id, value) { return id + String(value.length).padStart(2, '0') + value; }
  function cleanPixText(value, max) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9 .-]/g, '').toUpperCase().slice(0, max);
  }
  function crc16(payload) {
    let crc = 0xFFFF;
    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }
  function buildPix(total) {
    normalizeSettings();
    const key = String(db.settings.pixKey || '').trim();
    if (!key || total <= 0) return '';
    const gui = emv('00', 'BR.GOV.BCB.PIX');
    const account = emv('26', gui + emv('01', key));
    const name = cleanPixText(db.settings.storeName || 'MCASTRO STORE', 25) || 'MCASTRO STORE';
    const city = 'TERESINA';
    let payload = emv('00', '01') + account + emv('52', '0000') + emv('53', '986') +
      emv('54', Number(total).toFixed(2)) + emv('58', 'BR') + emv('59', name) +
      emv('60', city) + emv('62', emv('05', '***')) + '6304';
    return payload + crc16(payload);
  }

  function checkoutTotals() {
    const subtotal = cart.reduce((sum, item) => {
      const p = db.products.find(x => x.id === item.id);
      return sum + (p ? p.price * item.qty : 0);
    }, 0);
    const fee = publicMode && $('deliveryMethod').value === 'delivery' ? Number(db.settings.deliveryFee || 0) : 0;
    const discount = publicMode ? 0 : Math.max(0, +$('discount').value || 0);
    return { subtotal, fee, discount, total: Math.max(0, subtotal - discount + fee) };
  }

  function renderPublicCheckout() {
    normalizeSettings();
    const t = checkoutTotals();
    $('deliveryFeeDisplay').textContent = money(t.fee);
    $('total').textContent = money(t.total);
    $('pixArea').classList.toggle('open', publicMode && cart.length > 0 && !!db.settings.pixKey);
    $('pixQr').innerHTML = '';
    lastPixCode = buildPix(t.total);
    $('pixCopyPaste').value = lastPixCode;
    if (lastPixCode && window.QRCode) {
      try { new QRCode($('pixQr'), { text: lastPixCode, width: 190, height: 190, correctLevel: QRCode.CorrectLevel.M }); }
      catch (err) { console.error(err); }
    }
  }

  const originalRenderCart = renderCart;
  renderCart = function () {
    originalRenderCart();
    renderPublicCheckout();
  };

  $('deliveryMethod').onchange = () => {
    const delivery = $('deliveryMethod').value === 'delivery';
    $('deliveryFields').classList.toggle('open', delivery);
    $('deliveryAddress').required = delivery;
    renderCart();
  };
  $('copyPix').onclick = async () => {
    if (!lastPixCode) return alert('Cadastre uma chave PIX nas configurações.');
    try { await navigator.clipboard.writeText(lastPixCode); toast('Código PIX copiado'); }
    catch (_) { $('pixCopyPaste').select(); document.execCommand('copy'); toast('Código PIX copiado'); }
  };

  const originalFinish = $('finishSale').onclick;
  $('finishSale').onclick = () => {
    if (!publicMode) return originalFinish();
    if (!cart.length) return alert('Carrinho vazio.');
    normalizeSettings();
    const customerName = $('publicCustomerName').value.trim();
    if (!customerName) return alert('Informe seu nome para concluir o pedido.');
    const delivery = $('deliveryMethod').value === 'delivery';
    const address = $('deliveryAddress').value.trim();
    if (delivery && !address) return alert('Informe o endereço completo para entrega.');
    if (!db.settings.pixKey) return alert('A loja ainda não cadastrou uma chave PIX.');
    const whatsapp = String(db.settings.whatsapp || '').replace(/\D/g, '');
    if (!whatsapp) return alert('A loja ainda não cadastrou o WhatsApp.');

    for (const item of cart) {
      const p = db.products.find(x => x.id === item.id);
      if (!p || item.qty > p.stock) return alert(`Estoque insuficiente para ${p ? p.name : 'um produto'}. Atualize o carrinho.`);
    }

    const t = checkoutTotals();
    const orderId = 'PED-' + Date.now().toString(36).toUpperCase();
    const items = cart.map(item => {
      const p = db.products.find(x => x.id === item.id);
      return { id: p.id, name: p.name, qty: item.qty, price: p.price, cost: p.cost };
    });
    items.forEach(item => { db.products.find(p => p.id === item.id).stock -= item.qty; });
    db.sales.unshift({
      id: orderId, date: new Date().toISOString(), customerId: '', customerName,
      items, total: t.total, cost: items.reduce((s, i) => s + i.cost * i.qty, 0),
      profit: t.total - items.reduce((s, i) => s + i.cost * i.qty, 0),
      payment: 'Pix', installments: 1, status: 'Aguardando comprovante',
      deliveryMethod: delivery ? 'Entrega' : 'Retirada', deliveryFee: t.fee,
      address: delivery ? address : '', mapsLink: delivery ? $('mapsLink').value.trim() : ''
    });
    localStorage.setItem(KEY, JSON.stringify(db));

    const lines = items.map((i, idx) => `${idx + 1}. ${i.name}\n   ${i.qty} × ${money(i.price)} = ${money(i.qty * i.price)}`).join('\n');
    const message = [
      `Olá! Concluí um pedido na ${db.settings.storeName}.`, '',
      `*Pedido:* ${orderId}`, `*Cliente:* ${customerName}`, '',
      '*Produtos:*', lines, '',
      `*Subtotal:* ${money(t.subtotal)}`,
      `*Entrega:* ${delivery ? 'Receber em casa' : 'Retirada na loja'}`,
      `*Taxa de entrega:* ${money(t.fee)}`,
      delivery ? `*Endereço:* ${address}` : '',
      delivery && $('mapsLink').value.trim() ? `*Localização:* ${$('mapsLink').value.trim()}` : '',
      `*TOTAL:* ${money(t.total)}`, '',
      `*Pagamento:* PIX`,
      'Vou anexar o comprovante nesta conversa.'
    ].filter(Boolean).join('\n');

    cart = [];
    $('publicCustomerName').value = '';
    $('deliveryAddress').value = '';
    $('mapsLink').value = '';
    renderAll();
    location.href = `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
  };

  const originalSaleProducts = renderSaleProducts;
  renderSaleProducts = function () {
    originalSaleProducts();
    if (publicMode) {
      document.querySelectorAll('.saleProduct').forEach(btn => {
        const old = btn.innerHTML;
        btn.innerHTML = old + '<small class="publicAddHint">🛒 Adicionar ao carrinho</small>';
      });
    }
  };

  normalizeSettings();
  if (requestedMode === 'admin' && !isAdmin) setTimeout(() => requireAdmin('dashboard'), 120);
  applyMode();
})();

// Ações auxiliares da versão de testes locais.
(() => {
  const preview = document.getElementById('previewCatalog');
  const logout = document.getElementById('logoutAdmin');
  if (preview) preview.addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.set('modo', 'catalogo');
    url.searchParams.delete('produto');
    window.open(url.toString(), '_blank', 'noopener');
  });
  if (logout) logout.addEventListener('click', () => {
    sessionStorage.removeItem('mcastro_admin');
    const url = new URL(location.href);
    url.searchParams.set('modo', 'catalogo');
    url.searchParams.delete('produto');
    location.href = url.toString();
  });
})();


// Evolução v3.0: ficha pública, compartilhamento e carrinho pelo QR individual.
(() => {
  let currentPublicProduct = null;
  const originalShowPublic = window.showPublic;
  window.showPublic = id => {
    currentPublicProduct = db.products.find(x => x.id === id) || null;
    originalShowPublic(id);
    if (!currentPublicProduct) return;
    const add = document.getElementById('addPublicProduct');
    const share = document.getElementById('sharePublicProduct');
    if (add) {
      add.disabled = currentPublicProduct.stock <= 0;
      add.textContent = currentPublicProduct.stock > 0 ? '🛒 Adicionar ao carrinho' : 'Produto esgotado';
      add.onclick = () => {
        if (currentPublicProduct.stock <= 0) return alert('Produto esgotado.');
        window.addCart(currentPublicProduct.id);
        closeM();
        if (typeof go === 'function') go('sales');
        toast('Produto adicionado ao carrinho');
      };
    }
    if (share) share.onclick = async () => {
      const url = new URL(location.href);
      url.searchParams.set('modo', 'catalogo');
      url.searchParams.set('produto', currentPublicProduct.sku);
      const data = { title: currentPublicProduct.name, text: `${currentPublicProduct.name} — ${money(currentPublicProduct.price)}`, url: url.toString() };
      if (navigator.share) {
        try { await navigator.share(data); } catch (_) {}
      } else {
        try { await navigator.clipboard.writeText(data.url); toast('Link do produto copiado'); }
        catch (_) { prompt('Copie o link do produto:', data.url); }
      }
    };
  };

  const oldRenderProducts = renderProducts;
  renderProducts = function () {
    oldRenderProducts();
    document.querySelectorAll('.productCard').forEach(card => {
      const img = card.querySelector('img');
      if (img && /^https:\/\/res\.cloudinary\.com\//i.test(img.src) && !card.querySelector('.cloudBadge')) {
        const badge = document.createElement('span');
        badge.className = 'cloudBadge';
        badge.textContent = '☁ Foto na nuvem';
        const target = img.parentElement || card;
        target.style.position = 'relative';
        target.appendChild(badge);
      }
    });
  };

  // Reprocessa a tela após a substituição das funções.
  renderAll();
})();

// Loja pública intuitiva v3.2
(() => {
  let publicCategory = '';
  const isPublic = () => document.body.classList.contains('public-mode');

  function repairCloudinaryConfig(){
    if(!db.settings) db.settings={};
    const cloud=String(db.settings.cloudinaryCloudName||'').trim();
    // IDs curtos de implantação do Cloudflare não são Cloud Name.
    if(!cloud || /^[a-f0-9]{8}$/i.test(cloud)) db.settings.cloudinaryCloudName='fzklkuxa';
    if(!db.settings.cloudinaryUploadPreset) db.settings.cloudinaryUploadPreset='mcastro_produtos';
    localStorage.setItem(KEY,JSON.stringify(db));
  }

  function renderPublicCategories(){
    const box=document.getElementById('publicCategoryChips');
    if(!box||!isPublic())return;
    const categories=[...new Set((db.products||[]).filter(p=>p.published!==false&&Number(p.stock)>0).map(p=>p.category).filter(Boolean))];
    box.innerHTML=[`<button class="categoryChip ${!publicCategory?'active':''}" data-public-category="">🛍 Todos</button>`,...categories.map(c=>`<button class="categoryChip ${publicCategory===c?'active':''}" data-public-category="${esc(c)}">${categoryIcon(c)} ${esc(c)}</button>`)].join('');
    box.querySelectorAll('[data-public-category]').forEach(b=>b.onclick=()=>{publicCategory=b.dataset.publicCategory||'';renderSaleProducts();});
  }

  const baseRenderSaleProducts=renderSaleProducts;
  renderSaleProducts=function(){
    if(!isPublic()){baseRenderSaleProducts();return;}
    const q=String($('saleSearch').value||'').toLowerCase();
    const a=(db.products||[]).filter(p=>p.published!==false&&Number(p.stock)>0&&(!publicCategory||p.category===publicCategory)&&(p.name+' '+p.sku+' '+p.category+' '+(p.subcategory||'')).toLowerCase().includes(q));
    $('saleProducts').innerHTML=a.length?a.map(p=>`<article class="saleProduct">
      <div onclick="showPublic('${p.id}')" role="button" tabindex="0"><img src="${p.image||blank}" alt="${esc(p.name)}"><small style="position:absolute;left:8px;top:8px;background:rgba(17,24,39,.86);color:white;padding:5px 7px;border-radius:999px">${categoryIcon(p.category)} ${esc(p.category)}</small></div>
      <div class="saleProductContent"><strong>${esc(p.name)}</strong><small>${esc(p.subcategory||p.category)}</small><span>${money(p.price)}</span><small>${p.stock} disponível${p.stock===1?'':'is'}</small><button type="button" class="publicAddHint" onclick="addCart('${p.id}')">🛒 Adicionar</button></div>
    </article>`).join(''):'<div class="empty">Nenhum produto disponível nesta categoria.</div>';
    renderPublicCategories();
  };

  function fullDeliveryAddress(){
    const parts=[
      $('deliveryStreet')?.value.trim(),
      $('deliveryNumber')?.value.trim() ? 'nº '+$('deliveryNumber').value.trim() : '',
      $('deliveryDistrict')?.value.trim(),
      $('deliveryCity')?.value.trim(),
      $('deliveryCep')?.value.trim() ? 'CEP '+$('deliveryCep').value.trim() : '',
      $('deliveryAddress')?.value.trim()
    ].filter(Boolean);
    return parts.join(', ');
  }

  const finish=$('finishSale');
  finish.addEventListener('click', e=>{
    if(!isPublic()) return;
    if(window.mcastroOnlineCheckout) return;
    e.preventDefault();e.stopImmediatePropagation();
    if(!cart.length)return alert('Seu carrinho está vazio.');
    const name=$('publicCustomerName').value.trim();
    const phone=String($('publicCustomerPhone')?.value||'').replace(/\D/g,'');
    const email=String($('publicCustomerEmail')?.value||'').trim();
    if(name.length<3)return alert('Informe seu nome completo.');
    if(phone.length<10)return alert('Informe um WhatsApp válido para contato.');
    const delivery=$('deliveryMethod').value==='delivery';
    const address=fullDeliveryAddress();
    if(delivery){
      if(!$('deliveryStreet').value.trim()||!$('deliveryNumber').value.trim()||!$('deliveryDistrict').value.trim())return alert('Preencha rua, número e bairro para entrega.');
    }
    const storeWhatsapp=String(db.settings.whatsapp||'').replace(/\D/g,'');
    if(!storeWhatsapp)return alert('A loja ainda não cadastrou o WhatsApp.');
    if(!db.settings.pixKey)return alert('A loja ainda não cadastrou a chave PIX.');
    for(const item of cart){const p=db.products.find(x=>x.id===item.id);if(!p||item.qty>p.stock)return alert('O estoque mudou. Atualize o carrinho.');}
    const subtotal=cart.reduce((s,i)=>{const p=db.products.find(x=>x.id===i.id);return s+p.price*i.qty},0);
    const fee=delivery?Number(db.settings.deliveryFee||0):0;
    const total=subtotal+fee;
    const orderId='PED-'+Date.now().toString(36).toUpperCase();
    const items=cart.map(i=>{const p=db.products.find(x=>x.id===i.id);return{id:p.id,name:p.name,qty:i.qty,price:p.price,cost:p.cost||0}});
    items.forEach(i=>{const p=db.products.find(x=>x.id===i.id);p.stock-=i.qty});
    let customer=db.customers.find(c=>String(c.phone||'').replace(/\D/g,'')===phone);
    if(!customer){customer={id:uid(),name,phone,email,address:delivery?address:''};db.customers.push(customer)}else{Object.assign(customer,{name,phone,email,address:delivery?address:customer.address})}
    db.sales.unshift({id:orderId,date:new Date().toISOString(),customerId:customer.id,customerName:name,customerPhone:phone,customerEmail:email,items,total,cost:items.reduce((s,i)=>s+i.cost*i.qty,0),profit:total-items.reduce((s,i)=>s+i.cost*i.qty,0),payment:'Pix',installments:1,status:'Aguardando comprovante',deliveryMethod:delivery?'Entrega':'Retirada',deliveryFee:fee,address:delivery?address:'',mapsLink:delivery?$('mapsLink').value.trim():''});
    localStorage.setItem(KEY,JSON.stringify(db));
    const lines=items.map((i,n)=>`${n+1}. ${i.name}\n   ${i.qty} × ${money(i.price)} = ${money(i.qty*i.price)}`).join('\n');
    const msg=[`Olá! Quero concluir meu pedido na ${db.settings.storeName||'MCastro Solutions'}.`,'',`*Pedido:* ${orderId}`,`*Cliente:* ${name}`,`*WhatsApp:* ${phone}`,email?`*E-mail:* ${email}`:'','', '*Produtos:*',lines,'',`*Subtotal:* ${money(subtotal)}`,`*Entrega:* ${delivery?'Receber em casa':'Retirada na loja'}`,`*Taxa:* ${money(fee)}`,delivery?`*Endereço:* ${address}`:'',delivery&&$('mapsLink').value.trim()?`*Mapa:* ${$('mapsLink').value.trim()}`:'',`*TOTAL:* ${money(total)}`,'', 'Pagamento via PIX. Vou anexar o comprovante nesta conversa.'].filter(Boolean).join('\n');
    cart=[];renderAll();
    location.href=`https://wa.me/${storeWhatsapp}?text=${encodeURIComponent(msg)}`;
  },true);

  const oldApply = window.renderAll;
  renderAll=function(){oldApply();if($('publicStoreName'))$('publicStoreName').textContent=db.settings.storeName||'MCastro Solutions';renderPublicCategories();};
  repairCloudinaryConfig();
  renderAll();
})();
