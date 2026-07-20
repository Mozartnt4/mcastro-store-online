window.addEventListener('error',function(e){var box=document.getElementById('systemError');if(box){box.style.display='block';box.textContent='Erro do sistema: '+(e.message||'falha ao carregar')+' — atualize a página.';}});
const KEY='mcastro_store_qr_v21';const APP_VERSION='3.2';
const blank='data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="350"><rect width="100%" height="100%" fill="#eef2f7"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#94a3b8" font-family="Arial" font-size="26">Sem foto</text></svg>`);
let db={products:[],customers:[],sales:[],cash:[],settings:{storeName:'MCastro Solutions',pixKey:'',whatsapp:'',cloudinaryCloudName:'fzklkuxa',cloudinaryUploadPreset:'mcastro_produtos'}},cart=[],photo='',labelProduct=null;
const $=id=>document.getElementById(id),money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7),esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const categoryCatalog={
'Celulares e Acessórios':{code:'CEL',icon:'📱',margin:45,unit:'Unidade',subs:['Smartphone','Celular básico','Capa','Película','Carregador','Cabo','Suporte','Acessório']},
'TV Box e Streaming':{code:'TVB',icon:'📺',margin:50,unit:'Unidade',subs:['TV Box','Stick de streaming','Controle remoto','Conversor digital','Cabo HDMI','Adaptador','Acessório']},
'Eletrônicos':{code:'ELE',icon:'🔌',margin:45,unit:'Unidade',subs:['Carregador','Cabo USB','Fonte','Fone de ouvido','Caixa de som','Smartwatch','Adaptador','Acessório']},
'Áudio e Vídeo':{code:'AUD',icon:'🎧',margin:50,unit:'Unidade',subs:['Fone de ouvido','Caixa de som','Microfone','Headset','Projetor','Cabo de áudio','Acessório']},
'Informática':{code:'INF',icon:'💻',margin:40,unit:'Unidade',subs:['Notebook','Computador','Mouse','Teclado','SSD','HD','Memória','Roteador','Impressora','Acessório']},
'Casa Inteligente':{code:'CIN',icon:'🏡',margin:50,unit:'Unidade',subs:['Lâmpada inteligente','Câmera Wi-Fi','Tomada inteligente','Sensor','Fechadura','Automação','Acessório']},
'Saúde':{code:'SAU',icon:'🩺',margin:45,unit:'Unidade',subs:['Equipamento','Monitoramento','Ortopédico','Higiene','Descartável']},
'Saúde e Beleza':{code:'BEL',icon:'💄',margin:70,unit:'Unidade',subs:['Maquiagem','Cabelo','Pele','Higiene pessoal','Unhas','Barbear','Depilação']},
'Perfumes':{code:'PER',icon:'🌸',margin:80,unit:'Unidade',subs:['Perfume feminino','Perfume masculino','Perfume unissex','Body splash','Kit presente','Importado','Nacional']},
'Cuidados Pessoais':{code:'CUI',icon:'🧴',margin:65,unit:'Unidade',subs:['Corpo','Rosto','Cabelo','Barba','Higiene bucal','Desodorante','Kit']},
'Bem-estar':{code:'BEM',icon:'🌿',margin:55,unit:'Unidade',subs:['Massagem','Relaxamento','Aromaterapia','Fitness','Acessório','Outros']},
'Ótica':{code:'OPT',icon:'👓',margin:100,unit:'Unidade',subs:['Armação','Lente','Óculos solar','Estojo','Flanela','Spray','Cordão','Acessório']},
'Casa':{code:'CAS',icon:'🏠',margin:50,unit:'Unidade',subs:['Utilidades','Organização','Decoração','Cozinha','Banho','Iluminação']},
'Automotivo':{code:'AUT',icon:'🚗',margin:45,unit:'Unidade',subs:['Peça','Acessório','Iluminação','Som','Limpeza','Ferramenta']},
'Moda':{code:'MOD',icon:'👕',margin:80,unit:'Unidade',subs:['Camisa','Calça','Vestido','Short','Roupa íntima','Acessório']},
'Calçados':{code:'CAL',icon:'👟',margin:75,unit:'Par',subs:['Tênis','Sandália','Sapato','Chinelo','Bota','Infantil']},
'Relógios':{code:'REL',icon:'⌚',margin:60,unit:'Unidade',subs:['Masculino','Feminino','Smartwatch','Pulseira','Acessório']},
'Papelaria':{code:'PAP',icon:'📚',margin:60,unit:'Unidade',subs:['Caderno','Caneta','Material escolar','Escritório','Organização']},
'Presentes':{code:'PRE',icon:'🎁',margin:70,unit:'Unidade',subs:['Caneca','Cesta','Pelúcia','Personalizado','Lembrança']},
'Outros':{code:'OUT',icon:'📦',margin:50,unit:'Unidade',subs:['Geral']}
};
const cats=Object.fromEntries(Object.entries(categoryCatalog).map(([k,v])=>[k,v.code]));
let selectedCatalogCategory='';
function save(){localStorage.setItem(KEY,JSON.stringify(db));renderAll()}function load(){try{const x=JSON.parse(localStorage.getItem(KEY));if(x)db={...db,...x}}catch(e){}renderAll();checkPublicLink()}function toast(t){$('toast').textContent=t;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2200)}function openM(id){$(id).classList.add('open')}function closeM(){document.querySelectorAll('.modal').forEach(m=>m.classList.remove('open'))}document.querySelectorAll('.close').forEach(b=>b.onclick=closeM);document.querySelectorAll('.modal').forEach(m=>m.onclick=e=>{if(e.target===m)closeM()});
const titles={dashboard:['Dashboard','Visão geral do seu negócio'],products:['Produtos','Cadastro, QR Code e etiquetas'],sales:['Vendas','Carrinho e baixa automática de estoque'],customers:['Clientes','Cadastro e histórico'],cash:['Caixa','Entradas, saídas e capital de reposição'],settings:['Backup','Configurações e proteção dos dados']};
function go(v){document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));$(v+'View').classList.add('active');document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v));$('title').textContent=titles[v][0];$('subtitle').textContent=titles[v][1];renderAll();scrollTo(0,0)}document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>go(b.dataset.view));
function categoryOptions(){return Object.entries(categoryCatalog).map(([c,v])=>`<option value="${esc(c)}">${v.icon} ${esc(c)}</option>`).join('')}$('pCategory').innerHTML=categoryOptions();
function updateSubcategories(selected=''){
  const category=$('pCategory').value;
  const info=categoryCatalog[category]||categoryCatalog.Outros;
  $('pSubcategory').innerHTML='<option value="">Selecione uma subcategoria</option>'+info.subs.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  if(selected)$('pSubcategory').value=selected;
  if(!$('productId').value){
    $('pUnit').value=info.unit||'Unidade';
    $('pMargin').value=info.margin||50;
  }
}
function categoryIcon(category){return categoryCatalog[category]?.icon||'📦'}
function nextSku(category){const code=cats[category]||'OUT',nums=db.products.filter(p=>p.sku.startsWith('MC-'+code+'-')).map(p=>+p.sku.split('-').pop()).filter(Number.isFinite);return `MC-${code}-${String((Math.max(0,...nums)+1)).padStart(6,'0')}`}
function stockBadge(p){return p.stock<=0?'<span class="badge red">Sem estoque</span>':p.stock<=p.min?`<span class="badge orange">${p.stock} un. · baixo</span>`:`<span class="badge green">${p.stock} un.</span>`}
function openProduct(id=''){ $('productForm').reset();$('productId').value='';$('productModalTitle').textContent='Novo produto';photo='';$('photoPreview').src=blank;if($('photoUploadStatus'))setPhotoStatus('Nenhuma foto selecionada.','');$('pCategory').innerHTML=categoryOptions();$('pCategory').value='Celulares e Acessórios';updateSubcategories();$('pSku').value=nextSku('Celulares e Acessórios');$('pMargin').value=categoryCatalog['Celulares e Acessórios'].margin;$('pUnit').value=categoryCatalog['Celulares e Acessórios'].unit;$('pMin').value=3;if(id){const p=db.products.find(x=>x.id===id);$('productModalTitle').textContent='Editar produto';$('productId').value=p.id;$('pName').value=p.name;$('pCategory').value=p.category;updateSubcategories(p.subcategory||'');$('pUnit').value=p.unit||categoryCatalog[p.category]?.unit||'Unidade';$('pSku').value=p.sku;$('pBrand').value=p.brand||'';$('pModel').value=p.model||'';$('pWarranty').value=String(p.warranty||0);$('pSupplier').value=p.supplier||'';$('pLocation').value=p.location||'';$('pCost').value=p.cost;$('pMargin').value=p.margin||0;$('pPrice').value=p.price;$('pStock').value=p.stock;$('pMin').value=p.min;photo=p.image||'';$('photoPreview').src=p.image||blank;if($('photoUploadStatus'))setPhotoStatus(photo?'✓ Foto já vinculada ao produto.':'Nenhuma foto selecionada.',photo?'success':'');calcProfit()}openM('productModal')}
$('newProduct').onclick=()=>openProduct();$('quickProduct').onclick=()=>openProduct();$('pCategory').onchange=()=>{updateSubcategories();if(!$('productId').value){$('pSku').value=nextSku($('pCategory').value);const info=categoryCatalog[$('pCategory').value]||categoryCatalog.Outros;$('pMargin').value=info.margin;const cost=+$('pCost').value||0;if(cost)$('pPrice').value=(cost*(1+info.margin/100)).toFixed(2);calcProfit()}};$('pCost').oninput=()=>{if(!$('productId').value||!+$('pPrice').value){$('pPrice').value=((+$('pCost').value||0)*(1+(+$('pMargin').value||0)/100)).toFixed(2)}calcProfit()};$('pMargin').oninput=()=>{$('pPrice').value=((+$('pCost').value||0)*(1+(+$('pMargin').value||0)/100)).toFixed(2);calcProfit()};$('pPrice').oninput=calcProfit;function calcProfit(){$('pProfit').value=money((+$('pPrice').value||0)-(+$('pCost').value||0))}
let photoUploading=false;
function setPhotoStatus(message,type=''){const el=$('photoUploadStatus');if(!el)return;el.textContent=message;el.className='uploadStatus '+type}
function setProductSaving(disabled){const b=$('saveProductButton');if(b){b.disabled=disabled;b.textContent=disabled?'Enviando foto...':'Salvar produto'}}
function canvasBlob(canvas){return new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.82))}
async function uploadPhotoToCloudinary(blob,filename='produto.jpg'){
  const cloud=String(db.settings?.cloudinaryCloudName||'fzklkuxa').trim();
  const preset=String(db.settings?.cloudinaryUploadPreset||'mcastro_produtos').trim();
  if(!cloud||!preset)throw new Error('Configure o Cloud Name e o Upload Preset.');
  const data=new FormData();data.append('file',blob,filename);data.append('upload_preset',preset);
  const response=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`,{method:'POST',body:data});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.secure_url)throw new Error(result?.error?.message||'Falha no envio da imagem.');
  return {url:result.secure_url,publicId:result.public_id||'',width:result.width||0,height:result.height||0,format:result.format||'',bytes:result.bytes||0};
}
async function photoFile(f){
  if(!f)return;
  if(!/^image\//.test(f.type||'')){alert('Escolha um arquivo de imagem.');return}
  photoUploading=true;setProductSaving(true);setPhotoStatus('Preparando e enviando a foto para a nuvem...','uploading');
  try{
    const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f)});
    const im=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=dataUrl});
    let w=im.width,h=im.height,max=1400;if(w>h&&w>max){h=Math.round(h*max/w);w=max}else if(h>max){w=Math.round(w*max/h);h=max}
    const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);
    $('photoPreview').src=c.toDataURL('image/jpeg',.78);
    const blob=await canvasBlob(c);if(!blob)throw new Error('Não foi possível preparar a imagem.');
    const uploaded=await uploadPhotoToCloudinary(blob,f.name||'produto.jpg');
    photo=uploaded.url;
    $('photoPreview').src=photo;setPhotoStatus('✓ Foto salva no Cloudinary e disponível para o catálogo.','success');toast('Foto enviada para a nuvem');
  }catch(err){console.error(err);photo='';$('photoPreview').src=blank;setPhotoStatus('Falha no envio: '+(err.message||'verifique a internet e tente novamente.'),'error');alert('Não foi possível enviar a foto ao Cloudinary. Verifique a internet e as configurações.');
  }finally{photoUploading=false;setProductSaving(false);$('camera').value='';$('gallery').value=''}
}
$('camera').onchange=e=>photoFile(e.target.files[0]);$('gallery').onchange=e=>photoFile(e.target.files[0]);$('removePhoto').onclick=()=>{if(photoUploading)return;photo='';$('photoPreview').src=blank;setPhotoStatus('Foto removida.','')};
async function testCloudinaryUpload(file){
  if(!file)return;
  const status=$('cloudinaryTestStatus'),preview=$('cloudinaryTestPreview'),urlBox=$('cloudinaryTestUrl'),copyBtn=$('copyCloudinaryTestUrl'),openBtn=$('openCloudinaryTestUrl');
  status.textContent='Enviando imagem de teste para o Cloudinary...';status.className='uploadStatus uploading';
  preview.hidden=true;urlBox.value='';copyBtn.disabled=true;openBtn.disabled=true;
  try{
    const uploaded=await uploadPhotoToCloudinary(file,file.name||'teste-mcastro.jpg');
    preview.src=uploaded.url;preview.hidden=false;urlBox.value=uploaded.url;copyBtn.disabled=false;openBtn.disabled=false;
    const size=uploaded.bytes?` · ${(uploaded.bytes/1024).toFixed(1)} KB`:'';
    status.textContent=`✓ Imagem enviada com sucesso para mcastro/produtos${size}.`;
    status.className='uploadStatus success';toast('Cloudinary conectado com sucesso');
  }catch(err){
    console.error(err);status.textContent='Falha no teste: '+(err.message||'erro desconhecido');status.className='uploadStatus error';
  }finally{$('cloudinaryTestFile').value=''}
}
if($('cloudinaryTestFile'))$('cloudinaryTestFile').onchange=e=>testCloudinaryUpload(e.target.files[0]);
if($('copyCloudinaryTestUrl'))$('copyCloudinaryTestUrl').onclick=async()=>{const url=$('cloudinaryTestUrl').value.trim();if(!url)return;try{await navigator.clipboard.writeText(url);toast('Link da imagem copiado')}catch(e){$('cloudinaryTestUrl').select();document.execCommand('copy');toast('Link da imagem copiado')}};
if($('openCloudinaryTestUrl'))$('openCloudinaryTestUrl').onclick=()=>{const url=$('cloudinaryTestUrl').value.trim();if(url)window.open(url,'_blank','noopener')};
$('productForm').onsubmit=e=>{e.preventDefault();if(photoUploading)return alert('Aguarde o envio da foto terminar.');const p={id:$('productId').value||uid(),name:$('pName').value.trim(),category:$('pCategory').value,subcategory:$('pSubcategory').value,unit:$('pUnit').value,sku:$('pSku').value,brand:$('pBrand').value.trim(),model:$('pModel').value.trim(),warranty:+$('pWarranty').value,supplier:$('pSupplier').value.trim(),location:$('pLocation').value.trim(),cost:+$('pCost').value,margin:+$('pMargin').value,price:+$('pPrice').value,stock:+$('pStock').value,min:+$('pMin').value,image:photo,published:true,updatedAt:new Date().toISOString(),createdAt:new Date().toISOString()};if(!p.name)return alert('Informe o nome do produto.');if(!(p.price>0))return alert('Informe um preço de venda maior que zero.');if(!(p.stock>=0))return alert('Informe o estoque.');const i=db.products.findIndex(x=>x.id===p.id);i>=0?db.products[i]=p:db.products.push(p);save();closeM();toast('Produto salvo e QR disponível')};
window.editProduct=openProduct;window.deleteProduct=id=>{if(confirm('Excluir produto?')){db.products=db.products.filter(p=>p.id!==id);save()}};
function renderCategoryChips(){
  const counts={};
  db.products.forEach(p=>counts[p.category]=(counts[p.category]||0)+1);
  const categories=Object.keys(categoryCatalog).filter(c=>counts[c]);
  $('categoryChips').innerHTML=
    `<button class="categoryChip ${selectedCatalogCategory===''?'active':''}" onclick="setCatalogCategory('')">✨ Todos <small>${db.products.length}</small></button>`+
    categories.map(c=>`<button class="categoryChip ${selectedCatalogCategory===c?'active':''}" onclick="setCatalogCategory('${esc(c)}')">${categoryIcon(c)} ${esc(c)} <small>${counts[c]}</small></button>`).join('');
}
window.setCatalogCategory=category=>{selectedCatalogCategory=category;renderProducts()};
function renderProducts(){
  const q=$('productSearch').value.toLowerCase(),f=$('stockFilter').value,sort=$('sortProducts').value;
  let a=db.products.filter(p=>(p.name+' '+p.sku+' '+p.category+' '+(p.subcategory||'')+' '+(p.brand||'')+' '+(p.model||'')).toLowerCase().includes(q));
  if(selectedCatalogCategory)a=a.filter(p=>p.category===selectedCatalogCategory);
  if(f==='low')a=a.filter(p=>p.stock>0&&p.stock<=p.min);
  if(f==='zero')a=a.filter(p=>p.stock<=0);
  if(sort==='name')a.sort((x,y)=>x.name.localeCompare(y.name,'pt-BR'));
  if(sort==='newest')a.sort((x,y)=>new Date(y.createdAt||0)-new Date(x.createdAt||0));
  if(sort==='priceAsc')a.sort((x,y)=>x.price-y.price);
  if(sort==='priceDesc')a.sort((x,y)=>y.price-x.price);
  if(sort==='stock')a.sort((x,y)=>y.stock-x.stock);
  const stockValue=a.reduce((s,p)=>s+p.cost*p.stock,0);
  $('catalogCount').textContent=`${a.length} produto${a.length===1?'':'s'}`;
  $('catalogValue').textContent=`${money(stockValue)} em estoque`;
  renderCategoryChips();
  $('productGrid').innerHTML=a.length?a.map(p=>`<article class="productCard">
    <div class="productImageWrap">
      <img src="${p.image||blank}" alt="${esc(p.name)}">
      <span class="categoryFlag">${categoryIcon(p.category)} ${esc(p.category)}</span>
      <span class="stockFlag">${stockBadge(p)}</span>
    </div>
    <div class="productBody">
      <h3>${esc(p.name)}</h3>
      <p class="productSku">${esc(p.sku)}</p>
      <div class="productMetaGrid">
        <span title="Subcategoria">▸ ${esc(p.subcategory||'Geral')}</span>
        <span title="Marca">◆ ${esc(p.brand||'Sem marca')}</span>
        <span title="Modelo">◉ ${esc(p.model||'Sem modelo')}</span>
        <span title="Unidade">▦ ${esc(p.unit||'Unidade')}</span>
      </div>
      <div class="productFooter">
        <div class="productPriceBox"><small>Preço de venda</small><div class="price">${money(p.price)}</div></div>
        <span class="productProfit">+ ${money(p.price-p.cost)} / un.</span>
      </div>
      <div class="productActions">
        <button class="qrAction" onclick="showLabel('${p.id}')">▦ QR / Etiqueta</button>
        <button onclick="showPublic('${p.id}')">Ver ficha</button>
        <button onclick="editProduct('${p.id}')">Editar</button>
        <button onclick="deleteProduct('${p.id}')">Excluir</button>
      </div>
    </div>
  </article>`).join(''):'<div class="catalogEmpty">Nenhum produto encontrado para este filtro.</div>';
}
$('productSearch').oninput=renderProducts;
$('stockFilter').onchange=renderProducts;
$('sortProducts').onchange=renderProducts;
function publicUrl(p){return location.origin+location.pathname+'?produto='+encodeURIComponent(p.sku)}
window.showLabel=id=>{labelProduct=db.products.find(p=>p.id===id);if(!labelProduct)return;$('labelSize').value='25x25';$('labelQty').value=1;renderLabel();openM('labelModal')};
function renderLabel(){if(!labelProduct)return;const s=$('labelSize').value,el=$('labelPreview');el.className='productLabel '+(s==='25x25'?'size-p':s==='40x30'?'size-m':'size-g');$('labelQr').innerHTML='';$('labelName').textContent=labelProduct.name;$('labelSku').textContent=labelProduct.sku;$('labelPrice').textContent=money(labelProduct.price);try{if(window.QRCode)new QRCode($('labelQr'),{text:publicUrl(labelProduct),width:220,height:220,correctLevel:QRCode.CorrectLevel.M});else $('labelQr').innerHTML='<small>Gerador QR indisponível</small>'}catch(err){console.error(err);$('labelQr').innerHTML='<small>Não foi possível gerar o QR</small>'}}
$('labelSize').onchange=renderLabel;$('openPublic').onclick=()=>showPublic(labelProduct.id);
window.showPublic=id=>{const p=db.products.find(x=>x.id===id);if(!p)return;$('publicImage').src=p.image||blank;$('publicName').textContent=p.name;$('publicPrice').textContent=money(p.price);$('publicDetails').innerHTML=`<div><b>SKU</b><br>${esc(p.sku)}</div><div><b>Categoria</b><br>${categoryIcon(p.category)} ${esc(p.category)}</div><div><b>Subcategoria</b><br>${esc(p.subcategory||'Geral')}</div><div><b>Unidade</b><br>${esc(p.unit||'Unidade')}</div><div><b>Marca</b><br>${esc(p.brand||'Não informada')}</div><div><b>Modelo</b><br>${esc(p.model||'Não informado')}</div><div><b>Garantia</b><br>${p.warranty?p.warranty+' dias':'Não informada'}</div><div><b>Disponibilidade</b><br>${p.stock>0?'Disponível':'Indisponível'}</div>`;$('buyWhatsapp').onclick=()=>{const num=(db.settings.whatsapp||'').replace(/\D/g,''),msg=encodeURIComponent(`Olá! Quero comprar:\n${p.name}\nSKU: ${p.sku}\nPreço: ${money(p.price)}`);location.href=num?`https://wa.me/${num}?text=${msg}`:`https://wa.me/?text=${msg}`};openM('publicModal')};
function checkPublicLink(){const sku=new URLSearchParams(location.search).get('produto');if(sku){const p=db.products.find(x=>x.sku===sku);if(p)setTimeout(()=>showPublic(p.id),250)}}
$('printLabel').onclick=()=>{if(!labelProduct)return;const qty=Math.min(200,Math.max(1,+$('labelQty').value||1)),size=$('labelSize').value,sheet=document.createElement('div');sheet.className='print-sheet '+(size==='25x25'?'size-p-sheet':size==='40x30'?'size-m-sheet':'size-g-sheet');for(let i=0;i<qty;i++){const clone=$('labelPreview').cloneNode(true);clone.removeAttribute('id');sheet.appendChild(clone)}document.body.appendChild(sheet);setTimeout(()=>{print();setTimeout(()=>sheet.remove(),500)},150)};
function renderSaleProducts(){const q=$('saleSearch').value.toLowerCase(),a=db.products.filter(p=>p.published!==false&&p.stock>0&&(p.name+' '+p.sku).toLowerCase().includes(q));$('saleProducts').innerHTML=a.length?a.map(p=>`<button class="saleProduct" onclick="addCart('${p.id}')"><div style="position:relative"><img src="${p.image||blank}"><small style="position:absolute;left:6px;top:6px;background:rgba(17,24,39,.82);color:white;padding:4px 6px;border-radius:999px">${categoryIcon(p.category)}</small></div><strong>${esc(p.name)}</strong><small>${esc(p.subcategory||p.category)}</small><span>${money(p.price)}</span><small>${p.stock} em estoque</small></button>`).join(''):'<div class="empty">Nenhum produto disponível.</div>'}
window.addCart=id=>{const p=db.products.find(x=>x.id===id),i=cart.find(x=>x.id===id);if(i){if(i.qty>=p.stock)return toast('Limite do estoque');i.qty++}else cart.push({id,qty:1});renderCart()};window.qty=(id,d)=>{const p=db.products.find(x=>x.id===id),i=cart.find(x=>x.id===id);i.qty+=d;if(i.qty<=0)cart=cart.filter(x=>x.id!==id);if(i.qty>p.stock)i.qty=p.stock;renderCart()};
function renderCart(){$('cartList').innerHTML=cart.length?cart.map(i=>{const p=db.products.find(x=>x.id===i.id);return `<div class="cartItem"><div><b>${esc(p.name)}</b><small>${money(p.price)} × ${i.qty}</small></div><div class="qty"><button onclick="qty('${i.id}',-1)">−</button><b>${i.qty}</b><button onclick="qty('${i.id}',1)">+</button></div></div>`}).join(''):'<div class="empty">Carrinho vazio.</div>';const sub=cart.reduce((s,i)=>s+db.products.find(p=>p.id===i.id).price*i.qty,0),tot=Math.max(0,sub-(+$('discount').value||0)),ins=Math.max(1,+$('installments').value||1);$('cartCount').textContent=cart.reduce((s,i)=>s+i.qty,0)+' itens';$('subtotal').textContent=money(sub);$('total').textContent=money(tot);$('installmentValue').textContent=money(tot/ins)}
$('saleSearch').oninput=renderSaleProducts;$('clearCart').onclick=()=>{cart=[];renderCart()};$('discount').oninput=renderCart;$('installments').onchange=renderCart;$('payment').onchange=()=>{const av=$('payment').value==='À vista';$('installments').innerHTML=av?'<option value="1">1x</option>':Array.from({length:12},(_,i)=>`<option value="${i+1}">${i+1}x</option>`).join('');renderCart()};
$('finishSale').onclick=()=>{if(!cart.length)return alert('Carrinho vazio.');const items=cart.map(i=>{const p=db.products.find(x=>x.id===i.id);return{id:p.id,name:p.name,qty:i.qty,price:p.price,cost:p.cost}}),sub=items.reduce((s,i)=>s+i.price*i.qty,0),tot=Math.max(0,sub-(+$('discount').value||0)),cost=items.reduce((s,i)=>s+i.cost*i.qty,0),sale={id:uid(),date:new Date().toISOString(),customerId:$('saleCustomer').value,items,total:tot,cost,profit:tot-cost,payment:$('payment').value,installments:+$('installments').value};items.forEach(i=>db.products.find(p=>p.id===i.id).stock-=i.qty);db.sales.unshift(sale);db.cash.unshift({id:uid(),date:sale.date,type:'in',description:'Venda '+sale.id.slice(-6).toUpperCase(),value:tot,method:sale.payment,saleId:sale.id});cart=[];$('discount').value=0;save();toast('Venda concluída');go('dashboard')};
function openCustomer(id=''){$('customerForm').reset();$('cId').value='';if(id){const c=db.customers.find(x=>x.id===id);$('cId').value=c.id;$('cName').value=c.name;$('cPhone').value=c.phone;$('cCpf').value=c.cpf;$('cAddress').value=c.address}openM('customerModal')}$('newCustomer').onclick=()=>openCustomer();$('customerForm').onsubmit=e=>{e.preventDefault();const c={id:$('cId').value||uid(),name:$('cName').value.trim(),phone:$('cPhone').value.trim(),cpf:$('cCpf').value.trim(),address:$('cAddress').value.trim()};const i=db.customers.findIndex(x=>x.id===c.id);i>=0?db.customers[i]=c:db.customers.push(c);save();closeM();toast('Cliente salvo')};window.editCustomer=openCustomer;function renderCustomers(){const q=$('customerSearch').value.toLowerCase(),a=db.customers.filter(c=>(c.name+' '+c.phone).toLowerCase().includes(q));$('customerGrid').innerHTML=a.length?a.map(c=>`<article class="customerCard"><div class="avatar">${esc(c.name.slice(0,2).toUpperCase())}</div><h3>${esc(c.name)}</h3><p>${esc(c.phone||'Sem telefone')}</p><p>${esc(c.address||'Sem endereço')}</p><button class="secondary" onclick="editCustomer('${c.id}')">Editar</button></article>`).join(''):'<div class="empty">Nenhum cliente.</div>';$('saleCustomer').innerHTML='<option value="">Consumidor não identificado</option>'+db.customers.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}$('customerSearch').oninput=renderCustomers;
$('newCash').onclick=()=>{$('cashForm').reset();$('mDate').value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);openM('cashModal')};$('cashForm').onsubmit=e=>{e.preventDefault();db.cash.unshift({id:uid(),date:new Date($('mDate').value).toISOString(),type:$('mType').value==='in'?'in':'out',subtype:$('mType').value,description:$('mDescription').value.trim(),value:+$('mValue').value,method:$('mMethod').value});save();closeM();toast('Lançamento salvo')};
function renderCash(){const ins=db.cash.filter(c=>c.type==='in').reduce((s,c)=>s+c.value,0),outs=db.cash.filter(c=>c.type==='out').reduce((s,c)=>s+c.value,0);$('cashIn').textContent=money(ins);$('cashOut').textContent=money(outs);$('cashBalance').textContent=money(ins-outs);$('replacement').textContent=money(db.sales.filter(s=>s.status==='concluido'||!s.status).reduce((s,v)=>s+v.cost,0));$('cashList').innerHTML=db.cash.length?db.cash.map(c=>`<div class="listRow"><div><b>${esc(c.description)}</b><small>${new Date(c.date).toLocaleString('pt-BR')} · ${esc(c.method)}</small></div><strong style="color:${c.type==='in'?'#059669':'#dc2626'}">${c.type==='in'?'+':'-'} ${money(c.value)}</strong></div>`).join(''):'<div class="empty">Nenhuma movimentação.</div>'}
window.completeSale=window.completeSale||function(id){const sale=db.sales.find(s=>s.id===id);if(!sale||sale.status==='concluido')return;if(!confirm('Confirmar esta venda?'))return;for(const item of sale.items){const p=db.products.find(x=>x.id===item.id);if(!p||p.stock<item.qty)return alert('Estoque insuficiente para concluir a venda.')}sale.items.forEach(item=>db.products.find(p=>p.id===item.id).stock-=item.qty);sale.status='concluido';db.cash.unshift({id:uid(),date:new Date().toISOString(),type:'in',description:'Venda '+sale.id,value:sale.total,method:sale.payment,saleId:sale.id});save();toast('Venda concluída')};
function renderDashboard(){const completed=db.sales.filter(s=>s.status==='concluido'||!s.status),revenue=completed.reduce((s,v)=>s+v.total,0),profit=completed.reduce((s,v)=>s+v.profit,0),stock=db.products.reduce((s,p)=>s+p.cost*p.stock,0),cash=db.cash.reduce((s,c)=>s+(c.type==='in'?c.value:-c.value),0),low=db.products.filter(p=>p.stock<=p.min);$('heroRevenue').textContent=money(revenue);$('statProducts').textContent=db.products.length;$('statLow').textContent=low.length+' alertas';$('statStock').textContent=money(stock);$('statProfit').textContent=money(profit);$('statCash').textContent=money(cash);$('lowList').innerHTML=low.length?low.slice(0,6).map(p=>`<div class="listRow"><div><b>${esc(p.name)}</b><small>${esc(p.sku)}</small></div>${stockBadge(p)}</div>`).join(''):'<div class="empty">Estoque sob controle.</div>';$('recentSales').innerHTML=db.sales.length?db.sales.slice(0,10).map(s=>{const pending=s.status==='aguardando_comprovante';return `<div class="listRow"><div><b>Pedido ${esc(s.id)}</b><small>${esc(s.customerName||'Cliente')} · ${new Date(s.date).toLocaleString('pt-BR')} · ${pending?'Aguardando comprovante':'Concluída'}</small></div><div><strong>${money(s.total)}</strong>${pending?`<button class="primary" style="display:block;margin-top:6px" onclick="completeSale('${esc(s.id)}')">Venda concluída</button>`:''}</div></div>`}).join(''):'<div class="empty">Nenhuma venda.</div>'}
$('saveSettings').onclick=()=>{db.settings={storeName:$('storeName').value.trim(),pixKey:$('pixKey').value.trim(),whatsapp:$('whatsapp').value.trim()};save();toast('Configurações salvas')};$('backup').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:'application/json'}));a.download='backup-mcastro-'+new Date().toISOString().slice(0,10)+'.json';a.click()};$('restore').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{db=JSON.parse(r.result);save();toast('Backup restaurado')}catch(e){alert('Arquivo inválido')}};r.readAsText(f)};
function renderSettings(){$('storeName').value=db.settings.storeName||'';$('pixKey').value=db.settings.pixKey||'';$('whatsapp').value=db.settings.whatsapp||'';if($('cloudinaryCloudName'))$('cloudinaryCloudName').value=db.settings.cloudinaryCloudName||'fzklkuxa';if($('cloudinaryUploadPreset'))$('cloudinaryUploadPreset').value=db.settings.cloudinaryUploadPreset||'mcastro_produtos'}
function renderAll(){renderProducts();renderSaleProducts();renderCart();renderCustomers();renderCash();renderDashboard();renderSettings()}load();if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js'));
