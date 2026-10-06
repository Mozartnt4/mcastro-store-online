# MCastro Solutions Tech — arquitetura e plano

## Arquitetura encontrada (22/09/2026)

- Frontend sem framework: `public/index.html`, `styles.css`, `app.js`, `enhanced.js`, `online.js` e `reviews.js`. Os dois primeiros scripts contêm comportamento legado; `online.js` substitui as gravações pelo backend.
- Backend: `src/index.js`, módulos JavaScript em Cloudflare Workers. Assets servidos pela associação `ASSETS`; APIs em `/api/`.
- Banco: D1/SQLite pela associação `DB`, configurada no painel Cloudflare, não identificada no Wrangler local. Esquema aditivo criado automaticamente pelo Worker. Produtos, clientes, pedidos, itens, caixa, configurações, avaliações e movimentos persistem no D1.
- Autenticação administrativa: cabeçalho `x-admin-password`, PBKDF2 e bloqueio por IP; credencial mantida em sessionStorage pelo frontend existente. Reutilizar essa verificação.
- Store: catálogo, carrinho e checkout; servidor recalcula preços, reserva estoque e grava pedidos/itens/movimentos em batch. Conclusão lança caixa; cancelamento/estorno preservam histórico.
- Clientes: cadastro por WhatsApp. O upsert existente sobrescreve dados ausentes; Tech deve vincular clientes existentes sem apagar informações.
- Uploads: Cloudinary, cloud/preset em configurações D1; URLs persistidas no banco. Tech reutilizará o provedor com validação no servidor e limites.
- PWA: service worker atual armazena GETs indiscriminadamente e usa o mesmo fallback HTML para navegações. Corrigir para não armazenar APIs, administração nem links individuais.
- Risco existente: bootstrap público envia custo/margem de produtos. Remover campos internos da resposta pública preservando resposta administrativa.
- As cinco exclusões locais anteriores permanecem intocadas. Não há alterações no arquivo de versões antigas.

## Plano antes da implementação

Criar `src/tech.js` (API, validações e projeções públicas), `src/tech-schema.js` (migração aditiva), `public/tech.html`, `public/tech.css`, `public/tech.js` (interface pública/administrativa independente), testes de integração SQLite e documentação operacional.

Modificar `src/index.js` para encaminhar rotas Tech, reutilizar autenticação/configurações, incluir tabelas Tech no backup e filtrar custos públicos. Modificar `wrangler.jsonc` para encaminhar `/tech` e `/tech/*` ao Worker. Adicionar entrada Tech apenas no menu administrativo de `public/index.html`. Ajustar `public/service-worker.js` para isolar navegação/cache. Acrescentar verificação de sintaxe no `package.json`.

Tabelas novas: `tech_categorias`, `tech_servicos`, `tech_solicitacoes`, `tech_orcamentos`, `tech_limites`. Campos personalizados e itens comerciais armazenados em JSON validado, com snapshots para preservar histórico. Referências para `clientes` e produtos existentes; nenhum movimento de estoque nesta fase. Exclusão lógica de categorias/serviços preserva solicitações antigas.

Links individuais com token aleatório, respostas públicas por lista explícita de campos, sem custos nem fotos da solicitação. Orçamentos preparados podem ser editados com controle de versão; envio bloqueia edição e permite uma única decisão antes do vencimento. Valores monetários em centavos calculados no servidor.

## Escopo e validação

Fase 1: categorias/serviços administráveis, campos personalizados, catálogo responsivo, solicitação e fotos, listagem administrativa, orçamento manual discriminado, link individual, aprovação/recusa, WhatsApp por link. Nenhuma API paga nova.

O módulo evoluiu com OS, agenda, termo imprimível, integração de estoque/caixa, aditivos e acompanhamento. Consulte [TECH_FASE2.md](TECH_FASE2.md) para as rotas, cálculos e pendências de validação remota.

Executar `npm test`, integração com SQLite real (adaptador da API D1 somente nos testes), validação de permissões, persistência após reabertura, limites de upload, concorrência e regressão Store. Registrar separadamente o que depender de navegador ou serviços remotos. Sem publicação nesta etapa de desenvolvimento.

