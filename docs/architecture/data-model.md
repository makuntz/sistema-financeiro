# Modelo de dados conceitual

Nesta etapa, apenas `Category` está persistida no Prisma para validar a arquitetura. Demais entidades estão documentadas para orientar o desenho.

## Estratégia de dinheiro

- Tipo: `bigint` (centavos)
- Exemplo: `R$ 191,27 → 19127`
- API: envia/recebe centavos (inteiro)
- UI: formata em BRL pt-BR

### Vantagens

- Sem erro de ponto flutuante
- Operações aritméticas simples e exatas

### Limitações

- Conversão na apresentação
- JSON e `bigint` exigem serialização explícita

## Entidades

### User (Identity)

- Responsabilidade: identidade da pessoa
- Campos: id, name, email, passwordHash, locale, timezone, createdAt, updatedAt
- Relacionamentos: WorkspaceMember, preferências
- Exclusão: soft delete / desativação de conta

### Workspace (Workspaces)

- Responsabilidade: espaço financeiro compartilhado
- Campos: id, name, baseCurrency (BRL), createdAt, updatedAt
- Relacionamentos: members, categories, accounts, plans, transactions
- Exclusão: soft delete; dados financeiros preservados

### WorkspaceMember

- Campos: id, workspaceId, userId, role (`owner|admin|member|viewer`), joinedAt
- Regra: acesso financeiro exige membership

### Category (Taxonomy) — implementada parcialmente

- Campos: id, workspaceId, name, type (`income|expense`), color, icon, order, isActive, createdAt, updatedAt
- Relacionamentos: Subcategory (futuro), MonthlyPlanItem, Transaction
- Regra: inativável; não excluir se houver histórico

### Subcategory

- Campos: id, workspaceId, categoryId, name, color, icon, order, isActive
- Regra: total planejado de categoria de gasto = soma das subcategorias

### IncomeSource

- Campos: id, workspaceId, name, isActive
- Uso: origem de receitas planejadas/realizadas

### Account / Bank

- Account: id, workspaceId, bankId?, name, type, currency, isActive
- Bank: id, name, code?
- Saldos derivados do Ledger (ou snapshot controlado)

### CreditCard / PaymentMethod

- CreditCard: limites, closingDay, dueDay, accountId?
- PaymentMethod: enum/registro (conta, cartão, dinheiro)

### MonthlyPlan / MonthlyPlanItem (Planning)

- MonthlyPlan: workspaceId, yearMonth
- MonthlyPlanItem: subcategoryId/incomeSourceId, plannedAmountCents
- Cópia do mês anterior como caso de uso

### Transaction / Transfer (Ledger)

- Transaction: workspaceId, accountId, amountCents, category/subcategory refs, competenceDate, paymentDate, type
- Transfer: fromAccountId, toAccountId, amountCents
- Exclusão física evitada (estorno/ajuste)

### InstallmentPlan / Installment

- Plano com n parcelas; cada parcela com competência e status

### RecurringRule

- Frequência, próxima execução, ativo/pausado

### Attachment / ReceiptProcessingJob / ClassificationRule (Documents + Receipt)

- Attachment: metadados + storage key
- Job: estado OCR/IA, confiança, revisão humana
- Regra: não lançar no Ledger sem confirmação

### Goal

- Meta por valor/categoria; progresso derivado

### AuditLog

- actorId, entity, entityId, before, after, occurredAt

## Regras obrigatórias

1. Todo registro financeiro tem `workspaceId`
2. Categorias/subcategorias inativáveis
3. Histórico nunca quebra por inativação
4. Transações preservam referência histórica de categoria
5. Sem float/double para dinheiro
