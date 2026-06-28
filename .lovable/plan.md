## Bloco 4 — Despesas Operacionais, Taxas e DRE Gerencial

Fecha o MVP financeiro: organiza despesas operacionais, registra taxa de cartão sem virar fintech, e cria a tela de DRE alimentada por uma RPC agregadora no Postgres.

---

### 1. Migração — colunas + RPC

**Colunas novas em `financial_transactions`:**
- `card_fee_amount numeric(10,2) DEFAULT 0` — taxa cobrada pela maquininha/gateway (informativa, deduzida no DRE).
- `is_operational boolean GENERATED ALWAYS AS (type = 'expense' AND category NOT IN ('commission','loss_glosa','card_fee')) STORED` — facilita filtros.
- Categoria reservada `'card_fee'` para taxas lançadas como expense (quando o usuário optar por gerar expense separada em vez de só anotar `card_fee_amount`).

Sem novas tabelas — reaproveita `financial_transactions`, `commission_payouts`, `insurance_glosas`.

**RPC `get_clinic_financial_summary(_clinic_id uuid, _start date, _end date, _dentist_id uuid default null)`** — `SECURITY DEFINER`, valida `user_belongs_to_clinic`. Retorna `jsonb`:

```jsonc
{
  "period": { "start": "...", "end": "..." },
  "monthly": [
    {
      "month": "2026-06",
      "revenue_particular": 12000.00,   // income paid, sem operator_id
      "revenue_insurance_received": 4500.00, // income com operator_id e status reconciled/paid
      "revenue_insurance_invoiced": 8000.00, // income com operator_id e status invoiced/sent (faturado, ainda não recebido)
      "card_fees": 350.00,              // SUM(card_fee_amount) + expenses category='card_fee'
      "glosas_accepted": 600.00,        // insurance_glosas.status='accepted' no período
      "commissions_paid": 3000.00,      // commission_payouts.paid_at no período
      "commissions_pending": 800.00,    // financial_transactions expense/commission status=pending
      "operational_expenses": 4200.00,  // is_operational + status=paid
      "operational_pending": 1500.00,
      "net_result": 7350.00             // bruto - taxas - glosas - comissões pagas - opex pagas
    }
  ],
  "totals": { /* mesmas chaves, somadas no período */ }
}
```

Filtro opcional por `_dentist_id` para a visão "Meu Financeiro" do profissional solo.

---

### 2. Hook — `src/hooks/useFinancialSummary.ts`

`useFinancialSummary({ clinicId, startDate, endDate, dentistId? })` — `useQuery` chamando o RPC. Cacheia por chave `['financial-summary', clinicId, start, end, dentistId]`. Substitui a soma manual feita hoje em `Financial.tsx` / `MyFinance.tsx` (não remove o resto da tela, só passa a alimentar os KPIs mensais a partir do RPC quando disponível).

---

### 3. UI — Contas a Pagar → Operacional

Em `src/pages/Financial.tsx`, na aba **Contas a Pagar**, adicionar sub-abas:

- **Repasses** (já existe — `PayoutsPanel`)
- **Operacional** (nova) — lista `financial_transactions` com `is_operational = true`. Usa `TransactionDialog` existente abrindo já com `type='expense'` e categoria default `rent` (mantém categorias atuais: rent, supplies, salary, other, + novas `utilities`, `marketing`, `internet`).
- **Glosas** continua acessível pela tela de Convênios (Bloco 3), não duplica aqui.

Sem componente novo pesado — só um `OperationalExpensesPanel.tsx` que reaproveita a listagem/filtros já existentes em `Financial.tsx` recortada.

---

### 4. Taxa de cartão nos dialogs de recebimento

Editar `src/components/attendance/FinishPaymentDialog.tsx` e `src/components/budgets/BudgetPaymentDialog.tsx`:

