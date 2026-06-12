## Objetivo

Nova página `/operadora/beneficiarios` listando os clientes da operadora (titulares + dependentes), com carteirinha, plano, status da mensalidade, e drill-down com histórico de atendimentos e gastos detalhados — cruzando o cadastro próprio da operadora com os pacientes atendidos pela rede credenciada.

## 1. Banco de dados (migration)

Criar 2 tabelas novas (escopo da operadora):

**`operator_beneficiaries`** — titulares
- `operator_id`, `full_name`, `cpf`, `card_number` (carteirinha), `plan_name`, `plan_type` (individual/familiar/empresarial), `status` (em_dia | inadimplente | suspenso | cancelado), `due_day` (1–31), `last_payment_at`, `next_due_date`, `phone`, `email`, `date_of_birth`, `enrolled_at`, `notes`
- Index em `operator_id`, `cpf`, `card_number`
- RLS: somente membros da operadora (`user_belongs_to_operator`)
- GRANT para authenticated + service_role

**`operator_beneficiary_dependents`** — dependentes
- `beneficiary_id` (FK → titular, ON DELETE CASCADE), `full_name`, `cpf`, `card_number`, `relationship` (cônjuge/filho/pai/outro), `date_of_birth`
- RLS herdada por EXISTS no titular
- GRANT igual

Sem alteração nas tabelas existentes (`patients`, `appointments`, `operator_credentialings`).

## 2. Edge Function: `operator-beneficiary-spend`

Função read-only que recebe `{ beneficiary_id }` e retorna gastos consolidados (titular + dependentes):

- Resolve CPFs (titular + dependentes) a partir das duas tabelas.
- Busca `patients.id` cujos `cpf` batem **e** cuja `clinic_id` pertence à rede credenciada (`operator_credentialings` com `status='approved'` da operadora).
- Busca `appointments` desses pacientes em clínicas credenciadas, com `status='completed'`, junta com `procedures`, `profiles` (dentista) e `clinics`.
- Para cada atendimento, calcula valor cobrado consultando `operator_price_items` (match por `procedure_code` ou `procedure_name` dentro de `operator_price_tables` da operadora, pegando a vigente). Se não houver match, valor = null.
- Retorna:
  - `attendances[]`: data, paciente (titular/dependente), clínica, profissional, procedimento, valor
  - `summary`: total geral, por mês (últimos 12), top procedimentos, top clínica, contagem por status
  - `members[]`: titular + dependentes com subtotal cada

Usa service role; valida que o `operator_id` da beneficiária bate com a operadora do `auth.uid()` via `user_belongs_to_operator`.

## 3. Frontend

**`src/pages/operadora/OperatorBeneficiaries.tsx`** (nova página)
- Header com busca (nome, CPF, carteirinha) + filtros (plano, status, com/sem dependentes)
- Botão "Adicionar beneficiário" e "Importar planilha" (CSV/Excel — fica como placeholder simples no MVP: importa CSV via parser local, cria linhas em `operator_beneficiaries`)
- Tabela (shadcn) com colunas: Nome, CPF, Carteirinha, Plano, Tipo, Status (badge colorido), Vencimento, Dependentes (contador), Ações
- Linha clicável → abre Dialog de detalhes (fade-in/out per memória)

**Dialog `BeneficiaryDetailDialog.tsx`**
- Abas: **Resumo** | **Dependentes** | **Atendimentos** | **Financeiro**
- Resumo: dados cadastrais, status, vencimento, totais (gasto 12m, atendimentos 12m)
- Dependentes: tabela editável (add/remove/edit)
- Atendimentos: lista cronológica vinda da edge function, agrupada por mês, mostrando paciente (titular ou nome do dependente), clínica, profissional, procedimento, valor cobrado
- Financeiro: cards (total acumulado, ticket médio, top procedimento, top clínica) + gráfico de gastos mensais (Recharts BarChart, 12 meses)

**Dialog `BeneficiaryFormDialog.tsx`**
- Cadastro/edição de titular (campos da tabela). Status e vencimento editáveis manualmente. Suporte a cadastrar dependentes na mesma tela.

**Rotas** — adicionar `/operadora/beneficiarios` em `App.tsx` e item "Beneficiários" no `OperatorLayout.tsx`.

## 4. Detalhes técnicos

- Match titular ↔ paciente por CPF normalizado (regex `\D` → '').
- "Em dia" calculado por status manual; quando importado via CSV o status sobrescreve. Badge: verde (em_dia), amarelo (próximo do vencimento ≤7 dias), vermelho (inadimplente/suspenso).
- Valor por procedimento: lookup case-insensitive em `operator_price_items.procedure_name` da tabela vigente (operator_price_tables com `valid_from <= now() <= valid_until` ou a mais recente ativa).
- Sem alterações em `patients`/`appointments`; operadora apenas lê via edge function.
- Padrão visual: cards rounded-xl, badges shadcn, animações fade-only.

## Fora de escopo

- Cobrança/pagamento real de mensalidades (não somos processadora).
- Geração automática de fatura para beneficiário.
- Importação por planilha com IA (CSV simples manual; parser IA pode vir depois).
- Edição de dados do paciente (patients) pela operadora.
