# Módulos de domínio

Estrutura alvo por módulo na API:

```
src/modules/<module>/
  domain/
  application/
  infrastructure/
  presentation/
  index.ts
```

Nesta etapa, o domínio compartilhado vive em `packages/domain` e a API orquestra presentation/infrastructure.

Subcategorias: documentadas, ainda não implementadas.

Papéis de workspace: `owner`, `admin`, `member`, `viewer`.
