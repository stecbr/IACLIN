
# Bloco 2 — Fechamento de Período & Fluxo de Repasses

Mantém intactos `src/lib/commissions.ts`, `commission_rules`, geração automática e tudo do Bloco 1. Só adiciona a camada de **fechamento** (consolidação de comissões pendentes em um lote pago).

---

## 1. Migração de banco

Nova tabela `commission_payouts` + coluna em `financial_transactions`.

```sql
CREATE TABLE public.commission_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  dentist_id uuid NOT NULL,                 -- profiles.id / clinic_members.user_id
  period_start date NOT NULL,
  period_end   date NOT NULL,
  total_amount numeric(10,2) NOT NULL,
  transactions_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'paid'        -- 'paid' | 'pending_payment'
    CHECK (status IN ('paid','pending_payment','cancelled')),
  payment_method text,                       -- 'pix' | 'transfer' | 'cash' | 'other'
  notes text,
  paid_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.commission_payouts TO authenticated;
GRANT ALL ON public.commission_payouts TO service_role;

ALTER TABLE public.commission_payouts ENABLE ROW LEVEL SECURITY;

-- Admins/owners/secretária da clínica veem e gerenciam (gate de financeiro fica na app).
CREATE POLICY "Clinic members read payouts"
  ON public.commission_payouts FOR SELECT TO authenticated
  USING (public.user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins write payouts"
  ON public.commission_payouts FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins update payouts"
  ON public.commission_payouts FOR UPDATE TO authenticated
  USING (public.user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE INDEX idx_payouts_clinic_dentist ON public.commission_payouts(clinic_id, dentist_id, period_end DESC);

-- updated_at trigger (reusa update_updated_at_column existente)
CREATE TRIGGER trg_commission_payouts_updated_at
  BEFORE UPDATE ON public.commission_payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Amarração no extrato:
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS payout_id uuid REFERENCES public.commission_payouts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ft_payout_id ON public.financial_transactions(payout_id);
```

RPC para fechar período de forma atômica (evita race-condition entre marcar `paid` e criar o lote):

```sql
CREATE OR REPLACE FUNCTION public.close_commission_period(
  _clinic_id uuid,
  _dentist_id uuid,
  _period_start date,
  _period_end date,
  _payment_method text DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS public.commission_payouts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total numeric(10,2);
  v_count int;
  v_payout public.commission_payouts;
BEGIN
  -- Authorization: caller must belong to clinic
  IF NOT public.user_belongs_to_clinic(auth.uid(), _clinic_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(amount),0), COUNT(*)
    INTO v_total, v_count
    FROM public.financial_transactions
   WHERE clinic_id = _clinic_id
     AND dentist_id = _dentist_id
     AND type = 'expense'
     AND category = 'commission'
     AND status = 'pending'
     AND payout_id IS NULL
     AND COALESCE(due_date, created_at::date) BETWEEN _period_start AND _period_end;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Nenhuma comissão pendente neste período';
  END IF;

  INSERT INTO public.commission_payouts(
    clinic_id, dentist_id, period_start, period_end,
    total_amount, transactions_count, status, payment_method, notes,
    paid_at, created_by
  ) VALUES (
    _clinic_id, _dentist_id, _period_start, _period_end,
    v_total, v_count, 'paid', _payment_method, _notes,
    now(), auth.uid()
  ) RETURNING * INTO v_payout;

  UPDATE public.financial_transactions
     SET status = 'paid',
         paid_date = CURRENT_DATE,
         payout_id = v_payout.id,
         updated_at = now()
   WHERE clinic_id = _clinic_id
     AND dentist_id = _dentist_id
     AND type = 'expense'
     AND category = 'commission'
     AND status = 'pending'
     AND payout_id IS NULL
     AND COALESCE(due_date, created_at::date) BETWEEN _period_start AND _period_end;

  -- Notifica o profissional
  INSERT INTO public.notifications(clinic_id, user_id, type, title, message, reference_id, reference_type)
  VALUES (
    _clinic_id, _dentist_id, 'financial',
    'Repasse recebido',
    'Foi registrado um repasse de R$ ' || to_char(v_total,'FM999G999G990D00') ||
      ' referente ao período ' || to_char(_period_start,'DD/MM') || '–' || to_char(_period_end,'DD/MM/YYYY') || '.',
    v_payout.id, 'commission_payout'
  );

  RETURN v_payout;
END $$;
```

---

