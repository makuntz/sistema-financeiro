# ADR-011: Permissões e papéis de workspace

## Status

Aceito

## Contexto

Workspaces compartilhados exigem autorização granular: leitura para convidados, escrita para membros, gestão para admins/owners. A API deve centralizar regras no domínio, não espalhar `if (role === ...)` nas rotas.

## Decisão

Quatro papéis fixos (`WorkspaceRole`):

| Papel | Escopo resumido |
|-------|-----------------|
| `owner` | Tudo, inclusive convites com qualquer papel e promoção a owner |
| `admin` | Quase tudo; **não** altera/remove owners; convida só `member`/`viewer` |
| `member` | Leitura + escrita financeira/taxonomy; sem gestão de membros/convites |
| `viewer` | Somente leitura |

Permissões explícitas (`Permission`) mapeadas em `permissionsForRole()` — ex.: `members.manage`, `invitations.create`, `financial.write`. Middleware `requirePermission('...')` consulta a lista derivada do role do membership.

Políticas adicionais em `WorkspaceAuthorizationPolicy`:

- Pelo menos um owner ativo (`LAST_OWNER_REQUIRED`)
- Convite bloqueado se e-mail já é membro
- Aceite de convite exige e-mail da conta = e-mail convidado

## Alternativas consideradas

- RBAC dinâmico configurável por workspace (complexidade prematura)
- Apenas owner/member binário (insuficiente para família com “só leitura”)
- Permissões só na camada HTTP (duplicação e drift)

## Consequências positivas

- Matriz de permissões testável e documentada
- Extensível (`financial.*`, `taxonomy.*` já reservados)
- Audit events para mudanças sensíveis (promoção a owner, remoção)

## Consequências negativas

- Papéis fixos podem exigir ADR futuro para custom roles
- Admin vs owner gera regras especiais (não simétricas)
- Viewer não participa de escrita — UX deve deixar isso claro
