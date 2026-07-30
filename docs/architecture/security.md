# Segurança e isolamento

## Regras desde o início

- Todo acesso financeiro filtra por `workspaceId`
- Usuário só acessa workspaces com membership
- `workspaceId` do frontend não é fonte da verdade; a API resolve a partir do contexto autenticado
- Logs estruturados sem tokens/senhas (redaction no logger/Fastify)
- Arquivos privados; URLs temporárias no futuro
- Ações relevantes devem poder gerar `AuditLog`

## Extensões preparadas (não implementadas)

- Autenticação JWT
- Autorização por papel (`owner|admin|member|viewer`)
- Idempotência de writes
- Rate limit
- Upload assinado para MinIO/S3

## Estado atual

Rotas de Taxonomy aceitam `workspaceId` no request apenas para validar a arquitetura. Antes de produção, isso deve ser substituído pelo workspace autorizado da sessão.