## 2. UI — Aba "Repasses" no `/financial`

Edição em `src/pages/Financial.tsx`: adicionar aba **"Repasses"**, visível somente quando `useFinanceVisibility().canSeePayouts === true` (clínica + staff com perm). Reaproveita a aba de comissões existente — substitui o conteúdo dela pela nova UI quando estiver no modo clínica/staff.

Novos arquivos:

- `src/components/finance/PayoutsPanel.tsx`
  - **Tabela "A pagar por profissional"** (saldo aberto):
    - Query agregada: `financial_transactions` com `clinic_id` atual, `type='expense'`, `category='commission'`, `status='pending'`, `payout_id IS NULL`, agrupada por `dentist_id`.
    - Colunas: Profissional · Comissões pendentes (nº) · Período mais antigo · Total acumulado · botão **Fechar período**.
  - **Histórico de fechamentos** (abaixo): lista de `commission_payouts` da clínica, mais recente primeiro, com profissional, período, total, método, notas, data de pagamento.

- `src/components/finance/ClosePayoutDialog.tsx`
  - Abre ao clicar "Fechar período" de um profissional.
  - Mostra range padrão (`min(due_date)` → hoje), permite editar `period_start` e `period_end`.
  - Lista de cada comissão dentro do range (data · paciente · valor) com **somatório atualizado**.
  - Campo `payment_method` (select: PIX / Transferência / Dinheiro / Outro) + `notes` (textarea).
  - Botão "Confirmar pagamento" → `supabase.rpc('close_commission_period', {...})`.
  - Em sucesso: toast, invalida `['payouts-open', clinicId]`, `['payout-history', clinicId]`, `['my-commissions', ...]` e fecha.

Hook novo: `src/hooks/usePayouts.ts` com `usePendingByDentist(clinicId)` e `usePayoutHistory(clinicId)`.

---

## 3. UI — "Meu Financeiro" do dentista vinculado

Edição em `src/pages/dentist/MyFinance.tsx`:

- KPIs "A receber" e "Recebido no mês" já usam `status` — apenas garantir que após o RPC `paid_date` reflete corretamente (já reflete).
- Adicionar Tabs no topo: **"Extrato de comissões"** (já existe) · **"Fechamentos recebidos"** (nova).
- Nova aba lê `commission_payouts` onde `dentist_id = user.id` e `clinic_id = currentClinicId`, ordem `paid_at DESC`. Colunas: Data do pagamento · Período · Nº de procedimentos · Método · Observações · Total.
- Cada linha expansível mostra as comissões amarradas (`financial_transactions.payout_id = payout.id`) — opcional, somente um link "Ver detalhes" que abre Dialog com a lista.

---

## 4. Auditoria & não-escopo

- `src/lib/commissions.ts` permanece intocado — segue gerando `expense + status='pending' + payout_id NULL` (idempotência via `notes`).
- Nada em `commission_rules` muda.
- Sem alterar `Budgets`, `BudgetPaymentDialog`, lotes de convênio (Bloco 3) ou DRE (Bloco 4).
- Solo (`mode==='solo'`) continua sem ver a aba Repasses.
- Staff com `permissions.financeiro=false` continua bloqueado pela rota.

---

## 5. Critérios de aceite

1. Dono/admin/secretária com perm vê aba **Repasses** em `/financial` com saldo agregado por profissional.
2. "Fechar período" abre modal, lista as consultas, ao confirmar: cria `commission_payouts`, marca todas as `financial_transactions` envolvidas como `paid` com `payout_id` preenchido — tudo na mesma transação (RPC).
3. Histórico de fechamentos aparece imediatamente na mesma tela.
4. Dentista vinculado em `/meu-financeiro` vê valor "A receber" cair e "Recebido no mês" subir; nova aba **Fechamentos recebidos** lista o repasse com método e observações.
5. Notificação in-app chega ao profissional no momento do fechamento.
6. Solo não vê Repasses; profissional não vê `/financial`; staff sem perm financeiro segue bloqueado.

---

## 6. Arquivos

Migração nova (1).

Novos:
- `src/hooks/usePayouts.ts`
- `src/components/finance/PayoutsPanel.tsx`
- `src/components/finance/ClosePayoutDialog.tsx`

Editados:
- `src/pages/Financial.tsx` (aba "Repasses" gated por `canSeePayouts`)
- `src/pages/dentist/MyFinance.tsx` (Tabs + aba "Fechamentos recebidos")

Posso prosseguir?
