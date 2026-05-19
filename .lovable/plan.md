## Mudanças na Dashboard do Médico (`src/pages/dentist/DentistHome.tsx`)

### 1. Novo KPI: Sessões/Atendimentos concluídos hoje

Adicionar um card mostrando quantos atendimentos o médico tem no dia (status `completed` em `appointments` com `start_time` dentro de hoje e `dentist_id = user.id`).

- Label: "Sessões de Hoje"
- Valor: contagem de appointments de hoje com status `completed`
- Descrição: "de X agendados" (X = `todayApts.length`)

Reaproveita a query `todayApts` que já existe — basta derivar via `useMemo`.

### 2. KPIs financeiros condicionais (só quando é o dono da clínica)

Detectar se a clínica atualmente selecionada (`currentClinicId`) pertence ao usuário:

- Buscar `clinics.owner_id` para `currentClinicId` e comparar com `user.id`.
- Criar flag `isClinicOwner`.

Quando `isClinicOwner === true`, exibir 2 cards extras:

- **Faturado no mês** — soma de `financial_transactions` onde `clinic_id = currentClinicId`, `dentist_id = user.id`, `type = 'income'`, `status = 'paid'` (ou equivalente), no mês corrente.
- **A receber** — soma de `financial_transactions` mesmo filtro mas `status = 'pending'` (ou `'open'`).

Esses cards ficam ocultos quando o médico está numa clínica em que ele é apenas membro vinculado.

O grid de KPIs vira responsivo: 4 cards padrão quando não é dono, 6 cards quando é dono (`lg:grid-cols-4` mantém, vira `lg:grid-cols-6` quando dono — ou mantém 4 colunas e os 2 cards extras vão pra segunda linha).

### 3. Remover/ocultar "Aniversariantes da Semana"

- Remover o card de aniversários do JSX.
- Remover a query `birthdays` e o estado relacionado.
- O card de "Sua Agenda de Hoje" passa a ocupar a linha inteira (`lg:col-span-3` ou simplesmente sem grid de 3 colunas).

### Detalhes técnicos

- Query nova `clinic-owner-check`: `select owner_id from clinics where id = currentClinicId`.
- Query nova `dentist-financial-month` (enabled apenas quando `isClinicOwner`): agrupa por `status`, soma `amount`.
- Manter formatação em BRL (`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`) usando `AnimatedNumber` com `formatter`.

### Confirmações necessárias

Pra evitar retrabalho:

1. O KPI de "sessões do dia" deve contar **concluídas hoje** (status `completed`) ou **total agendado hoje** (que já existe como "Atendimentos Hoje")? Minha proposta acima é contar as concluídas, complementando o card existente.
2. "A receber" deve incluir só transações com vencimento até o fim do mês corrente, ou todas as pendentes vinculadas ao médico independente da data?