# Infraestrutura local

## Serviços

| Serviço | Porta | Credenciais (somente desenvolvimento) |
|---------|-------|----------------------------------------|
| PostgreSQL | `${POSTGRES_PORT:-5432}` | user/pass/db: `pp_planning` / `pp_planning_dev` / `pp_planning` |
| MinIO API | 9000 | `minioadmin` / `minioadmin` |
| MinIO Console | 9001 | `minioadmin` / `minioadmin` |

## Bucket inicial

O serviço `minio-init` cria o bucket `pp-planning` com acesso privado.

## Comandos

```bash
pnpm infra:up
pnpm infra:down
pnpm infra:logs
pnpm infra:reset
```
