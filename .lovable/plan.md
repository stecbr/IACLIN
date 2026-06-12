# Plano: Tabela de Valores por Estado (Operadora)

A página `OperatorPriceTable.tsx` já tem CRUD de tabelas, itens e upload de arquivo. Vou refatorar o fluxo principal para o modelo "por estado" e adicionar parser inteligente.

## 1. Banco de dados (migração)

Adicionar coluna em `insurance_operators`:
- `active_states text[] default '{}'` — UFs onde a operadora atua.

Garantir índice em `operator_price_tables(operator_id, state)` para busca rápida.

Bucket `operator-price-files` (privado) para armazenar PDFs/planilhas originais — RLS: membros da operadora dona da tabela.

## 2. UI: seletor de estados (topo da página)

Substituir o atual seletor de "tabela ativa" por um fluxo de 2 níveis:

**Nível 1 — Grid de estados ativos** (cards destacados no topo):
- Cada UF ativa = card com sigla grande, nome, contador de procedimentos cadastrados, badge de status (vigência).
- Botão "+ Adicionar estado" abre um popover com grid de todas as 27 UFs (as não-selecionadas em cinza); clicar adiciona à lista ativa (atualiza `active_states`).
- Seção colapsável "Ver outros estados" mostra UFs inativas em formato compacto.

**Nível 2 — Visão do estado** (ao clicar num card):
- Header com UF + vigência + ações (Upload, Adicionar manual, Voltar).
- Se não existir tabela vigente para a UF, criar automaticamente ao primeiro upload/cadastro.
- Lista de procedimentos em `<Table>` responsiva: Procedimento · TUSS · Tipo Cobrança · Valor Base (US/UCO) · Valor R$ · Ações.
- Busca + filtro por categoria mantidos.

## 3. Edição inline

Cada célula editável vira `<input>` ao clicar (Procedimento, TUSS, Tipo, Valor US, Valor R$). Salva no blur com `update` em `operator_price_items`. Feedback otimista + toast em erro.

Botão lixeira por linha (já existe).

## 4. Upload de planilha/PDF com parser IA

Nova edge function `parse-price-table`:
- Recebe `table_id` + arquivo (PDF/XLSX/CSV).
- XLSX/CSV: lê via `xlsx` (npm) → texto/CSV.
- PDF: extrai texto via `pdf-parse` (npm) ou converte para texto antes de mandar.
- Chama Lovable AI (`google/gemini-2.5-flash`) com prompt pedindo JSON estruturado:
  ```
  [{ category, procedure_name, tuss_code, charge_type, value_us, value_brl, observations, rx_required, photo_required, longevity, plan_coverage }]
  ```
- Insere em lote em `operator_price_items` e grava registro em `operator_price_files` com URL do storage para download.
- Retorna `{ inserted: N, items: [...] }`.

Frontend:
- Botão "Importar arquivo" → input file → mostra progresso ("Lendo arquivo…", "Interpretando com IA…", "Salvando N procedimentos…").
- Ao terminar, a tabela é recarregada e o usuário pode revisar/editar inline qualquer campo que a IA leu errado.
- Card "Arquivos originais" lista os PDFs/planilhas com botão download (signed URL).

## 5. Cadastro manual

Manter o dialog atual (já tem todos os campos). Garantir que o `state` é herdado da UF aberta automaticamente.

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — coluna `active_states`, bucket `operator-price-files`, RLS.
- `supabase/functions/parse-price-table/index.ts` — nova edge function.
- `src/pages/operadora/OperatorPriceTable.tsx` — refatoração completa (seletor de estados + visão de estado + edição inline + integração da função).
- `src/lib/brazilStates.ts` — lista de 27 UFs (sigla + nome) se ainda não existir.

## Fora deste escopo

- Edição inline de observações longas / requisitos (RX, foto, longevidade): mantém dialog separado.
- Versionamento histórico de tabelas (apenas vigência atual).
- Exportação para Excel/PDF.

## Dúvida rápida

A operadora deve ter **uma única tabela vigente por UF** (modelo simples — todas as alterações vão na mesma tabela) ou **múltiplas tabelas por UF com vigências diferentes** (já suportado hoje, mais complexo na UI)? Vou assumir **uma tabela vigente por UF** salvo indicação contrária.
