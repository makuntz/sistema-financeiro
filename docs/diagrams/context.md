# Diagrama C4 — Contexto

```mermaid
C4Context
  title PP Planning — Diagrama de Contexto

  Person(user, "Usuário", "Pessoa ou família que planeja finanças")

  System_Boundary(pp, "PP Planning") {
    System(web, "Web App", "Next.js responsivo")
    System(mobile, "Mobile App", "Expo Android/iOS")
    System(api, "API", "Monólito modular Fastify")
  }

  SystemDb(db, "PostgreSQL", "Dados transacionais")
  System_Ext(s3, "Object Storage S3", "Comprovantes e notas")
  System_Ext(ocr, "OCR / IA", "Processamento futuro de notas fiscais")

  Rel(user, web, "Usa")
  Rel(user, mobile, "Usa")
  Rel(web, api, "HTTPS / JSON")
  Rel(mobile, api, "HTTPS / JSON")
  Rel(api, db, "Prisma")
  Rel(api, s3, "Upload/download privado")
  Rel(api, ocr, "Enfileira processamento (futuro)")
```

## Visão textual

Usuários acessam o PP Planning via web ou mobile. Ambos consomem exclusivamente a API. A API persiste em PostgreSQL, armazena arquivos em storage S3-compatible e, no futuro, integra um serviço de OCR/IA para leitura de notas com revisão humana.
