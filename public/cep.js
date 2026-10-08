// Consulta somente o CEP; os dados pessoais do pedido não são enviados ao ViaCEP.
export function attachCepLookup(doc, fetcher = globalThis.fetch, delay = 350, timeout = 8000) {
  const cep = doc.getElementById('deliveryCep');
  const status = doc.getElementById('deliveryCepStatus');
  if (!cep || !status) return;
  const fields = { logradouro: 'deliveryStreet', bairro: 'deliveryDistrict', localidade: 'deliveryCity', uf: 'deliveryState' };
  let timer, controller, version = 0, lastSuccess = '';
  const digits = () => cep.value.replace(/\D/g, '');
  const message = text => { status.textContent = text; };
  async function lookup(code, current) {
    controller = new AbortController();
    const abort = controller;
    const deadline = setTimeout(() => abort.abort(), timeout);
    const original = Object.fromEntries(Object.entries(fields).map(([key, id]) => [key, doc.getElementById(id).value]));
    message('Buscando endereço…');
    cep.setAttribute('aria-busy', 'true');
    try {
      const res = await fetcher(`https://viacep.com.br/ws/${code}/json/`, { signal: abort.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!res.ok) throw new Error('Consulta indisponível');
      const data = await res.json();
      if (current !== version || code !== digits()) return;
      if (data.erro || !data.localidade || !data.uf) {
        message('CEP não encontrado. Confira o CEP ou preencha o endereço manualmente.');
        return;
      }
      let incomplete = false;
      for (const [key, id] of Object.entries(fields)) {
        const field = doc.getElementById(id);
        // Preserva alterações feitas pelo usuário enquanto a busca estava em andamento.
        if (field.value === original[key]) {
          field.value = typeof data[key] === 'string' ? data[key] : '';
          field.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (!field.value.trim()) incomplete = true;
      }
      lastSuccess = code;
      message(incomplete ? 'CEP localizado. Complete os campos de endereço que ficaram em branco.' : 'Endereço preenchido. Confira os dados e informe o número.');
    } catch {
      if (current === version) message('Não foi possível consultar o CEP. Preencha o endereço manualmente ou tente novamente.');
    } finally {
      clearTimeout(deadline);
      if (current === version) cep.removeAttribute('aria-busy');
    }
  }
  function schedule() {
    clearTimeout(timer);
    controller?.abort();
    const current = ++version, code = digits();
    cep.removeAttribute('aria-busy');
    if (code.length !== 8) {
      lastSuccess = '';
      message(code ? 'Digite os 8 números do CEP.' : 'Digite o CEP para preencher o endereço automaticamente.');
      return;
    }
    cep.value = code.slice(0, 5) + '-' + code.slice(5);
    if (code === lastSuccess) return;
    timer = setTimeout(() => lookup(code, current), delay);
  }
  cep.addEventListener('input', schedule);
  cep.addEventListener('change', schedule);
  return () => { ++version; clearTimeout(timer); controller?.abort(); cep.removeEventListener('input', schedule); cep.removeEventListener('change', schedule); };
}
if (typeof document !== 'undefined') attachCepLookup(document);
