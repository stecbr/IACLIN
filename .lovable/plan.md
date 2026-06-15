## Diagnóstico

Verifiquei o atendimento finalizado no banco. A transação **foi gravada** corretamente:

- `clinic_id`, `dentist_id`, `operator_id` (Unimed), `amount = 50`, `category = 'insurance'`, `insurance_invoice_period = '2026-06'`, `status = 'pending'`, `approval_status = 'approved'`.
- Porém `due_date = 2026-07-20` (dia 20 do mês seguinte).

Três problemas distintos impedem que o registro apareça nas telas:

### 1. Meu Financeiro (Configurações → Meu Financeiro) — vazio
`DentistFinancialSection` filtra por `due_date` entre `startOfMonth(hoje - N meses)` e `endOfMonth(hoje)`. Com `due_date = 2026-07-20`, o registro **cai fora** do período "Últimos 3 meses" (que termina em 30/jun/2026). Por isso "Recebido", "Pendente" e "Total bruto" mostram R$ 0,00.

### 2. Financeiro da Clínica — vazio
`src/pages/Financial.tsx` usa exatamente o mesmo filtro por `due_date` (últimos 6 meses até `endOfMonth(hoje)`). Mesma causa: `due_date` no mês seguinte exclui o lançamento dos KPIs Receita / A Receber e da listagem.

### 3. Painel da Operadora → Faturamento — vazio
`src/pages/operadora/OperatorBilling.tsx` é uma **tela placeholder**: KPIs e lista estão hardcoded em zero, nenhuma consulta ao banco é feita.

Além disso, as RLS atuais de `financial_transactions` só permitem SELECT a membros da clínica ou dono pessoal. **Operadoras não têm permissão de leitura**, então mesmo que a tela consultasse, viria vazio.

## Plano de correção

### A. Alinhar `due_date` ao mês de competência do convênio
Em `src/components/attendance/FinishPaymentDialog.tsx`, dentro de `handleConfirmInsurance`:

- Trocar `due_date` para o **último dia do mês corrente** (mês de competência igual a `insurance_invoice_period`), em vez do dia 20 do mês seguinte.
- O texto informativo no card de Valores passa a dizer "Esta consulta entra na fatura do mês <período>. Vencimento da fatura junto à operadora é definido pela operadora."
- Resultado: a transação passa a aparecer imediatamente em "A Receber" no Financeiro da Clínica e em "Pendente" no Meu Financeiro do médico, dentro do período padrão (mês corrente e últimos 3/6 meses).

Nenhuma outra rota é afetada (Stripe e A combinar já usam `due_date = hoje`).

### B. Tornar o Faturamento da Operadora real
Reescrever `src/pages/operadora/OperatorBilling.tsx` para consultar `financial_transactions`:

- Usar `operatorId` do `useAuth()`.
- Buscar transações com `operator_id = operatorId`.
- KPIs do mês corrente (`insurance_invoice_period = format(hoje, 'yyyy-MM')`):
  - **A faturar este mês** = soma de `amount` onde `insurance_invoice_status = 'open'` e período = mês corrente.
  - **Faturado no mês** = soma onde `insurance_invoice_status IN ('closed','paid')` no mesmo período.
  - **Glosas em análise** = contagem onde `insurance_invoice_status = 'disputed'` (ou similar — manter 0 se a coluna não tiver valores ainda).
- Abaixo dos KPIs, listar os atendimentos do mês: data, clínica (`clinics.name`), paciente (`patients.full_name`), procedimento (extraído de `notes`/`description`) e valor.
- Manter o empty state atual apenas quando não houver linhas.
- Estilo igual ao restante do painel da operadora (cards `rounded-xl`, header já existente).

### C. Permitir que membros da operadora leiam as transações dela
Criar migration adicionando policy SELECT em `public.financial_transactions`:

```sql
CREATE POLICY "Operator members can view their insurance transactions"
ON public.financial_transactions
FOR SELECT
TO authenticated
USING (
  operator_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.operator_members om
    WHERE om.operator_id = financial_transactions.operator_id
      AND om.user_id = auth.uid()
  )
);
```

Sem novos `GRANT` (a tabela já tem grants existentes). Sem alterações de schema.

## Fora de escopo
- Faturas mensais consolidadas (lote/PDF) e fluxo de glosa — placeholders permanecem; só os números agregados ficam reais.
- Tela `Financeiro · Faturas Convênio` da clínica (`InsuranceInvoices.tsx`) — não foi citada pelo usuário; manter como está.
- Stripe, "A combinar", `ConsultationPaymentDialog`, agenda e prontuário.

## Validação após implementar
1. Finalizar uma nova consulta de convênio (ou simplesmente recarregar). A transação `2026-06-15` deve aparecer:
   - em **Meu Financeiro** do médico em "Pendente";
   - em **Financeiro da Clínica** em "A Receber" e na lista de transações;
   - em **Painel Unimed → Faturamento** no KPI "A faturar este mês" com o atendimento listado.
2. Confirmar que registros antigos (`due_date` em 2026-07-20) também passam a aparecer após ajuste do filtro? Não — o ajuste é só para novos. Para o registro de teste atual, posso opcionalmente atualizar via SQL após a aprovação para refletir a nova regra.
