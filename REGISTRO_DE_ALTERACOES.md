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