- Quando `payment_method ∈ ('credit_card','debit_card')` aparece campo opcional **"Taxa da maquininha (R$)"** com máscara BRL.
- Ao salvar:
  - grava `card_fee_amount` na própria transação de receita (informativo no DRE);
  - **não** cria expense automática por padrão — mantém simples. Checkbox opcional "Lançar como despesa separada" cria uma `financial_transactions` `expense / card_fee / status=paid` amarrada via `notes` referenciando o id da receita. Default desligado.

`TransactionDialog` também ganha o campo quando `type='income'` + cartão (para lançamentos manuais).

---

### 5. Relatório DRE — `src/pages/financial/FinancialReports.tsx`

Nova rota `/financial/relatorios` (registrada em `App.tsx` + link na sidebar dentro do agrupador Financeiro, gated por `canManageClinicFinance`).

Layout:

1. **Filtros**: período (preset Mês atual / Mês anterior / Últimos 3 meses / Customizado com `DateRangePicker`), `Select` de profissional (apenas quando `effectiveRole = admin`; solo já vem fixado).
2. **Tabela DRE** (linha = mês, coluna = rubrica) na ordem:

```text
(+) Faturamento particular
(+) Faturamento convênio (recebido)
(+) Faturamento convênio (faturado, não recebido)   [linha cinza, informativa]
(–) Taxas de cartão
(–) Glosas aceitas
(–) Repasses pagos
(–) Despesas operacionais pagas
─────────────────────────────────────────
(=) Resultado líquido                                 [bold, verde/vermelho]
```

3. **Totais do período** no rodapé.
4. Botão **Exportar CSV** — gera client-side a partir do mesmo payload do RPC (sem libs extras; um `Blob` + `URL.createObjectURL`).
5. Empty state quando o período não tiver dados.

Visualmente alinhado ao restante do app (shadcn `Table`, `Card`, tokens semânticos — sem cores hardcoded).

---

### 6. Visibilidade & permissões

- `useFinanceVisibility`: DRE liberado para `solo`, `clinic-admin`, `staff-with-finance`. Profissional vinculado (`professional`) **não** acessa DRE — continua só vendo `MyFinance`.
- RPC valida `user_belongs_to_clinic`; quando `_dentist_id` é passado, exige que o caller seja admin OU o próprio dentista.

---

### 7. Fora de escopo (mantém limpo)

- Sem cálculo automático de taxa por bandeira/parcela (usuário digita o valor).
- Sem DRE comparativo / projeções.
- Sem geração de PDF — só CSV.
- Sem mexer em Marketplace, Agenda, IA, operadora.

---

### 8. Arquivos

**Migração (1)** — colunas `card_fee_amount` / `is_operational` em `financial_transactions` + RPC `get_clinic_financial_summary`.

**Novos:**
- `src/hooks/useFinancialSummary.ts`
- `src/components/finance/OperationalExpensesPanel.tsx`
- `src/pages/financial/FinancialReports.tsx`

**Editados:**
- `src/pages/Financial.tsx` — sub-abas em Contas a Pagar.
- `src/components/attendance/FinishPaymentDialog.tsx` — campo taxa.
- `src/components/budgets/BudgetPaymentDialog.tsx` — campo taxa.
- `src/components/finance/TransactionDialog.tsx` — campo taxa em receitas cartão.
- `src/App.tsx` + `src/components/AppSidebar.tsx` — rota e link de Relatórios.
- `src/hooks/useFinanceVisibility.ts` — flag `canViewReports`.

---

### 9. Critérios de aceite

1. Sub-aba **Operacional** lista, cria e edita despesas não-comissão.
2. Receita paga em cartão aceita registrar taxa; valor aparece deduzido no DRE.
3. `/financial/relatorios` mostra DRE mês a mês com os 7 grupos acima e exporta CSV idêntico ao visível.
4. RPC retorna em < 300 ms para período de 12 meses (sem N+1 no front).
5. Profissional vinculado não vê o item de Relatórios na sidebar.

Pode confirmar para eu prosseguir?
