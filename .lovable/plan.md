## Objetivo

Reforçar a aba **Meu Financeiro** do médico/dentista vinculado a clínicas com: (1) banner de aviso sobre o depósito mensal na conta cadastrada em Recebimentos, e (2) uma sub-aba **Histórico de consultas** listando os atendimentos prestados àquela clínica, com filtro por status.

Sem mudanças de backend — todos os dados já existem em `financial_transactions` e `appointments`.

---

## Mudanças

### 1. `src/components/settings/DentistFinancialSection.tsx`

Reorganizar o conteúdo em duas sub-abas (shadcn `Tabs`):

- **Resumo financeiro** (conteúdo atual: cards de Recebido/Pendente/Total + lista agrupada por clínica).
- **Histórico de consultas** (novo).

**Banner de depósito (acima das sub-abas):**
- Carrega `payment_accounts` do usuário logado (mesma query do `PaymentAccountSection`).
- Se houver conta cadastrada → card informativo com ícone `Landmark`:  
  *"Os repasses das clínicas serão depositados no final de cada mês na conta cadastrada em Recebimentos: **{bank_name} • Ag {agency} • Conta {account}-{digit}** (PIX: {pix_key})."*
- Se NÃO houver conta → card de alerta âmbar com botão "Cadastrar conta" que muda `activeSection` para `payments` (via prop callback ou `useSearchParams`).

**Sub-aba "Histórico de consultas":**
- Query nova com `useQuery`: `appointments` filtrado por `dentist_id = user.id`, `start_time` no período selecionado, join com `patients(full_name)` e `clinics(name)`.
- Filtro por status (Select): Todos | Concluídas (`completed`) | Confirmadas (`confirmed`) | Canceladas (`cancelled`) | Faltas (`no_show`) | Agendadas (`scheduled`).
- Filtro por clínica (Select), reutilizando o `clinicMap` já calculado.
- Tabela/lista com: Data/hora, Paciente, Clínica, Procedimento (de `appointments.notes` ou `service_type`), Status (Badge), Valor a receber (busca em `financial_transactions` por `appointment_id` quando `type='income'` e `dentist_id` = usuário; mostra "—" se não houver).
- Mantém estética iOS minimalista, dark-mode friendly, com `Skeleton` loaders e empty state coerentes com o restante do arquivo.
- Reutiliza o filtro de período (`period` state) já existente no topo — passa a valer para as duas sub-abas.

### 2. Sem alterações em outros arquivos

- `PaymentAccountSection.tsx`, rotas e migrations permanecem inalterados.
- O usuário escolheu o aviso somente em Meu Financeiro.

---

## Detalhes técnicos

- Tabela `appointments` já tem RLS que permite o dentista ler seus próprios atendimentos; `payment_accounts` é lido por `user_id = auth.uid()`.
- Para o valor a receber por consulta, fazemos uma segunda query `financial_transactions` por `appointment_id IN (...)` e construímos um `Map<appointment_id, amount>`. Evita N+1.
- Estados do `Select` de status mapeados em um objeto com `label` PT-BR e `variant` para o `Badge`, seguindo o padrão de `STATUS_MAP` já presente no arquivo.
- Sub-abas implementadas com `Tabs`/`TabsList`/`TabsContent` já usados em outras telas (mesma estética).
- Sem novas dependências.

---

## Fora de escopo

- Geração automática de repasse mensal/folha de pagamento (apenas o aviso textual).
- Edição da conta bancária a partir desta tela (continua em Recebimentos).
- Exportação PDF/CSV do histórico (pode vir em iteração futura).