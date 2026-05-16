## Diagnóstico

Os três blocos do pedido já existem no código:

- **Financeiro** (`src/pages/Financial.tsx`): entradas/saídas, saldo, contas a pagar/receber, baixa manual, importação de extrato com IA, gráficos.
- **Funil de orçamentos** (`src/pages/Budgets.tsx` + `BudgetCard`/`BudgetFormDialog`): Kanban drag-and-drop com 4 colunas (Pendente, Em Negociação, Aprovado, Perdido), persistência em `treatment_plans.status`.
- **Persistência**: tabelas `financial_transactions`, `imported_transactions`, `treatment_plans` já existem com RLS por clínica/dentista.

**O que falta / está errado:**

1. **Isolamento pessoal × clínica quebrado no Financeiro.** A query principal filtra só por `currentClinicId`. Quando `currentClinicId` é `null` (modo pessoal), retorna **todas** as transações cujo `clinic_id IS NULL` — incluindo as de outros dentistas que dependem da RLS para filtrar. A RLS protege contra outros usuários, mas dentro do próprio histórico não há separação visual e o `NewTransactionDialog` grava com `clinic_id = currentClinicId ?? null` sem deixar claro em que "caixa" está caindo.
2. **Header não indica contexto ativo.** Usuário não vê se está olhando "Financeiro da Clínica X" ou "Financeiro Pessoal".
3. **Form de nova transação** permite gravar mesmo se o contexto mudou no meio do preenchimento — risco de transação cair na clínica errada.
4. **Funil**: status PRD (3) × atual (4) — o usuário já confirmou que mantém 4 colunas. Nada a mudar aqui, apenas validar persistência.
5. **RBAC**: memória do projeto diz `Dentist (no finance)`. Hoje a rota `/financial` parece acessível — verificar guarda.

---

## Plano de implementação

### 1. Contexto explícito no Financeiro (`src/pages/Financial.tsx`)

- Ler `currentClinicId`, `isPersonalMode`, `clinics` do `useAuth`.
- Adicionar subtítulo dinâmico no `PageHeader`:
  - clínica → "Financeiro · <nome da clínica>"
  - pessoal → "Financeiro Pessoal"
- Adicionar `Badge` ao lado do título indicando o escopo, com ícone (Building/User).
- Travar a query:
  - clínica: `.eq('clinic_id', currentClinicId)`
  - pessoal: `.is('clinic_id', null).eq('dentist_id', user.id)` ← corrige vazamento entre dentistas pessoais.
- Mesma regra para `imported-transactions` (hoje sem filtro de contexto): adicionar `.eq('user_id', user.id)`. Já está coberto por RLS, mas garante consistência visual.

### 2. Guarda no formulário de nova transação

- Capturar `currentClinicId` no momento do `open=true` e congelar em ref.
- Mostrar dentro do dialog um aviso pequeno: "Esta transação será registrada em: **<contexto>**".
- No `handleSubmit`, comparar contexto congelado com o atual; se mudou, abortar com toast pedindo para reabrir.
- Garantir que `dentist_id` sempre seja `user.id` e `clinic_id` seja exatamente o contexto congelado.

### 3. KPIs e gráfico por contexto

- Como a query já fica isolada, os KPIs (saldo, receitas, despesas, pendências) e o gráfico de 6 meses passam a refletir só o contexto ativo. Sem outras mudanças.

### 4. Troca de contexto no `ClinicSwitcher`

- Garantir que `queryClient.invalidateQueries({ queryKey: ['financial-transactions'] })` e `['imported-transactions']` rodem ao trocar de clínica/modo pessoal. Hoje a `queryKey` já inclui `currentClinicId`, então o React Query refaz a fetch sozinho — apenas validar.

### 5. Funil de vendas

- Manter 4 colunas como decidido.
- Validar que `BudgetFormDialog` também respeita o contexto (já lê `currentClinicId` e filtra pacientes por clínica — OK).
- Adicionar mesmo padrão de badge de contexto no header de `Budgets.tsx` ("Orçamentos · Clínica X" / "Orçamentos Pessoais").
- Verificar query do Kanban: hoje filtra só por `dentist_id` no modo dentista; adicionar filtro por `clinic_id` quando em clínica para evitar misturar orçamentos pessoais e da clínica.

### 6. RBAC

- Em `AppSidebar.tsx` / rotas, verificar que `/financial` esteja oculto/bloqueado para role `dentist` quando dentro de clínica (regra da memória). No modo pessoal, dentista vê o **próprio** financeiro pessoal (não conflita com a regra, que se refere ao financeiro da clínica).

### 7. Testes manuais

1. Logar como admin de clínica → header "Financeiro · <Clínica>", criar transação, conferir `clinic_id` na linha.
2. Trocar para modo pessoal no `ClinicSwitcher` → lista esvazia e mostra só transações pessoais; criar uma e confirmar `clinic_id IS NULL` + `dentist_id = self`.
3. Criar segundo profissional pessoal em outro browser → confirmar que não vê transações do primeiro.
4. Abrir dialog em uma clínica, trocar de clínica antes de salvar → toast de erro, sem gravação.
5. Kanban: arrastar entre as 4 colunas, recarregar, status persistido.
6. Em conta `dentist` dentro da clínica → menu Financeiro oculto.

---

## Fora deste escopo (ficam para depois)

- Processamento de pagamentos (já decidido: Stripe só para assinaturas do SaaS, paciente fora).
- Comissionamento de profissionais.
- Conciliação bancária além da importação atual com IA.
- Sub-views por dentista dentro do financeiro da clínica.

---

## Arquivos a alterar

- `src/pages/Financial.tsx` (queries + header + dialog guard)
- `src/pages/Budgets.tsx` (header de contexto + filtro de clinic_id)
- (verificação) `src/components/AppSidebar.tsx` para RBAC `dentist` na clínica

## Sem mexer

- Migrations, RLS, edge functions, schema do banco, fluxo de atendimento, importação de extrato.
