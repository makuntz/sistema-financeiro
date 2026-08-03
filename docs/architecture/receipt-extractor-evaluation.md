# Avaliação futura de extrator de notas (Receipt Extractor)

Este documento define **como** escolheremos um fornecedor real de OCR/IA para notas fiscais e comprovantes brasileiros. **Etapa 6 não integra nenhum fornecedor real** — apenas `FakeReceiptExtractor` (`RECEIPT_EXTRACTOR_PROVIDER=fake`). **Nenhum vencedor está declarado** nesta etapa.

Referências: [ADR-020](../adr/ADR-020-receipt-capture-and-processing.md), [ADR-022](../adr/ADR-022-receipt-extractor-provider-abstraction.md).

---

## Critérios obrigatórios (34)

Cada candidato será avaliado nestes critérios. Pesos finais serão definidos antes do benchmark; todos devem ser pontuados ou documentados como N/A.

| #   | Critério                              | O que medir                                                      |
| --- | ------------------------------------- | ---------------------------------------------------------------- |
| 1   | Precisão em notas fiscais brasileiras | NFC-e, cupom térmico, comprovante de cartão, layout supermercado |
| 2   | Extração de itens                     | Linhas de produto identificadas vs. ruído de cabeçalho/rodapé    |
| 3   | Valor por linha                       | `lineTotalInCents` correto por item                              |
| 4   | Quantidade                            | Valores numéricos e formatos (`1`, `1,250`, `6 un`)              |
| 5   | Preço unitário                        | Quando impresso na nota                                          |
| 6   | Produtos por peso                     | kg, gramas, preço/kg                                             |
| 7   | Descontos                             | Linhas ou totais de desconto                                     |
| 8   | Acréscimos                            | Taxas, arredondamentos, frete na nota                            |
| 9   | Data                                  | `purchaseDate` DateOnly (`YYYY-MM-DD`)                           |
| 10  | Estabelecimento                       | `merchantName` quando presente                                   |
| 11  | Total                                 | `totalAmountInCents` vs. soma dos itens                          |
| 12  | Notas longas                          | 20+ itens, várias páginas                                        |
| 13  | Fotos inclinadas                      | Perspectiva e rotação                                            |
| 14  | Fotos escuras                         | Baixa luminosidade                                               |
| 15  | Notas amassadas                       | Dobra, sombra, compressão                                        |
| 16  | Notas térmicas apagadas               | Tinta desbotada                                                  |
| 17  | Abreviações de produtos               | Nomes truncados típicos de PDV                                   |
| 18  | Resposta estruturada                  | JSON/schema compatível com `ReceiptExtractionResult`             |
| 19  | Taxa de campos que exigem correção    | % de campos editados pelo usuário                                |
| 20  | Latência                              | p50 / p95 por nota (upload → resultado)                          |
| 21  | Custo por nota                        | Preço unitário ou token/imagem                                   |
| 22  | Limites mensais                       | Quotas, throttling, overage                                      |
| 23  | Privacidade                           | O que o provedor armazena e por quanto tempo                     |
| 24  | Retenção                              | Política de retenção de imagens/texto no provedor                |
| 25  | Região do processamento               | Onde os bytes são processados (Brasil vs. exterior)              |
| 26  | LGPD                                  | Base legal, DPA, subprocessadores, direitos do titular           |
| 27  | Contrato de uso de dados              | Treino de modelos com dados do cliente                           |
| 28  | Observabilidade                       | Logs, métricas, tracing, códigos de erro                         |
| 29  | Disponibilidade                       | SLA/uptime histórico                                             |
| 30  | Vendor lock-in                        | Proprietário vs. padrões abertos                                 |
| 31  | Facilidade de substituição            | Esforço para trocar implementando `ReceiptExtractor`             |
| 32  | SDK versus API HTTP                   | Dependências, versões, manutenção                                |
| 33  | Suporte                               | Documentação, tickets, comunidade                                |
| 34  | SLA                                   | Penalidades, janelas de manutenção                               |

---

## Plano de benchmark (futuro)

**Não implementar integrações reais nem instalar SDKs de fornecedores nesta etapa.** O benchmark será uma etapa separada, usando a porta `ReceiptExtractor` já existente.

### Corpus

- **30–50 notas reais** (anonimizadas), cobrindo categorias:

| Categoria        | Exemplos                       |
| ---------------- | ------------------------------ |
| Supermercado     | Nota longa, mista, desconto    |
| Padaria          | Poucos itens                   |
| Farmácia         | Itens regulados / nomes longos |
| Posto            | Combustível, conveniência      |
| Restaurante      | Couvert, taxa                  |
| Loja de material | Poucos itens de alto valor     |
| Nota curta       | ≤ 5 itens                      |
| Nota longa       | ≥ 15 itens                     |
| Nota clara       | Boa foto, boa luz              |
| Nota apagada     | Térmica desbotada              |
| Foto inclinada   | Perspectiva                    |
| Iluminação ruim  | Sombra / flash                 |
| Produto por peso | Carnes, frios                  |
| Descontos        | Cupom, promoção                |

### Métricas por nota e por provedor

- Data correta (sim/não)
- Total correto (sim/não; tolerância 2 centavos alinhada a `RECEIPT_TOTAL_TOLERANCE_CENTS`)
- Itens encontrados (contagem)
- Falsos itens (linhas inventadas)
- Valores corretos por linha (%)
- Quantidades corretas (%)
- Tempo de processamento (s)
- Custo estimado (R$)
- **Correções manuais necessárias** (contagem de campos editados)

### KPI principal

**Tempo médio de correção humana por nota** — desde o fim da extração até o estado em que o usuário consideraria a captura pronta para confirmar (classificação incluída, quando aplicável ao teste).

Hipótese: o extrator que minimiza esse tempo, respeitando privacidade e custo aceitável, será preferido — decisão formal só após benchmark completo e ADR de seleção.

### Processo

1. Implementar adaptador(s) `ReceiptExtractor` para candidatos shortlist (fora do escopo Etapa 6).
2. Rodar o mesmo corpus contra cada candidato + baseline `FakeReceiptExtractor` (sanity only).
3. Registrar resultados em planilha ou ferramenta interna; **não declarar vencedor** sem revisão de LGPD/custo.
4. ADR dedicado documentando escolha, trade-offs e plano de rollback.

---

## Fora de escopo na Etapa 6

- Instalação de SDKs OpenAI, Anthropic, Google Cloud Vision/Document AI, Amazon Textract, Azure Document Intelligence, Mindee, Veryfi, Rossum, Nanonets, etc.
- Chamadas HTTP reais a serviços externos de OCR/IA
- Chaves de API obrigatórias para desenvolvimento local
- Ferramenta automatizada de benchmark (apenas plano conceitual acima)

---

## Implementação atual (referência)

| Peça                     | Local                                                                 |
| ------------------------ | --------------------------------------------------------------------- |
| Porta `ReceiptExtractor` | `packages/domain/src/receipts/receipt-extractor.ts`                   |
| `FakeReceiptExtractor`   | idem                                                                  |
| Contrato de saída        | `packages/contracts/src/receipt-captures.ts`                          |
| Env                      | `RECEIPT_EXTRACTOR_PROVIDER=fake`, `RECEIPT_ALLOW_FAKE_IN_PRODUCTION` |
| Worker                   | `apps/api/src/workers/receipt-worker.ts`                              |
