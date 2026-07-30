# ADR-009: Tokens de autenticação (JWT access + refresh opaco)

## Status

Aceito

## Contexto

A etapa 2 exige autenticação stateful para web e mobile, com sessões revogáveis e tokens de curta duração para acesso à API. Precisamos equilibrar segurança (não persistir segredos em texto claro) com simplicidade operacional no monólito atual.

## Decisão

Adotar **dois tokens por sessão**:

1. **Access token** — JWT assinado (HS256 via `jose`), curta duração (`ACCESS_TOKEN_TTL_SECONDS`, padrão 900 s), claims `sub` (userId) e `sid` (sessionId).
2. **Refresh token** — string opaca (`randomBytes(32).hex`), longa duração (`REFRESH_TOKEN_TTL_DAYS`, padrão 30 dias), armazenada apenas como **hash SHA-256** em `AuthSession.refreshTokenHash`.

Fluxo:

- Login/register emite par access + refresh e persiste sessão.
- Requisições autenticadas enviam `Authorization: Bearer <accessToken>`.
- A API valida assinatura JWT **e** existência/usabilidade da sessão (`sid`).
- Refresh e logout operam sobre o refresh token opaco (hash comparado no banco).

## Alternativas consideradas

- JWT stateless sem sessão server-side (revogação difícil)
- Refresh token também como JWT (menos controle de rotação/revogação)
- Cookies httpOnly only (adiado; clientes mobile precisam de bearer explícito)

## Consequências positivas

- Access token curto limita janela de abuso se vazado
- Refresh opaco + hash permite revogar sessão sem expor segredo
- Mesmo mecanismo de hash reutilizado para tokens de convite
- Compatível com Swagger e `@pp-planning/api-client`

## Consequências negativas

- Toda requisição autenticada consulta sessão no banco (via `sid`)
- Rotação de refresh exige transação e cuidado com concorrência (ver ADR-012)
- `JWT_SECRET` deve ser forte e rotacionável com plano de migração futuro
