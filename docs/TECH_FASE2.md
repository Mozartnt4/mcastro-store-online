# MCastro Solutions Tech — OS e integração operacional

## O que está conectado

O módulo continua no Worker/D1 atual e usa os cadastros compartilhados de `clientes`, `produtos`, `movimentacoes_estoque` e `caixa`.

- Solicitações agora guardam referência/localização, prioridade e data desejada.
- A aprovação pública de uma proposta registra data/hora, preserva a proposta enviada e cria uma OS única em uma transação D1. Uma segunda aprovação não duplica OS.
- OS têm número `MC-OS-000001`, agenda, técnico, transições de status, início/conclusão, itens previstos/usados, fotos “antes”/“depois”, pagamentos, despesas, histórico, termo imprimível e link de acompanhamento público por token aleatório.
- Mudanças de preço ou escopo depois do aceite são aditivos separados. O cliente aceita/recusa por link; aceite aprovado atualiza a OS e preserva o documento anterior.
- Produtos existentes podem ser associados a itens da OS. Informar a quantidade efetivamente usada e concluir a OS baixa o estoque e cria um registro em `movimentacoes_estoque`. A verificação de saldo ocorre no banco para impedir estoque negativo.
- Recebimentos e despesas são associados a `caixa`, com chaves idempotentes para reduzir duplicações. As tabelas Tech guardam detalhe do pagamento/despesa e o caixa existente segue como razão financeiro compartilhado.
- O custo atual de reposição pode ser registrado no produto Store e é copiado para o orçamento/OS. O painel calcula recebimentos, despesas, custo histórico, reserva de reposição e resultado após reserva separadamente. Reposição não informada vale zero e é sinalizada; inflação/margem desejada ainda não são estimadas.
- O histórico do cliente usa o mesmo `clientes.id` e inclui compras, solicitações, ordens e pagamentos; não cria uma segunda ficha.

## Rotas principais

Todas as rotas em `/api/tech/admin/*` exigem a autenticação administrativa existente (`x-admin-password`). Rotas públicas expõem apenas projeções sem custos internos ou campos administrativos.

- `GET /api/tech/admin/dashboard`, `GET /api/tech/admin/ordens`, `GET /api/tech/admin/ordens/:id`
- `PUT /api/tech/admin/ordens/:id/status`, `/agendamento`, `/itens`
- `POST /api/tech/admin/ordens/:id/fotos`, `/pagamentos`, `/despesas`, `/aditivos`
- `GET /api/tech/admin/clientes/:id/historico`
- Público: `GET /api/tech/acompanhar/:token`, `/api/tech/aditivos/:token` e decisão em `/decisao`.

## Migração e publicação

As novas tabelas `tech_ordens`, `tech_ordem_itens`, `tech_fotos`, `tech_historico`, `tech_pagamentos`, `tech_despesas`, `tech_aditivos` e `tech_auditoria` são criadas aditivamente. Colunas ausentes de `tech_solicitacoes`, `produtos`, `caixa` e `movimentacoes_estoque` são adicionadas; nenhuma tabela existente é apagada. O backup administrativo lista todas as tabelas Tech novas.

Não foi possível testar o D1 remoto, Cloudinary real ou fazer deploy neste ambiente. Antes de publicar, executar `npm test`, validar o projeto em ambiente Cloudflare de teste ligado a uma cópia do D1, testar upload e conferir as configurações/associações já cadastradas no painel. Não publicar para outro banco nem sobrescrever o banco existente. As fotos dependem do Cloudinary configurado e os links de acompanhamento são bearer links; compartilhe só com o cliente.

## Testes disponíveis

`test/tech-operations.test.js` cobre a aprovação → OS, token de acompanhamento, aceite de aditivo, bloqueio por estoque insuficiente, baixa no estoque, recebimento/despesa no caixa e reserva financeira. `npm test` também executa os testes Tech e regressões Store incluídos na suíte.
