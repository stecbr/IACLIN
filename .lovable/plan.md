## 1. Agendamento de "retorno" após consulta concluída

**Problema:** quando o paciente já realizou uma consulta com o profissional e tenta marcar outra, o sistema mostra o aviso de conflito ("Você já tem consulta com este profissional… será cancelada"), mesmo quando a consulta anterior já foi finalizada (`status = 'completed'`).

**Mudança no backend** — `supabase/functions/request-appointment/index.ts`:

- Na busca `sameDoctorSameDayApptQ`, distinguir consultas **finalizadas** das **ativas**. Hoje filtra só `.neq('status', 'cancelled')`, o que inclui `completed`.
- Trazer também a coluna `status` no `select`.
- Quando o conflito encontrado tiver `status = 'completed'`, retornar um novo tipo de payload:
  ```json
  { "conflict": true, "type": "patient_completed_same_day",
    "message": "Você acabou de realizar uma consulta com Dr(a). X hoje às HH:mm. Tem certeza que deseja marcar um retorno para hoje?",
    "existing": { "kind": "appointment", ... } }
  ```
  Nesse caso o fluxo de "replace" NÃO deve cancelar a consulta anterior — só seguir e criar o pedido novo.
- Para `status` ativos (`scheduled`, `confirmed`, etc.) mantém-se o comportamento atual de cancelar+substituir.

**Mudança no frontend** — `src/pages/patient/PatientBooking.tsx`:

- O state `conflict` ganha um campo opcional `type`.
- Quando `type === 'patient_completed_same_day'`, o `AlertDialog` mostra:
  - Título: **"Marcar retorno para hoje?"**
  - Texto: "Você acabou de realizar uma consulta com Dr(a). {nome} hoje às {hora}. Deseja mesmo marcar um retorno agora?"
  - Botões: **Não, cancelar** / **Sim, marcar retorno**.
- Ao confirmar, chama `submitBooking()` SEM passar `replaceExistingId` (a função `request-appointment` aceita um novo flag `allowCompletedSameDay: true` para pular essa verificação específica e seguir com a criação normal).
- O texto atual ("será cancelada e substituída…") permanece apenas para consultas ativas.

## 2. Remoção do processamento de pagamento na plataforma

**Princípio do PRD:** o sistema só registra como o paciente pagou — não processa pagamento real. Cobranças via Mercado Pago/Stripe a partir da consulta devem sair do fluxo.

**Mudanças em `src/components/attendance/FinishPaymentDialog.tsx`:**

- Renomear a opção **"Particular agora"** → **"Cartão / Pago"** (ícone `CreditCard`).
- Remover toda a integração com `create-consultation-checkout-mp` e o estado `checkoutUrl`/UI do link de pagamento.
- `handleConfirmStripe` vira `handleConfirmPaid`:
  - Cria a transação financeira com `category: 'consultation'`, `payment_method: 'card'`, `status: 'paid'`, `paid_date: hoje`, vinculada a `patient_id` + `clinic_id` (já estão no payload).
  - `notes`: "Pago pelo paciente (registrado pela clínica)".
  - Toast: "Pagamento registrado." e fecha o diálogo.
- A opção **Convênio** continua igual (já vincula `operator_id`, `insurance_invoice_*` e mantém `status: 'pending'` até o repasse).
- A opção **A combinar** continua igual.
- O tipo `Mode` passa a ser `'' | 'insurance' | 'paid' | 'later'`.

**Mudanças em `src/components/attendance/ConsultationPaymentDialog.tsx`** (usado em Sala de Espera → "Registrar pagamento"):

- Reduzir as 4 opções (Dinheiro / Cartão / PIX / Convênio) para **3**:
  - **Convênio** (igual ao atual, salva `payment_method: insurance:<plano>` e `status: 'pending'`).
  - **Cartão / Pago** (substitui Dinheiro+Cartão+PIX, salva `payment_method: 'card'`, `status: 'paid'`, `paid_date` = hoje).
  - **A combinar** (novo — `payment_method: 'particular_pending'`, `status: 'pending'`, sem `paid_date`).
- Remover o bloco da chave PIX e a prop `paymentAccount` (não é mais necessário exibir chave para o paciente pagar dentro da plataforma).
- A transação continua vinculada a `patient_id` + `clinic_id` (já está). O `appointment_id` mantém o vínculo com o profissional.

**Edge function/checkouts não removidas:** `create-consultation-checkout-mp` e `create-consultation-checkout` continuam no repositório (não há remoção destrutiva), apenas deixam de ser chamadas pelo fluxo de consulta. O Mercado Pago segue ativo só para a parte de assinatura SaaS, como pede o PRD.

## Notas técnicas

- Nenhuma migração de banco é necessária; apenas mudanças em código (Edge Function + componentes React).
- A coluna `status` já existe em `appointments`, então o novo filtro é apenas no SELECT.
- Não há alteração em RLS nem nas grants.
