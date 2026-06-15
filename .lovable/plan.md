# Fluxo de Comissões e Aprovações — Plano

Hoje o módulo tem duas lacunas que quebram o fluxo:

1. **Comissões** ficam só no `localStorage` (banner amarelo na imagem). Não sincronizam entre dispositivos, não geram lançamentos no financeiro e o "Faturado" do profissional ignora atendimentos finalizados por convênio (porque hoje só conta `paid`).
2. **Aprovações** funcionam para lançamentos criados manualmente no `TransactionDialog`, mas o `FinishPaymentDialog` (botão "Finalizar consulta") insere a receita direto como `approved`, ignorando o gate de dentista em clínica multiusuário. Por isso uma consulta finalizada pelo dentista aparece no financeiro da clínica sem passar pela secretária/admin.

## O que vai mudar

### 1. Persistir regras de comissão no banco
- Nova tabela `commission_rules` (clinic_id, dentist_id, trigger, type, value, insurance_provider, specialty, created_by).
- RLS: leitura para membros da clínica; escrita só para admin/secretária (ou modo solo).
- `CommissionsPanel.tsx` passa a usar a tabela via React Query (remove `localStorage` e o banner amarelo).

### 2. Geração automática de despesas de comissão
- Quando uma transação de receita transita para o estado que dispara a regra (`after_procedure` no insert aprovado / `after_payment` ao marcar como `paid`), cria-se uma linha `expense` em `financial_transactions` com `category='commission'`, `dentist_id` do profissional comissionado, `description` referenciando o atendimento.
- Implementado em utilitário `src/lib/commissions.ts` chamado por:
  - `FinishPaymentDialog` (após aprovar, quando `after_procedure`).
  - Aprovação da `ApprovalsList` (quando dentista vira `approved`).
  - Mutação "marcar como pago" (`after_payment`).
- Evita duplicidade gravando `appointment_id` + `category='commission'` + `dentist_id` como chave lógica (checa antes de inserir).

### 3. Aprovação no fechamento de atendimento
- `FinishPaymentDialog` passa a usar `canManageClinicFinance` igual ao `TransactionDialog`.
- Se o usuário é dentista numa clínica multiusuário: a transação criada nasce com `approval_status='awaiting_approval'`, `status='pending'`, `approval_requested_by=user.id`. Toast: "Consulta finalizada. Cobrança enviada para aprovação da secretaria/admin."
- Caso contrário (admin, secretária, solo, pessoal): mantém o comportamento atual (`approved`).
- A comissão automática só é gerada após a aprovação efetiva (quando `awaiting_approval → approved` na `ApprovalsList`).

### 4. KPI "Faturado no período" do painel de comissões
- Passa a considerar transações `approved` no período, com fallback para `status in ('paid','pending')` dependendo do trigger:
  - `after_payment`: soma só `paid`.
  - `after_procedure`: soma `approved` (pago + a receber).
- Mostra também total de comissão já lançada como despesa (linhas `category='commission'`) para conferência.

## Fora do escopo
- Pagamento efetivo das comissões ao dentista (botão "marcar comissão como paga" continua sendo edição manual da linha de despesa).
- Regras retroativas: a geração automática só vale para atendimentos finalizados após o deploy.
- Rateio entre múltiplos profissionais por procedimento.
- Notificações push/WhatsApp para aprovação (banner do sino existente já cobre).

## Detalhes técnicos

**Migração:**
```sql
create table public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  dentist_id uuid not null,
  trigger text not null check (trigger in ('after_procedure','after_payment')),
  type text not null check (type in ('percentage','fixed')),
  value numeric not null check (value > 0),
  insurance_provider text,
  specialty text,
  created_by uuid,
  created_at timestamptz default now()
);
grant select, insert, update, delete on public.commission_rules to authenticated;
grant all on public.commission_rules to service_role;
alter table public.commission_rules enable row level security;
-- policies: select para qualquer clinic_member da clínica; write só admin/secretary/solo
```

**Arquivos editados:**
- `src/components/finance/CommissionsPanel.tsx` — troca localStorage por React Query + mutations.
- `src/components/attendance/FinishPaymentDialog.tsx` — aplica gate de aprovação + dispara comissão `after_procedure`.
- `src/pages/Financial.tsx` (`ApprovalsList`) — dispara comissão ao aprovar.
- `src/lib/commissions.ts` (novo) — função `generateCommissionForTransaction(txId)`.
- Migração SQL nova para `commission_rules`.

**Estados de aprovação resultantes:**
```text
Dentista finaliza consulta
        │
        ▼
 awaiting_approval ──► (admin/secretária aprova) ──► approved ──► gera despesa de comissão
        │
        └──► (admin/secretária recusa) ──► rejected (não gera comissão)
```
