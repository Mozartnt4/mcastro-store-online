# Registro de alterações

## Lembrete para as próximas alterações

Sempre que o projeto for modificado, consulte este arquivo antes de começar e
adicione uma nova anotação ao final do trabalho. Registre a data, o que mudou,
os arquivos principais envolvidos e se os testes, o Git e a publicação no
Cloudflare foram concluídos.

Não apague registros anteriores.

## 28/07/2026 — Acesso simples ao painel administrativo

- Tornado visível no catálogo público o botão **Acessar painel**.
- Mantida a autenticação por senha já existente.
- Liberada a exibição da janela de login no modo público.
- Melhorado o texto e adicionada uma descrição acessível ao botão.
- Arquivos alterados: `public/index.html` e `public/styles.css`.
- Testes executados com `npm test`: 2 testes aprovados.
- Git: concluído no branch `main`.
- Cloudflare: publicação concluída automaticamente pelo **Workers Builds**
  conectado ao repositório do GitHub.

## 23/09/2026 — MCastro Solutions Tech: Fase 1 local e prévia para retomada

### Implementado

- Analisada a arquitetura existente e documentado o plano em `docs/TECH_FASE1.md`, conforme `MATERIAIS_AUXILIARES/Atualização do projeto/leiatualizacao.txt`.
- Módulo Tech independente da Store: catálogo `/tech`, administração `/tech/admin` e orçamento individual `/tech/orcamento/<token>`.
- Categorias e serviços editáveis, ativação/desativação, exclusão lógica, perguntas personalizadas, solicitações com fotos, orçamento manual discriminado, aprovação/recusa com registro de data/hora e links WhatsApp.
- Persistência preparada no D1; custos internos excluídos da resposta pública. Clientes existentes reaproveitados sem apagar cadastro anterior. Produtos podem ser vinculados aos itens, sem movimentar estoque nesta fase.
- Cache da PWA ajustado para não armazenar APIs ou navegações Tech/administrativas. Bootstrap público da Store deixa de expor custos internos. Backup administrativo inclui tabelas Tech e avaliações.
- Arquivos principais novos: `src/tech.js`, `src/tech-schema.js`, `public/tech.html`, `public/tech.css`, `public/tech.js`, testes Tech, `test/helpers/d1.js`, `tools/verify-tech-ui.mjs`, `tools/preview-tech.mjs` e documentação.
- Integrações alteradas: `src/index.js`, `public/index.html`, `public/service-worker.js`, `wrangler.jsonc`, `package.json`, `README.md` e `.gitignore`.

### Prévia local e serviços cadastrados

- Comando para iniciar/reiniciar, dentro do projeto ativo: `npm run preview:tech` (Node 24).
- Público: `http://localhost:8787/tech`; painel: `http://localhost:8787/tech/admin`, no navegador do mesmo celular. Manter Termux/processo em segundo plano.
- A senha de teste é exibida no terminal ao iniciar e está em `.local-tech/access.json`. Não copiar essa senha para arquivos versionados.
- Banco local persistente: `.local-tech/preview.sqlite`. A pasta `.local-tech/` é ignorada pelo Git. Preservar a pasta: contém os cadastros e testes do usuário. NÃO confundir esses dados com o D1 online.
- Servidor iniciado nesta sessão na porta 8787. Se o endereço não abrir amanhã, verificar se o processo ainda está ativo e iniciar novamente apenas se necessário.
- Cadastrados 15 serviços ativos, todos **Sob orçamento**, sem preços, prazos ou garantias inventados, com descrições e perguntas específicas:
  - Limpeza de ar-condicionado.
  - Substituição de tomadas.
  - Instalação e substituição de fechaduras.
  - Serviços de eletricista.
  - Instalação de câmeras de segurança.
  - Configuração de câmeras e acesso pelo celular.
  - Instalação de motor de portão.
  - Manutenção de portão automático.
  - Instalação de luminárias e ventiladores de teto.
  - Instalação de ar-condicionado.
  - Manutenção de ar-condicionado.
  - Configuração de roteador e rede Wi-Fi.
  - Instalação e configuração de equipamentos.
  - Manutenção de roçadeiras.
  - Manutenção de equipamentos.
