
# Bloco 1 — Roles, Visibilidade e Dashboards Financeiros

Foco: **adaptar telas existentes** com base em hooks já no projeto (`useSoloMode`, `useRoleAccess`, `useStaffPermissions`, `canManageClinicFinance`). Sem novas tabelas. Sem mexer em `src/lib/commissions.ts`. Sem fechamento de período (Bloco 2).

---

## 1. Adicionar helper único de visibilidade financeira

Novo arquivo `src/hooks/useFinanceVisibility.ts` que centraliza as decisões e evita repetir lógica em cada tela:

```text
returns {
  mode: 'solo' | 'clinic' | 'professional' | 'staff' | 'denied',
  canSeeClinicCash: boolean,        // caixa total da clínica
  canSeeOperationalExpenses: boolean,
  canSeePayouts: boolean,           // repasses / comissões de terceiros
  canManagePayments: boolean,       // canManageClinicFinance
  canSeeOwnCommissions: boolean,    // dentista vinculado
}
```

Regras:
- `solo` → `useSoloMode().isSolo === true`.
- `clinic` → admin/owner com `memberCount > 1`.
- `professional` → `clinicRole === 'dentist'` e **não** é dono da clínica.
- `staff` → secretária/auxiliar com `permissions.financeiro !== false`.
- `denied` → staff com `permissions.financeiro === false` (já bloqueado pela rota; aqui fica como salvaguarda).

Esse hook é a única fonte de verdade usada pelas telas abaixo.

---

## 2. `/financial` (`src/pages/Financial.tsx`) — adaptação por modo

**Modo Solo**
- Esconder qualquer aba/seção de "Comissões", "Repasses", "Profissionais" (atualmente vem do `CommissionsPanel` e do ranking por profissional do `ClinicHealthPanel`).
- Renderizar **SoloFinanceOverview** (novo, ver §5) no lugar do bloco de overview atual.
- Lançamentos continuam (receitas/despesas pessoais).

**Modo Clínica (admin/owner não-solo, ou staff com perm financeiro)**
- Mantém estrutura atual + reforça com **ClinicFinanceOverview** (§6) acima das abas.
- Aba "Profissionais/Comissões" só aparece quando `canSeePayouts === true`.

**Modo Profissional vinculado**
- Bloquear a renderização do `Financial.tsx` para `role === 'dentist'` não-dono: redirecionar para `/meu-financeiro` (§4).
- Já existe gate em `useRoleAccess` (`/financial` não inclui `dentist`), então a rota atual já redireciona. Adicionar fallback explícito dentro do componente para o caso de owner que está em "consult mode" sem perms.

**Staff sem permissão financeira**
- Já bloqueado pela rota. Nada adicional.

---

## 3. `ClinicaHome.tsx` — KPIs e ranking

Adicionar bloco "Saúde Financeira da Clínica" visível **apenas quando `canSeeClinicCash === true`**:

- Card: Faturamento Bruto (mês atual, `income+paid`).
- Card: Total de Repasses Gerados (despesas `category='commission'`, todas as situações — divide visualmente "Pendentes" vs "Pagas").
- Card: Despesas Operacionais (todas as `expense` exceto `category='commission'`).
- Card: Margem Líquida da Clínica = Faturamento − Despesas (operacionais + comissões).
- **Ranking visual** de faturamento por profissional do mês: reaproveita a query já existente em `ClinicHealthPanel` (não duplicar — extrair para hook `useClinicRevenueByProfessional`).

Modo Solo nessa home: **não renderiza** o bloco (a info do solo vive em `/financial`).

---

## 4. Nova rota `/meu-financeiro` (Profissional vinculado)

Novo arquivo `src/pages/dentist/MyFinance.tsx` + rota em `App.tsx`.

Visão **somente leitura**, escopo: `financial_transactions.dentist_id = auth.uid()`.

KPIs do mês:
- **A receber** = soma de `expense + category='commission' + status='pending' + dentist_id=me`.
- **Já recebido** = mesmo filtro com `status='paid'`.
- **Atendimentos faturados no mês** = contagem distinta de `appointment_id` dessas comissões.
- **Ticket médio das suas consultas** = média de `income.amount` onde `dentist_id=me` (informativo, mesmo que o caixa pertença à clínica).

Tabela "Extrato de comissões" (últimos 50): data, paciente (via join), procedimento (via appointment), valor base, valor da comissão, status.

Empty state quando não houver regra cadastrada para ele: card neutro com texto *"Nenhuma regra de comissão definida para você. Fale com a administração da clínica."* (não cria nada automaticamente).

Sidebar / mobile bottom nav: adicionar item "Meu Financeiro" para `effectiveRole === 'dentist'` quando ele NÃO for dono.

