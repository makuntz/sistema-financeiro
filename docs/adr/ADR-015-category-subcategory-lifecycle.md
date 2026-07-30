# ADR-015 — Ciclo de vida de Category e Subcategory

## Status

Aceito

## Contexto

Categorias e subcategorias classificam planejamentos e lançamentos futuros. Uma exclusão física quebraria o histórico financeiro e relatórios.

A interface usa o termo “Arquivar”; a API e o domínio usam `inactivate` / `reactivate`.

## Decisão

1. **Sem exclusão física** de Category ou Subcategory.
2. **Inativação** (`isActive = false`) preserva o registro e a unicidade histórica do nome normalizado.
3. **Unicidade:**
   - Category: `(workspaceId, type, normalizedName)`
   - Subcategory: `(workspaceId, categoryId, normalizedName)`
4. **Categoria inativa:** não aceita novas subcategorias; subcategorias filhas ativas deixam de aparecer nas seleções operacionais enquanto a categoria estiver inativa (disponibilidade derivada).
5. **Reativar categoria:** torna novamente utilizáveis as subcategorias que continuam `isActive = true`.
6. **Listagem padrão:** apenas ativos; `includeInactive=true` para gestão.
7. **GET `/v1/categories`** retorna subcategorias aninhadas (consulta com `include`, sem N+1) para simplificar a primeira tela; mutations permanecem em endpoints dedicados.

## Alternativas

- Soft-delete com `deletedAt` separado de `isActive` — rejeitado por complexidade nesta etapa.
- Cascata de inativação de todas as subcategorias ao arquivar a categoria — rejeitado; a disponibilidade operacional já deriva do estado da categoria.

## Consequências

- Seeds e migrações nunca apagam cadastros referenciáveis.
- Telas de planejamento futuras devem filtrar categorias/subcategorias ativas e categoria pai ativa.
- Renomear para um nome já usado (mesmo normalizado) retorna `CATEGORY_ALREADY_EXISTS` / `SUBCATEGORY_ALREADY_EXISTS`.
