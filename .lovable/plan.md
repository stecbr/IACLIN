
## Objetivo
Quando um orçamento é aprovado, ele entra em "Aguardando pagamento". Admin/Dono/Secretária registram o pagamento na recepção (cartão, convênio, dinheiro/pix), o valor vai para o histórico financeiro do paciente, e o orçamento move para "Realizado". O paciente é avisado in-app (e via WhatsApp, se configurado) com o valor e a instrução de ir à recepção.

## 1. Kanban de Orçamentos (`Budgets.tsx`)
Adicionar nova coluna entre **Aprovado** e **Realizado**:

```text
Pendente → Aprovado → Aguardando pagamento → Realizado → Não aprovado
```

- **Aprovado** = orçamento aceito pelo paciente, ainda sem cobrança iniciada.
- **Aguardando pagamento** (novo, âmbar) = recepção deve cobrar.
- **Realizado** (verde) = pago e concluído.

Ao mover para "Aguardando pagamento" (manual via drag ou botão "Enviar para cobrança"):
- Dispara notificação ao paciente.
- Mostra botão **"Registrar pagamento"** no card (visível apenas para admin/dono/secretária).

## 2. Diálogo de cobrança (`BudgetPaymentDialog.tsx` — novo)
Reutiliza o padrão visual do `FinishPaymentDialog` (consulta concluída) para manter consistência. Campos:
- Valor (pré-preenchido com total do orçamento, somente leitura — pagamento único).
- Forma de pagamento: **Cartão**, **Convênio**, **Dinheiro/Pix** (3 botões grandes).
- Observação (opcional).
- Botão **Confirmar pagamento**.

Ao confirmar:
1. Insere registro em `financial_transactions` (income, vinculado ao `patient_id`, `treatment_plan_id`, método escolhido, `paid_at = now()`).
2. Atualiza `treatment_plans.status = 'realized'` + `paid_at`, `payment_method`.
3. Cria notificação para o paciente: "Pagamento confirmado — obrigado!".
4. Aparece no histórico financeiro do paciente (já lê de `financial_transactions`).

## 3. Permissões (RBAC)
Gate no botão "Registrar pagamento" e na rota:
- `admin` (dono) ✓
- `secretary` ✓
- `dentist` ✗ (somente vê status)

Usa `useRoleAccess` já existente.

## 4. Notificação ao paciente
Quando orçamento entra em "Aguardando pagamento":
- **In-app**: insere em `notifications` (type `budget_payment_due`) com título "Orçamento aprovado — pagamento pendente" e mensagem "Seu orçamento '<título>' no valor de R$ X foi aprovado. Vá até a recepção da sua clínica para validar e realizar o pagamento."
- **Card destacado no dashboard do paciente** (`PatientHome` / `GettingStartedChecklist` area): banner âmbar com valor, nome da clínica e CTA "Ver detalhes" abrindo o orçamento.
- **WhatsApp** (se a clínica tiver Secretária IA / instância conectada): dispara mensagem equivalente via edge function existente. Se não houver instância, ignora silenciosamente.

## 5. Banco de dados (migração)
`treatment_plans`:
- Adicionar status `'awaiting_payment'` ao check constraint.
- Colunas novas: `payment_method TEXT`, `paid_at TIMESTAMPTZ`, `payment_recorded_by UUID`.

`notifications`: nenhum schema novo, apenas novo `type = 'budget_payment_due'` / `'budget_paid'`.

Trigger ou lógica no client cria a `financial_transactions` na confirmação (preferência: client, para reaproveitar lógica de categorias existente).

## 6. Visão do paciente (`PatientBudgets` ou equivalente)
- Lista orçamentos com badge de status traduzido.
- Orçamentos em "Aguardando pagamento" aparecem no topo com aviso destacado e instrução de pagamento presencial.
- Após "Realizado", aparece comprovante (data, forma, valor) na timeline financeira.

## 7. Arquivos afetados
- **Novo**: `src/components/budgets/BudgetPaymentDialog.tsx`
- **Editar**: `src/pages/Budgets.tsx` (coluna nova + ações)
- **Editar**: `src/components/budgets/BudgetCard.tsx` (botão cobrar, badge)
- **Editar**: `src/components/budgets/BudgetDetailDialog.tsx` (mostra status pagamento)
- **Editar**: `src/pages/paciente/PatientHome.tsx` (banner de cobrança)
- **Editar**: `src/pages/paciente/PatientBudgets.tsx` (se existir; senão criar seção)
- **Migração**: status + colunas em `treatment_plans`
- **Edge function** (opcional): reuso de notificação WhatsApp existente

## Fora de escopo
- Pagamento online dentro da plataforma (mantido conforme regra do produto: plataforma não processa pagamento).
- Pagamento parcelado (confirmado pelo usuário: sempre único).