Referências técnicas consultadas: [roteamento Cloudflare](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/), [batch D1](https://developers.cloudflare.com/d1/worker-api/d1-database/), [upload Cloudinary](https://cloudinary.com/documentation/upload_images).

## Implementação local e modo de uso

1. Acesse `/tech/admin` com a senha da Store.
2. Cadastre categorias, perguntas específicas e serviços; apenas categorias/serviços ativos aparecem em `/tech`. Perguntas de categoria são herdadas pelos serviços. Imagem do serviço pode ser informada por URL HTTPS.
3. O cliente escolhe um serviço, preenche a solicitação e envia até 6 fotos JPEG/PNG/WebP de 3 MB cada. O Worker limita tamanho total, confere assinatura/formato e encaminha ao Cloudinary existente. URLs e respostas ficam vinculadas no D1. A chave de envio evita duplicação em uma nova tentativa na mesma página; limite de 8 tentativas por IP a cada 10 minutos.
4. Em Solicitações e orçamentos, abra a solicitação e prepare os itens. Vínculo com produtos apenas referencia o cadastro; não altera estoque. Valores de venda e custos são copiados para preservar a proposta. Custo de reposição zero significa não informado, nunca uma estimativa automática de preço atual.
5. Salve o orçamento preparado; revise; libere o link. O envio bloqueia alterações comerciais. Compartilhe manualmente pelo WhatsApp ou copie o link. Não há API paga nem envio automático de mensagens.
6. O cliente consulta o link e aprova/recusa uma única vez, antes do vencimento. A data/hora fica no D1. Orçamentos vencidos aparecem como Expirado, calculado no servidor. A aprovação cria uma OS conforme a Fase 2.
7. O backup D1 da Store passa a incluir as tabelas Tech e avaliações. Esse arquivo é administrativo e contém dados pessoais, custos e tokens de acesso.

### Limitações conhecidas e validação antes da publicação

- `npm test`: sintaxe, testes de autenticação, integração SQLite real com adaptador D1, isolamento dos custos, cadastro existente preservado, idempotência, edição concorrente, envio, aprovação/recusa, expiração, upload inválido/erro do provedor, backup, cache e regressão de pedido/estoque/caixa da Store.
- `tools/verify-tech-ui.mjs`: fluxo completo de interações DOM em Happy DOM contra API e SQLite reais. Executado com Happy DOM instalado fora do repositório, em diretório temporário. Uso: `node tools/verify-tech-ui.mjs /caminho/node_modules/happy-dom/lib/index.js`. Não substitui teste visual em navegador.
- Nenhum navegador Chromium/WebKit está instalado neste ambiente Android/Termux. Responsividade foi implementada com media queries e controles adaptáveis, mas inspeção visual desktop/Android/iPhone permanece pendente.
- D1 remoto, Cloudinary real e deploy não foram acessados. Os testes de upload substituem apenas a chamada externa ao provedor. Antes de publicar, validar cloud/preset reais e associação DB num ambiente de teste Cloudflare, repetir o fluxo e verificar persistência com outro aparelho/novo acesso administrativo.
- A associação DB existe segundo a configuração operacional, mas não está identificada no `wrangler.jsonc`; não inventar UUID de banco nem publicar apontando a outro banco.
- Fotos usam o mesmo modelo Cloudinary da Store: URLs de entrega públicas, embora a API Tech só as liste para administradores. Não enviar documentos sensíveis. Se um upload de várias fotos falhar após alguns envios, pode haver imagens órfãs no Cloudinary; a solicitação não é gravada parcialmente. Limpeza autenticada de imagens exige credencial de gerenciamento que não consta do projeto.
- Fotos com HEIC devem ser convertidas para JPEG/PNG/WebP antes do envio; a interface informa os formatos aceitos.
- Não foram criados serviços ou valores comerciais fictícios. O administrador deve cadastrar o catálogo real.
- O service worker muda para `mcastro-v62` e remove cache anterior ao ativar. Após futura publicação, conferir a atualização da PWA instalada.
- A autenticação administrativa existente foi reutilizada, incluindo seus parâmetros PBKDF2. A compatibilidade com o runtime Cloudflare deve ser confirmada na validação remota, junto do restante da Store.
- Não houve commit, push, alteração do D1 remoto ou publicação. As cinco exclusões locais anteriores foram preservadas.

## Prévia no próprio celular (Node 24)

Execute `npm run preview:tech` dentro do projeto ativo. Abra
`http://localhost:8787/tech/admin` no navegador do mesmo aparelho e use a senha
impressa pelo comando. A página pública é `http://localhost:8787/tech`.

A prévia usa SQLite persistente em `.local-tech/preview.sqlite`, independente do
D1 de produção. A senha fica em `.local-tech/access.json`; a pasta inteira é
ignorada pelo Git. Cadastre categoria e serviço de teste no painel. Solicite
um orçamento pela página pública, prepare/libere no painel e aprove pelo link.
Feche e reabra a página para confirmar que os dados permanecem salvos.

Nesta prévia, as chamadas externas do Worker estão desativadas. Teste solicitações
sem fotos; Cloudinary real precisa ser validado separadamente. O servidor fica
restrito ao mesmo aparelho, na porta 8787. Mantenha o processo ativo durante o teste;
para reiniciar, execute novamente `npm run preview:tech` (os dados permanecem).
