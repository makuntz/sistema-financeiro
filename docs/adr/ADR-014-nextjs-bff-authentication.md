# ADR-014: Next.js BFF Authentication

## Status

Accepted (updated in Etapa 4)

## Context

The web frontend (Next.js 15 App Router) needs to communicate with the Fastify API backend securely. Storing tokens in localStorage/sessionStorage exposes them to XSS attacks. We need a Backend-for-Frontend (BFF) pattern that keeps tokens server-side.

Etapa 3 initially set `pp_refresh_token` with `Path=/api/bff/auth`. That prevented the browser from sending the refresh cookie on domain BFF routes (`/api/bff/categories`, `/api/bff/planning`, …) and on authenticated page navigations that the middleware inspects. When the access token expired, domain calls could not renew the session.

A module-level `refreshPromise` mutex was also unsafe: concurrent requests from different users in the same Node process could share one refresh Promise.

## Decision

Implement a BFF layer using Next.js Route Handlers under `/api/bff/`. Tokens are stored exclusively in HttpOnly cookies — never exposed to client JavaScript.

### Cookie Strategy

| Cookie             | HttpOnly | Path | Purpose                                           |
| ------------------ | -------- | ---- | ------------------------------------------------- |
| `pp_access_token`  | Yes      | `/`  | JWT access token, short-lived (~15min)            |
| `pp_refresh_token` | Yes      | `/`  | Opaque refresh token (same origin; see note)      |
| `pp_workspace_id`  | No       | `/`  | Current workspace ID (non-secret, readable by UI) |

All cookies use `SameSite=Lax` and `Secure` in production. **Domain is never set** (host-only). Clear the refresh cookie with the same `Path=/`.

**Security note:** Cookie `Path` is **not** an adequate security boundary for same-origin cookies. Restricting Path only controlled which requests included the cookie; it did not protect the token from XSS on other paths of the same origin. **HttpOnly** remains the primary protection against script access. Path=/ is required so domain BFF routes and middleware can observe the refresh cookie.

### Refresh concurrency

- Read the refresh token from the **current request**.
- Key an in-memory `Map` by **SHA-256** of the token (never use the raw token as key; never log token or hash).
- Concurrent callers that share the same refresh token coalesce into one HTTP refresh.
- Distinct sessions never share a Promise.
- Remove the Map entry in `finally`.
- Do not persist the Map; no Redis in this stage.

### BFF Route Design

- Explicit allowlisted routes — no open proxy to the API
- Origin validation on mutating methods (POST/PATCH/PUT/DELETE)
- Automatic token refresh on 401 with retry (**single attempt**, no refresh loop)
- Invalid/revoked refresh clears access, refresh, and workspace cookies
- Logout clears all three cookies
- X-Workspace-Id header forwarded from workspace cookie (never trusted from browser Authorization)
- Tokens never returned in JSON responses to the client

### Middleware

- Edge middleware checks cookie presence for protected `(app)` routes
- With Path=/, a valid refresh cookie alone is enough for the middleware to **allow** the route; the API remains the authority for real validation
- Redirects to `/login` with `?next=` for deep-link support
- Public routes (login, register, invite preview) bypass auth check

## Consequences

- **Positive**: Tokens never accessible via JS; reduced XSS attack surface; refresh works on domain BFF routes
- **Positive**: Client code uses simple `fetch('/api/bff/...')` without token management
- **Positive**: Per-session refresh deduplication without cross-user leakage
- **Negative**: Extra network hop (browser → BFF → API) adds latency; mitigated by colocation
- **Negative**: Refresh cookie is sent on more same-origin paths (acceptable with HttpOnly + SameSite=Lax)