`useRoleAccess`: adicionar `{ path: '/meu-financeiro', allowedRoles: ['dentist'] }`.

---

## 5. Componente `SoloFinanceOverview` (novo)

`src/components/finance/SoloFinanceOverview.tsx`. Recebe `transactions` e `period` (mesmas props que `ClinicHealthPanel` para reaproveitar a query do `Financial.tsx`).

Renderiza:
- 4 cards: Faturamento Bruto · Despesas Totais · Lucro Líquido · Ticket Médio.
- Gráfico de barras de **evolução mensal** dos últimos 6 meses (receita × despesa), reusando `recharts` que já está no `Financial.tsx`.

Fórmulas:
- Faturamento Bruto = Σ `income` com `status='paid'` no período.
- Despesas Totais = Σ `expense` com `status='paid'` no período (no modo solo não há comissões geradas, então não há risco de dupla contagem).
- Lucro Líquido = Faturamento − Despesas.
- Ticket Médio = Faturamento Bruto ÷ nº de `appointments` concluídas no período (consulta separada, já existente em `ClinicaHome`).

---

## 6. Componente `ClinicFinanceOverview` (novo)

`src/components/finance/ClinicFinanceOverview.tsx`. Mesmo padrão visual do `ClinicHealthPanel`, mas voltado a KPIs agregados:

- Faturamento Bruto Total.
- Repasses Gerados (pendentes + pagos, com mini-breakdown).
- Despesas Operacionais (exclui `category='commission'`).
- Margem Líquida = Faturamento − Despesas Operacionais − Repasses (todos).
- Componente é usado em `Financial.tsx` (topo do overview) e linkado a partir de `ClinicaHome` ("Ver detalhes" → /financial).

Renderiza somente se `canSeeClinicCash === true`.

---

## 7. Auditoria de visibilidade nas telas existentes

Aplicar o novo hook em:
- `Financial.tsx` — esconder `<CommissionsPanel />` quando `!canSeePayouts` e esconder ranking por profissional no `ClinicHealthPanel` em modo solo (passar prop `hideByProfessional`).
- `ClinicaHome.tsx` — gate dos novos cards.
- `DentistHome.tsx` — substituir/ocultar qualquer KPI que mostre caixa da clínica para dentista vinculado (revisar arquivo durante implementação).
- `WaitingRoom.tsx`, `Index.tsx`, `dentist/DentistHome.tsx` — só conferir se algum card de caixa precisa de gate; nada a alterar se já estiverem certos.

---

## 8. Não escopo deste bloco

- `commission_payouts` / fechamento de período → **Bloco 2**.
- Lotes de convênio e glosas → **Bloco 3**.
- DRE detalhada e separação de taxas → **Bloco 4**.
- Mudanças em `commissions.ts`, `commission_rules`, `financial_transactions` (schema).
- Edição/exclusão de regras pela tela do profissional.

---

## 9. Arquivos afetados

Novos:
- `src/hooks/useFinanceVisibility.ts`
- `src/hooks/useClinicRevenueByProfessional.ts` (extração da query de `ClinicHealthPanel`)
- `src/components/finance/SoloFinanceOverview.tsx`
- `src/components/finance/ClinicFinanceOverview.tsx`
- `src/pages/dentist/MyFinance.tsx`

Editados:
- `src/pages/Financial.tsx` (gates + injeção dos overviews)
- `src/pages/clinica/ClinicaHome.tsx` (bloco "Saúde Financeira")
- `src/components/finance/ClinicHealthPanel.tsx` (prop opcional para esconder ranking por profissional + consumir o hook extraído)
- `src/hooks/useRoleAccess.ts` (rota `/meu-financeiro`)
- `src/App.tsx` (rota `/meu-financeiro` + lazy import)
- `src/components/AppSidebar.tsx` e `src/components/MobileBottomNav.tsx` (item "Meu Financeiro" para dentista vinculado)

---

## 10. Critérios de aceite

1. Dono solo logado: `/financial` mostra 4 cards Solo + gráfico mensal; nenhuma menção a "Repasses/Comissões/Profissionais".
2. Dono de clínica com 2+ membros: `/financial` mostra overview da clínica (4 cards) + aba de comissões + ranking por profissional.
3. Dentista vinculado: ao tentar `/financial` cai em `/meu-financeiro`; vê apenas seus números; sem caixa da clínica.
4. Secretária com `permissions.financeiro=false`: `/financial` continua bloqueado (sem regressão).
5. `src/lib/commissions.ts`, `commission_rules` e `financial_transactions` permanecem intactos.

Pode aprovar para eu iniciar a implementação do Bloco 1?
