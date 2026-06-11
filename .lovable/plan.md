## Objetivo
Resolver os 3 itens urgentes: aplicar as 3 migrações pendentes, criar a tela de leitura da Tabela de Valores para clínicas credenciadas, e validar o botão "Encaminhar para operadora".

---

## 1. Aplicar as 3 migrações pendentes no banco

As migrações já existem como arquivos SQL mas não foram executadas. Vou aplicá-las via tool de migração (Cloud), em um único migration consolidado para reduzir aprovações:

- **profiles**: adicionar colunas `phone`, `address`, `address_number`, `address_complement`, `neighborhood`, `city`, `state`, `zip_code` (idempotente — `ADD COLUMN IF NOT EXISTS`).
- **RPC `get_marketplace_doctor_profiles`**: recriar para retornar os novos campos (phone + endereço completo) + `GRANT EXECUTE` para anon/authenticated.
- **Tabela de Valores**: criar `operator_price_tables`, `operator_price_items`, `operator_price_files` com GRANTs (`authenticated` + `service_role`), RLS habilitado e políticas:
  - membros da operadora: full access
  - clínicas credenciadas (via `operator_credentialings` + `clinic_members`): apenas SELECT

Observação: os arquivos `.sql` originais não têm GRANTs explícitos — o migration consolidado vai incluir os GRANTs corretos conforme padrão do projeto.

---

## 2. Tela de leitura da Tabela de Valores para clínicas

**Nova rota:** `/clinica/convenios` (item de menu na sidebar da clínica, grupo Clínica).

**Página `src/pages/clinica/ClinicaConvenios.tsx`:**
- Header com PageHeader ("Convênios e Tabelas de Valores", descrição).
- Query 1: lista das operadoras nas quais a clínica tem credenciamento aprovado (`operator_credentialings` filtrando por `clinic_id` da clínica atual e `status = 'approved'`, join com `insurance_operators`).
- Estado vazio: card informando "Sua clínica ainda não está credenciada com nenhuma operadora."
- **Select de operadora** no topo (com logo + nome).
- Query 2: ao selecionar operadora, busca `operator_price_tables` ativas dela.
- **Select de tabela** (caso a operadora tenha mais de uma — por região/vigência).
- Query 3: `operator_price_items` da tabela escolhida.

**UI da listagem de procedimentos (modo leitura):**
- Barra de busca (filtra por `procedure_name` ou `tuss_code`).
- Filtro por categoria (chips).
- Lista agrupada por categoria com cabeçalho colapsável e contador.
- Cada item mostra: nome, TUSS, tipo de cobrança (badge), valor R$ em destaque, planos cobertos como chips, ícones para RX/foto obrigatórios.
- Botão "Detalhes" abre Dialog com observações e longevidade.
- **Somente leitura** — sem edição, sem exclusão.

**Acesso:** disponível para qualquer membro da clínica (admin, dentista, secretária) — todos precisam consultar valores no atendimento.

**Wiring:**
- Registrar rota em `src/App.tsx` dentro de `ProtectedRoute`.
- Adicionar entrada no `AppSidebar.tsx` (grupo Clínica, ícone `Receipt` ou `DollarSign`).
- Garantir que `useRoleAccess` libere a rota para os 3 papéis.

---

## 3. Botão "Encaminhar para operadora"

Já existe e está implementado em `src/pages/SupportTickets.tsx` (linha 781–832) com lógica `handleForward` que muda status de `pending_owner` → `open`. Ação:

- **Verificar** rapidamente lendo o handler `handleForward` para confirmar que ele faz `update({ status: 'open', operator_id })` corretamente e atualiza a lista.
- Se houver bug (ex: faltando atualizar local state ou faltando `operator_id`), corrigir.
- Sem alterações de UI previstas.

---

## Arquivos afetados
- (nova migração consolidada via tool de migração)
- `src/pages/clinica/ClinicaConvenios.tsx` (novo)
- `src/App.tsx` (rota)
- `src/components/AppSidebar.tsx` (item de menu)
- `src/hooks/useRoleAccess.ts` (liberar rota se necessário)
- `src/pages/SupportTickets.tsx` (somente se `handleForward` estiver com bug)

## Fora do escopo (Prioridade 4)
Agrupamento por categoria no lado do operador, export PDF/Excel e edição inline ficam para depois — exceto o agrupamento no lado da clínica, que já entra naturalmente nesta tela de leitura.