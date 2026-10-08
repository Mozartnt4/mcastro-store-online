# Conclusão da missão Tech — plano de 08/10/2026

Pedido do proprietário: resolver as pendências da revisão da missão, incluindo acesso público, catálogo online e publicação.

## Arquitetura preservada

Frontend HTML/CSS/JavaScript, Worker Cloudflare em `src/index.js`, D1 existente na associação `DB`, clientes/produtos/estoque/caixa compartilhados e autenticação administrativa existente. Fotos usam Cloudinary existente; WhatsApp por links sem API paga. Tech possui página `/tech` e painel `/tech/admin`; não substitui a Store.

## Alterações planejadas

- `src/tech-schema.js`: tabelas aditivas para equipamentos instalados, garantias/retornos, modelos e snapshots de termos, configurações financeiras e controle de importação do catálogo.
- `src/tech-management.js`: APIs administrativas, relatórios financeiros, regras configuráveis, agenda/clientes/materiais, equipamentos/garantias/termos e importação controlada dos cadastros locais reais.
- `src/tech.js`: integração das novas APIs, indicadores, proteção de decisões concorrentes e acompanhamento WhatsApp.
- `public/tech.js`, `public/tech-management.js`, `public/tech.html`, CSS: navegação, formulários e relatórios; pagamento disponível depois de concluir OS.
- `src/tech-catalog.json`: somente categorias/serviços reais locais, sem clientes, senhas, orçamento ou dados de teste. Importação uma vez, aditiva e sem sobrescrever cadastros existentes.
- Testes de integração: persistência, permissões, termos preservados, garantia/retorno, financeiro e regressão Store.
- Acesso público na página inicial já criado; nova versão do cache PWA.

## Critérios e cuidados

Lucro nominal, reposição, despesas, proteção e resultado real separados. Percentuais não configurados permanecem não definidos; o sistema sinaliza informação incompleta. Sem afirmar lucro real completo quando faltarem reposição ou regras. Produtos com estoque em unidades inteiras continuam em unidades inteiras; quantidades fracionárias sem vínculo são permitidas.

Snapshot do termo só muda em nova revisão explícita. Nenhuma cláusula jurídica fixa. Garantia tem prazo e vínculo com OS/equipamento, retorno separado e histórico; não reabre a OS nem baixa estoque duas vezes. Migrações não apagam tabelas. Links individuais aleatórios e respostas públicas sem informações financeiras internas.

Antes do envio: npm test, fluxo DOM, conferência de HTTP e preservação das cinco exclusões antigas. Publicação via main/GitHub existente, usando cópia limpa em temporário. Conferir banco, catálogo, páginas públicas e APIs protegidas após deploy. Navegador real Android/iPhone e Cloudinary real dependem das capacidades disponíveis e serão registrados com honestidade.

## Implementação e uso

- Página inicial: botão público para `/tech`, com atualização do cache PWA.
- Painel: agenda, clientes/histórico, materiais, equipamentos, garantias/retornos, termos, financeiro e configurações.
- Cadastre equipamento por OS, número de série, data/local e garantia opcional. Garantia do serviço também pode ser cadastrada separadamente. Retornos mantêm a OS/estoque originais.
- Cadastre modelo de termo com prestador, pagamento, limitações, responsabilidades e condições. Gere revisão por OS e imprima/salve PDF; revisões anteriores não mudam ao editar o modelo.
- Configure os percentuais financeiros. Margem desejada é sobre o preço de venda, proteção sobre reposição. Custos operacionais dos itens e despesas extras são somados; não duplique o mesmo gasto nos dois cadastros.
- Relatório por OS inclui margem bruta, markup, custo atual de reposição registrado no orçamento, despesas, proteção e mínimo sustentável. Propostas usam quantidades previstas; OS concluídas usam recebimentos e quantidades efetivamente utilizadas. Custo de reposição fica preservado no orçamento/OS e deve ser atualizado no cadastro para novas propostas.
- Registro de pagamento e despesas continua disponível depois da conclusão. A conclusão não reabre e não baixa estoque duas vezes.
- Correção do agendamento: nome da variável do responsável no histórico/auditoria e conversão de horário local para UTC no formulário.
- Aprovação rejeita versão antiga da proposta. Recebimento acima do saldo também é bloqueado no banco.

## Validação em 08/10/2026

- `npm test`: 16 testes passaram, incluindo importação sem duplicação, exclusão preservada, persistência ao reabrir SQLite, permissões, equipamentos, garantia/retorno, termos com snapshot, finanças e regressões Store.
- Happy DOM com API e SQLite reais: cadastro → solicitação → orçamento → aprovação → OS → equipamento → garantia/retorno → termo → agenda → conclusão → recebimento → financeiro.
- Cloudinary existente: upload real de um PNG de 1 pixel retornou HTTP 200, formato PNG e URL HTTPS. Nenhuma solicitação fictícia foi criada no D1 online. O pequeno arquivo de verificação permanece no provedor; seu identificador está no registro temporário local da execução.
- Produção antes do envio: `/api/health` HTTP 200, 10 produtos; catálogo Tech vazio. Publicação será conferida após envio à main.
- DOM não comprova renderização visual. Chromium/WebKit não estão disponíveis neste ambiente; não se afirma inspeção em Android/iPhone/desktop reais.
- Apenas arquivos desta atualização são enviados de uma cópia limpa. As cinco exclusões locais antigas e o SQLite local não entram na publicação.
