# ADR-014: Next.js BFF Authentication

## Status
Accepted

## Context
The web frontend (Next.js 15 App Router) needs to communicate with the Fastify API backend securely. Storing tokens in localStorage/sessionStorage exposes them to XSS attacks. We need a Backend-for-Frontend (BFF) pattern that keeps tokens server-side.

## Decision
Implement a BFF layer using Next.js Route Handlers under `/api/bff/`. Tokens are stored exclusively in HttpOnly cookies — never exposed to client JavaScript.

### Cookie Strategy
| Cookie | HttpOnly | Path | Purpose |
|--------|----------|------|---------|
| `pp_access_token` | Yes | `/` | JWT access token, short-lived (~15min) |
| `pp_refresh_token` | Yes | `/api/bff/auth` | Opaque refresh token, restricted path |
| `pp_workspace_id` | No | `/` | Current workspace ID (non-secret, readable by UI) |

All cookies use `SameSite=Lax` and `Secure` in production.

### BFF Route Design
- Explicit allowlisted routes — no open proxy to the API
- Origin validation on mutating methods (POST/PATCH/DELETE)
- Automatic token refresh on 401 with retry (single attempt, mutex to prevent loops)
- X-Workspace-Id header forwarded from workspace cookie
- Tokens never returned in JSON responses to the client

### Middleware
- Edge middleware checks cookie presence for protected `(app)` routes
- Redirects to `/login` with `?next=` for deep-link support
- Public routes (login, register, invite preview) bypass auth check

## Consequences
- **Positive**: Tokens never accessible via JS; reduced XSS attack surface; refresh rotation works seamlessly
- **Positive**: Client code uses simple `fetch('/api/bff/...')` without token management
- **Positive**: Server-side token validation enables SSR of authenticated content
- **Negative**: Extra network hop (browser → BFF → API) adds latency; mitigated by colocation
- **Negative**: Cookie management complexity in BFF layer
