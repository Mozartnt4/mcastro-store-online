# MCastro Solutions 4.4 — versão operacional

Esta versão mantém o layout existente e troca o armazenamento principal pelo Cloudflare D1.

## Recursos incluídos

- catálogo público sem tela administrativa;
- cadastro e edição de produtos;
- fotos no Cloudinary;
- produtos, clientes, pedidos e estoque no D1;
- carrinho e checkout com cadastro rápido;
- retirada ou entrega com endereço;
- PIX e encaminhamento ao WhatsApp;
- baixa automática de estoque;
- reserva imediata de estoque em pedidos públicos e devolução ao cancelar;
- pedido, baixa de estoque, movimentação e caixa gravados de forma atômica;
- proteção contra operações duplicadas de caixa e estoque;
- senha administrativa protegida com PBKDF2 e bloqueio temporário após tentativas inválidas;
- backup administrativo completo do D1, sem incluir a senha;
- vendas administrativas, clientes, caixa e configurações sincronizados no D1;
- valores e taxa de entrega calculados novamente no servidor;
- migração automática do esquema antigo do D1 sem apagar dados;
- migração opcional dos produtos antigos do navegador;
- PWA, QR Code e etiquetas já existentes no layout.

## Publicação pelo GitHub + Cloudflare

1. Envie todo o conteúdo deste projeto ao repositório GitHub.
2. Na Cloudflare, crie um Worker conectando esse repositório.
3. Comando de implantação: `npm run deploy`.
4. Depois da primeira implantação, abra **Associações** e conecte:
   - tipo: Banco de dados D1
   - nome da variável: `DB`
   - banco: `mcastro-database`
5. Reimplante a versão mais recente.
6. Teste `/api/health`.

## Endereços

- catálogo: `/?modo=catalogo`
- administração: `/?modo=admin`
- senha inicial: `1234` (troque por uma senha de pelo menos 6 caracteres antes de divulgar)
- diagnóstico: `/api/health`

O Worker cria e atualiza as colunas necessárias automaticamente no primeiro acesso.

## Verificação local

Execute `npm test` para validar a sintaxe e os testes de segurança. O modo
de desenvolvimento do Wrangler depende de uma plataforma suportada pelo `workerd`.

## MCastro Solutions Tech — serviços integrados

Novo módulo integrado ao Worker/D1: catálogo de serviços em `/tech`, gestão em
`/tech/admin` e propostas individuais em `/tech/orcamento/<token>`. Reutiliza a
senha administrativa e o Cloudinary existentes. Categorias, perguntas e serviços
são cadastrados pelo administrador; solicitações, propostas, ordens, histórico,
pagamentos e despesas ficam no D1.

Consulte [arquitetura e fluxo inicial](docs/TECH_FASE1.md) e
[OS, estoque, financeiro, acompanhamento e implantação](docs/TECH_FASE2.md).
A página inicial possui acesso público aos serviços. Agenda, clientes, materiais,
equipamentos instalados, garantias/retornos, termos e financeiro têm áreas próprias.
Os termos usam modelos editáveis e revisões preservadas no D1. Pagamentos podem ser
registrados depois de concluir uma OS.

O catálogo real de 7 categorias e 15 serviços é importado uma vez no D1 mediante
`TECH_IMPORT_CATALOG=catalogo-real-20260923-v1`, configurado no Wrangler. A importação
preserva cadastros existentes e não transfere dados de teste. Alterações e exclusões
posteriores do catálogo são respeitadas.

Em Configurações Tech, defina proteção do capital e margem real desejada. Campos
vazios significam regras não definidas. O financeiro separa custos de aquisição,
reposição, despesas, proteção, markup e margens; informações incompletas não geram
um valor afirmativo de lucro real. Não lance a mesma despesa operacional como custo
de item e como despesa da OS: os dois campos entram no cálculo.

Consulte [plano, conclusão da missão e modo de uso](docs/TECH_FASE3.md).
Execute `npm test` antes de publicar e confira `/api/health` e `/api/tech/catalogo`.
A hospedagem continua no Worker e banco existentes.
