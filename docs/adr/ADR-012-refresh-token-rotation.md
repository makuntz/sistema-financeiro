# ADR-012: Rotação de refresh token

## Status

Aceito

## Contexto

Refresh tokens de longa duração são alvo de roubo. Se um token vazado for reutilizado após rotação legítima, precisamos invalidar a cadeia de confiança da sessão.

## Decisão

Implementar **rotação obrigatória** em `POST /v1/auth/refresh` (`RefreshSession`):

1. Localizar sessão pelo hash do refresh token apresentado.
2. Rejeitar se revogada, expirada ou hash desconhecido (`401`).
3. **Revogar** a sessão atual (`current.revoke()`).
4. Criar **nova** sessão com novo `sessionId` e novo refresh token (novo hash).
5. Persistir atomicamente via `sessions.rotate({ previous, next })`.
6. Retornar novo par access + refresh.

Efeito: o refresh token anterior **deixa de funcionar imediatamente** após um refresh bem-sucedido (comportamento verificado nos testes de integração).

Logout revoga a sessão associada ao refresh token informado (idempotente).

## Alternativas consideradas

- Refresh reutilizável até expirar (maior janela de abuso)
- Rotação sem revogar anterior (detecta reuse, mas mantém sessão antiga ativa)
- Sliding session só no access token (refresh fixo)

## Consequências positivas

- Limita replay de refresh token roubado após rotação
- Novo `sid` no JWT alinha access token à sessão corrente
- Audit `SessionRefreshed` com IDs anterior/novo

## Consequências negativas

- Cliente **deve** persistir o novo refresh token a cada refresh
- Requisições concorrentes com o mesmo refresh podem causar corrida (cliente deve serializar refresh)
- Detecção agressiva de reuse (invalidar todas as sessões do usuário) fica para etapa futura
