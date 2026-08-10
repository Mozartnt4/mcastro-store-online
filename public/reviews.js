// Avaliações públicas de produtos — persistidas no Cloudflare D1.
(() => {
  let activeProductId = '';
  const $id = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  const stars = rating => `<span class="reviewStars" aria-label="${rating} de 5 estrelas">${'★'.repeat(Math.round(rating))}${'☆'.repeat(5-Math.round(rating))}</span>`;
  const formatDate = value => new Date(String(value).replace(' ', 'T') + (String(value).includes('Z') ? '' : 'Z')).toLocaleDateString('pt-BR');

  async function loadReviews(productId) {
    const list = $id('reviewList');
    list.innerHTML = '<p class="reviewLoading">Carregando avaliações…</p>';
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/reviews`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao carregar avaliações.');
      $id('reviewAverage').innerHTML = data.total ? `★ ${Number(data.average).toFixed(1)}` : '★ —';
      $id('reviewSummary').textContent = data.total ? `${data.total} avaliação${data.total === 1 ? '' : 'ões'} de clientes` : 'Este produto ainda não foi avaliado.';
      list.innerHTML = data.reviews.length ? data.reviews.map(review => `<article class="reviewItem"><div><strong>${escapeHtml(review.name)}</strong>${stars(review.rating)}</div><p>${escapeHtml(review.comment)}</p><small>${formatDate(review.createdAt)}</small></article>`).join('') : '<p class="reviewEmpty">Seja a primeira pessoa a avaliar este produto.</p>';
    } catch (error) {
      list.innerHTML = `<p class="reviewError">${escapeHtml(error.message)}</p>`;
    }
  }

  const originalShowPublic = window.showPublic;
  window.showPublic = id => {
    activeProductId = String(id);
    originalShowPublic(id);
    $id('reviewForm').reset();
    loadReviews(activeProductId);
  };

  $id('reviewForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!activeProductId) return;
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const selected = event.currentTarget.querySelector('input[name="reviewRating"]:checked');
    const payload = { name: $id('reviewName').value.trim(), rating: Number(selected?.value), comment: $id('reviewComment').value.trim() };
    button.disabled = true; button.textContent = 'Enviando…';
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(activeProductId)}/reviews`, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível enviar a avaliação.');
      event.currentTarget.reset();
      await loadReviews(activeProductId);
      if (window.toast) toast('Obrigado pela sua avaliação!');
    } catch (error) { alert(error.message); }
    finally { button.disabled = false; button.textContent = 'Enviar avaliação'; }
  });
})();
