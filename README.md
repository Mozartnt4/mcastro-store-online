# MCastro Store Pro Enterprise 4.3 — versão operacional

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
- pedido, baixa de estoque, movimentação e caixa gravados de forma atômica;
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

Execute `npm test` para validar a sintaxe de todos os arquivos JavaScript. O modo
de desenvolvimento do Wrangler depende de uma plataforma suportada pelo `workerd`.