- Categorias: Climatização, Elétrica, Fechaduras, Câmeras e segurança, Portões e automação, Tecnologia e redes, Manutenção de equipamentos.
- Esses 15 serviços estão SOMENTE no banco da prévia. Antes de publicar, preparar transferência controlada do catálogo, sem transferir solicitações fictícias, credenciais ou dados de teste. Evitar duplicações.
- A prévia não acessa o D1 remoto e bloqueia chamadas externas do Worker. Testar solicitações sem fotos; upload real depende de validação separada no Cloudinary.

### Validação realizada

- `npm test` passou: sintaxe, segurança, integração SQL, persistência após reabertura do banco, permissões, controle de versão, aprovação/recusa, expiração, limites/erros de upload, backup, isolamento de cache e regressão de pedido/estoque/caixa da Store. O runner reportou 11 entradas, incluindo o arquivo auxiliar D1.
- `tools/verify-tech-ui.mjs` passou pelo fluxo categoria → pergunta → serviço → solicitação → orçamento → link → aprovação usando Happy DOM com API e SQLite reais. Happy DOM instalado em diretório temporário, fora do projeto.
- Prévia HTTP verificada: catálogo, página pública, painel e login responderam corretamente. Os 15 serviços foram confirmados na API pública local.
- `git diff --check` passou na verificação anterior. Cadastros posteriores mudaram apenas o SQLite local.
- Testes NÃO comprovam renderização visual em navegador: Chromium/WebKit não estão disponíveis neste ambiente. Android/iPhone/desktop ainda precisam de validação visual.
- Cloudinary real, D1 remoto e runtime Cloudflare ainda não foram testados nesta atualização.

### Ponto de retomada amanhã

1. Ler este registro e `docs/TECH_FASE1.md`; conferir alterações locais sem restaurar arquivos antigos.
2. Reabrir a prévia e revisar os serviços cadastrados com o proprietário.
3. Testar no navegador do celular: catálogo, perguntas específicas, solicitação sem fotos, montagem do orçamento, link, aprovação/recusa e dados após recarregar.
4. Corrigir eventuais problemas de uso/layout encontrados.
5. Preparar ambiente Cloudflare de teste e validar associação DB, autenticação, uploads reais, persistência entre aparelhos e Store antes de qualquer publicação.
6. Só após validar a Fase 1, avançar para OS, contratos, agenda, estoque automático, financeiro/Lucro Real, garantias e equipamentos instalados.

### Git e publicação

- Trabalho somente local. NÃO houve commit, push, deploy ou alteração do banco de produção.
- As cinco exclusões locais anteriores continuam intactas e não devem entrar em commit/publicação sem autorização explícita: os três SVGs de cartões/QR em `design/Cartao de visitas MCastro/` e `public/icons/icon-192.png`, `public/icons/icon-512.png`.
- Não editar/publicar `ARQUIVO_VERSOES_ANTIGAS_NAO_USAR`.
- Pedido final do proprietário nesta sessão: registrar a atualização para continuar amanhã.

## 06/10/2026 — Solutions Tech: OS e integrações operacionais

- Aprovação de orçamento cria OS numerada uma única vez; cliente acompanha o status por token individual e pode aceitar aditivos por link.
- Gestão de agenda, técnico, status, materiais previstos/utilizados, fotos antes/depois, pagamentos, despesas, histórico e termo imprimível.
- Baixa de materiais usa o produto e movimento de estoque existentes. Estoque insuficiente bloqueia conclusão no banco. Recebimentos/despesas também entram em `caixa`.
- Painel mostra solicitações, orçamentos, OS, saldo a receber, recebimentos, despesas, custo histórico, reposição atual e resultado disponível. Cadastro Store recebeu custo atual de reposição.
- Solicitação agora tem localização, prioridade e data desejada; histórico unificado usa o ID de cliente Store.
- Novas migrações aditivas e tabelas Tech aparecem no backup administrativo. `npm test`: 5 grupos de teste passaram, incluindo integração e regressão Store.
- Sem commit, push, acesso ao D1 remoto, validação Cloudinary real ou publicação Cloudflare. As cinco exclusões locais listadas nas instruções do projeto foram mantidas sem alteração.
