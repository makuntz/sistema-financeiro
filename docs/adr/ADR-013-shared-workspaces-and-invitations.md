# ADR-013: Workspaces compartilhados e convites

## Status

Aceito

## Contexto

O produto atende casais e famílias que compartilham finanças, mas cada pessoa deve manter identidade e login próprios. Precisamos de um modelo que separe **quem é a pessoa** (User) de **onde vivem os dados** (Workspace), com fluxo de convite seguro e suporte a múltiplos owners.

## Decisão

### Logins individuais

- Cada pessoa = um `User` com e-mail/senha únicos.
- **Não** existe usuário “joint” ou conta compartilhada no Identity.

### Dados pertencem ao workspace

- Todo dado financeiro e cadastral de domínio carrega `workspaceId`.
- Acesso exige `WorkspaceMember` ativo; autorização por role (ADR-011).
- `createdByUserId` registra autoria; ownership permanece no workspace.

### Fluxo de convite

1. Owner/admin cria convite (`POST /v1/workspaces/current/invitations`) com e-mail + role.
2. API gera token opaco (hash persistido), TTL 7 dias, link `{WEB_URL}/convites/{token}`.
3. Convidado consulta preview (`GET /v1/invitations/:token`) — público, e-mail mascarado.
4. Convidado autentica-se (login ou register com o e-mail convidado).
5. Aceita (`POST /v1/invitations/:token/accept`) ou recusa (`.../decline`).
6. Aceite cria/reativa membership com o role do convite; status derivado de timestamps.

**E-mail transacional não implementado nesta etapa** — apenas `invitationLink` na resposta API.

### Multi-owner

- Vários memberships com role `owner` no mesmo workspace.
- Invariante: ≥ 1 owner ativo; último owner não pode sair/ser removido/rebaixado.

### Workspace pessoal no cadastro

Register cria workspace automático (`Planejamento de <Nome>`) + owner. Workspaces adicionais via `POST /v1/workspaces`.

## Alternativas consideradas

- Conta familiar com múltiplos e-mails no mesmo User
- Compartilhamento por “código de família” sem convite por e-mail
- Owner único permanente (bloqueia saída do criador sem transferência)

## Consequências positivas

- Modelo claro para auditoria e LGPD (contas individuais)
- Convite amarrado ao e-mail reduz accept por terceiros
- Múltiplos owners refletem casais com gestão conjunta
- Compatível com campo futuro `paidByMemberId` para “quem pagou”

## Consequências negativas / riscos

- UX depende de link manual até módulo de e-mail existir
- Convidado precisa criar conta se ainda não tiver (fricção)
- Token na URL pode vazar via referrer/logs — mitigar com HTTPS e TTL curto
- Reconvite para mesmo e-mail revoga convite pendente (pode confundir link antigo)
- Sem transferência automática de “workspace pessoal” para compartilhado — usuário gerencia dois contextos
