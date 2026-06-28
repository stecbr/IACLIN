# Bloco 3 — Lotes de Convênio & Conciliação de Glosas

Reaproveita `financial_transactions.insurance_invoice_period/status` (já existe) e a tela `src/pages/financial/InsuranceInvoices.tsx`. Adiciona a entidade de glosa e o fluxo de conciliação manual por lote (operadora × mês).

---

## 1. Migração — `insurance_glosas`

```sql
CREATE TABLE public.insurance_glosas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL REFERENCES public.insurance_operators(id) ON DELETE RESTRICT,
  insurance_invoice_period varchar(7) NOT NULL,    -- 'YYYY-MM'
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  expected_amount numeric(10,2) NOT NULL,
  received_amount numeric(10,2) NOT NULL,
  glosa_amount   numeric(10,2) NOT NULL,
  reason text,
  status varchar(20) NOT NULL DEFAULT 'identified'
    CHECK (status IN ('identified','accepted','contested','recovered')),
  loss_transaction_id uuid REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_glosas TO authenticated;
GRANT ALL ON public.insurance_glosas TO service_role;
ALTER TABLE public.insurance_glosas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members read glosas" ON public.insurance_glosas
  FOR SELECT TO authenticated USING (public.user_belongs_to_clinic(auth.uid(), clinic_id));
CREATE POLICY "Clinic members write glosas" ON public.insurance_glosas
  FOR INSERT TO authenticated WITH CHECK (public.user_belongs_to_clinic(auth.uid(), clinic_id));
CREATE POLICY "Clinic members update glosas" ON public.insurance_glosas
  FOR UPDATE TO authenticated USING (public.user_belongs_to_clinic(auth.uid(), clinic_id));
CREATE POLICY "Clinic members delete glosas" ON public.insurance_glosas
  FOR DELETE TO authenticated USING (public.user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE INDEX idx_glosas_clinic_period ON public.insurance_glosas(clinic_id, operator_id, insurance_invoice_period);

CREATE TRIGGER trg_glosas_updated_at BEFORE UPDATE ON public.insurance_glosas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

Estende status do lote (sem nova coluna — usa `financial_transactions.insurance_invoice_status`). Valores passam a incluir: `open` · `invoiced` (antigo `sent`) · `paid` · `reconciled`. Mantém compatibilidade lendo `sent` como `invoiced` na UI.

RPC opcional `reconcile_insurance_invoice(_clinic_id, _operator_id, _period, _received_amount, _glosas jsonb, _payment_method)` para aplicar tudo atomicamente:
- marca todas as `financial_transactions` do lote (excluindo as referenciadas em glosas `accepted`) como `paid` + `paid_date = today`;
- marca status do lote como `reconciled`;
- insere registros em `insurance_glosas`;
- para cada glosa `accepted`, cria opcionalmente uma `financial_transactions` `expense` / categoria `loss_glosa` e amarra em `loss_transaction_id`.

---

## 2. UI — `src/pages/financial/InsuranceInvoices.tsx`

Refatorar para `Tabs` com 4 abas:

- **Abertos**: grupos com `status = 'open'` (ou null). Mostra contagem e total acumulando no período corrente.
- **Faturados**: `status ∈ ('sent','invoiced')`. Botão "Conciliar pagamento" abre `ReconcileInvoiceDialog`.
- **Recebidos**: `status ∈ ('paid','reconciled')`. Mostra valor esperado vs. recebido vs. glosa total (join com `insurance_glosas` do mesmo período/operadora).
- **Glosas**: lista plana de `insurance_glosas` da clínica com filtros por operadora/período/status; ações: marcar como `contested`, `accepted`, `recovered`; ver consulta vinculada.

Botão "Marcar como faturada" do fluxo atual passa a setar `insurance_invoice_status='invoiced'` (manter aceitar `sent` na leitura por retrocompatibilidade).

---

## 3. Conciliação Manual — `ReconcileInvoiceDialog.tsx` (novo)

Arquivo: `src/components/finance/ReconcileInvoiceDialog.tsx`.

Estrutura:

1. **Cabeçalho** — operadora + período + Valor Esperado (sum `amount` do lote).
2. **Input "Valor depositado pela operadora"** com máscara BRL.
3. Se `recebido < esperado`: aparece **Painel de Glosas** com a lista de transações do lote (paciente · data · valor). O usuário escolhe:
   - **Glosa por consulta**: marca itens, informa `reason` por item; a soma de glosas precisa fechar com `esperado - recebido` (mostra contador "Faltam R$ X").
   - **Glosa geral do lote** (`appointment_id = null`): aceita a diferença com um único motivo.
4. Cada glosa pode ser marcada como `accepted` (perde) ou `contested` (em discussão; gera glosa mas não cria transação de perda).
5. Campo `payment_method` (PIX / Transferência / Boleto / Outro) + observações.
6. Botão **Confirmar conciliação** → chama RPC `reconcile_insurance_invoice`. Em sucesso: invalida `['insurance-invoices', clinicId]` e `['insurance-glosas', clinicId]`, toast, fecha.

Validações: bloqueia confirmar se `glosas accepted+contested` ≠ `esperado - recebido` (a não ser que usuário marque "diferença é bonificação/sobra", caso `recebido > esperado` — fora de escopo nesse bloco, apenas mostra aviso).

---

## 4. Hooks novos — `src/hooks/useInsuranceInvoices.ts`

- `useInsuranceInvoiceGroups(clinicId)` — agrega `financial_transactions` por `(operator_id, insurance_invoice_period)` e devolve `{ status, expected, received_estimate, count, items }`.
- `useInsuranceGlosas(clinicId, filters?)` — lista glosas.
- `useReconcileInvoice()` — mutation que chama o RPC.

Substitui parte do que hoje está inline no `InsuranceInvoices.tsx`.

---

## 5. Auditoria & não-escopo

- `FinishPaymentDialog.tsx` continua marcando consulta de convênio como `pending` + status `open` (intocado).
- `OperatorBilling.tsx` (lado operadora) **não muda**.
- Sem alterar Bloco 1/2 (`useFinanceVisibility`, `commission_payouts`, etc.).
- Glosa só existe no lado clínica. Sem notificação para operadora.

---

## 6. Critérios de aceite

1. Tela `/financial/insurance-invoices` mostra 4 abas funcionais.
2. Conciliação com `recebido = esperado` move o lote para "Recebidos" sem criar glosa.
3. Conciliação com `recebido < esperado` exige fechar a diferença em glosas; salva tudo atomicamente.
4. Glosa `accepted` gera (opcionalmente) `financial_transactions` `expense / loss_glosa` amarrada via `loss_transaction_id`.
5. Aba "Glosas" lista, filtra e permite mudar status (`identified → contested → recovered/accepted`).
6. Transações do lote passam a `status='paid'` ao conciliar; lote = `reconciled`.

---

## 7. Arquivos

Migração nova (1) — tabela `insurance_glosas` + RPC `reconcile_insurance_invoice`.

Novos:
- `src/components/finance/ReconcileInvoiceDialog.tsx`
- `src/components/finance/GlosasPanel.tsx`
- `src/hooks/useInsuranceInvoices.ts`

Editados:
- `src/pages/financial/InsuranceInvoices.tsx` (4 abas + integração com dialog/panel)

Posso prosseguir?
