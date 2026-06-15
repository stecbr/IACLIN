# Procedimentos da operadora no atendimento

## Comportamento desejado

Durante um atendimento (`/atendimento/:id`), na aba **Procedimentos Realizados**:

- **Se o paciente tem convênio** (`patients.insurance_provider` casa com uma operadora ativa em `insurance_operators.name` e a clínica está credenciada nessa operadora):
  - O seletor de procedimento carrega itens da **tabela de valores da operadora** (`operator_price_items` via `operator_price_tables`).
  - Filtro de tabela vigente: `valid_from <= hoje` e (`valid_until IS NULL OR valid_until >= hoje`).
  - Filtro geográfico: tabela cujo `state` bate com o estado da clínica, ou com `state IS NULL` (cobertura nacional). Se a operadora não tiver tabela para aquele estado, mostramos aviso e caímos no catálogo próprio + digitação manual.
  - O **preço** vem de `value_brl` e fica **somente leitura** (chip "Tabela da operadora"). Categoria e código TUSS exibidos como metadados.
  - Continua sendo possível digitar manualmente um procedimento (fora da tabela), mas com aviso "fora da cobertura — particular".

- **Se o paciente é particular** (sem `insurance_provider` ou operadora não credenciada/não encontrada):
  - Mantém o fluxo atual: catálogo da clínica (`procedures` filtrado por `clinic_id`) + opção "Digitar manualmente". Preço editável.

A mudança é **só na origem da lista e no lock de preço quando vier da operadora**. Schema, RLS, salvamento em `clinical_record_procedures` e financeiro continuam idênticos (já guardamos `procedure_id` quando catálogo da clínica, ou nome+preço manual; itens da operadora serão salvos como manuais com o nome/preço da tabela e observação contendo o TUSS — não criamos FK nova).

## Detalhes técnicos

### 1. Hook novo: `src/hooks/useOperatorPriceCatalog.ts`

Entrada: `{ insuranceProviderName, clinicState }`.

Passos:
1. Resolver `operator_id`: `select id, active_states from insurance_operators where is_active and lower(name) = lower(:name) limit 1`.
2. Verificar credenciamento (RLS já bloqueia, mas pegamos cedo para mensagem): `select 1 from operator_credentialings where operator_id=... and clinic_id=... and status='approved'`.
3. Buscar tabela vigente:
   ```
   select t.id, t.name, t.state
   from operator_price_tables t
   where t.operator_id = :op
     and t.valid_from <= current_date
     and (t.valid_until is null or t.valid_until >= current_date)
     and (t.state is null or t.state = :uf)
   order by (t.state = :uf) desc nulls last, t.valid_from desc
   limit 1
   ```
4. Buscar itens: `select id, procedure_name, category, tuss_code, value_brl, charge_type from operator_price_items where table_id = :t order by category, sort_order, procedure_name`.

Retorna: `{ status: 'operator' | 'no-table' | 'not-covered' | 'particular', items, operator, table }`.

### 2. `src/pages/Attendance.tsx`

- A query do paciente já traz `insurance_provider`. Passar para o hook junto com o estado da clínica (acrescentar `state` ao `clinics` no `useClinicContext` — se já existir, ótimo; caso contrário, fetch leve em paralelo).
- Quando `status === 'operator'`:
  - Substituir a fonte de `proceduresCatalog` pelo retorno do hook.
  - Renderizar badge no topo da aba: "Convênio: {operator.name} — Tabela {table.name}".
  - Ao escolher um item, gravar como linha **manual** (`is_manual: true`, `custom_name: item.procedure_name`, `price: item.value_brl`, `notes: 'TUSS ' + item.tuss_code` quando houver) — preço travado (input `disabled`).
  - Botão "Digitar manualmente" continua disponível para itens fora da tabela.
- Quando `status === 'no-table'`: banner amarelo "Operadora X sem tabela vigente para {UF} — cobrando como particular" e cai no catálogo da clínica.
- Quando `status === 'not-covered'`: banner "Clínica não credenciada à operadora X" + catálogo da clínica.
- Quando `status === 'particular'`: comportamento atual, sem banner.

### 3. Sem migrations

Nenhuma alteração de schema, RLS, edge function ou tipos. As policies `optr_price_tables_clinic_read` e `optr_price_items_clinic_read` já liberam leitura quando o membro da clínica está em `operator_credentialings` da operadora.

## Fora de escopo

- Faturamento/glosa por operadora, geração de guia TISS, e linkagem estrutural de `clinical_record_procedures` a `operator_price_items` (continuamos salvando como manual com nome/preço congelados).
- Edição da tabela de valores da operadora (já existe em `/operadora/tabela-valores`).
- Fluxo de pagamento (`FinishPaymentDialog`) — o total já soma o que estiver na lista.
