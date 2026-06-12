## Objetivo
Ao clicar em "Finalizar Atendimento", abrir obrigatoriamente um modal de **Forma de Pagamento** com três caminhos: Convênio, Particular agora (Stripe), Particular depois. Bloquear a navegação até o usuário escolher.

## Mudanças no fluxo (Attendance.tsx)
- `handleFinish` deixa de criar a transação financeira direto. Em vez disso:
  1. Marca atendimento como `completed` + atualiza clinical_record.
  2. Abre `FinishPaymentDialog` (substitui o atual `ConsultationPaymentDialog`) — **não fechável por clique fora / ESC**, só confirmando uma das 3 opções (ou "Registrar depois").
  3. A transação financeira é criada somente após a escolha, com os campos certos por cenário.

## Modal: 3 opções

### 1) Convênio
- Mostra select de **operadoras em que o médico está credenciado** (`operator_credentialings` com status `approved` para `professional_user_id = user.id`).
- Lista os procedimentos da consulta. Para cada um, busca o valor em `operator_price_items` da operadora escolhida (tabela vigente). Se item não tiver código mapeado ou não existir na tabela, exibe alerta "procedimento sem valor na tabela da operadora" e impede confirmar até resolver (corrigir código ou trocar operadora).
- Ao confirmar cria `financial_transactions`:
  - `type='income'`, `category='insurance'`
  - `payment_method = 'insurance:<operator_name>'`
  - `status='pending'`, `due_date = dia 20 do mês seguinte` (data corte da fatura)
  - `notes` com operadora, plano (se houver) e códigos dos procedimentos
  - novos campos: `operator_id`, `insurance_invoice_period` (YYYY-MM)
- Histórico médico-operadora: garantido pela própria transação + `clinical_record_procedures` já existente.

### 2) Particular agora (Stripe Checkout Session)
- Chama nova edge function `create-consultation-checkout` que:
  - Recebe `transaction_id` (criado antes como `status='pending'`, `payment_method='stripe'`).
  - Usa `STRIPE_SECRET_KEY` para criar `checkout.sessions.create` (mode=`payment`) com `line_items` derivados dos procedimentos.
  - Retorna `url`.
- Modal mostra QR Code + link copiável. Paciente paga no celular.
- Webhook (`stripe-webhook` já existente, estender) marca transação como `paid` ao receber `checkout.session.completed`.

### 3) Particular depois ("A combinar")
- Cria `financial_transactions` com `status='pending'`, `payment_method='particular_pending'`, `notes='A combinar com paciente'`, `due_date` = hoje.
- Aparece no AR / contas a receber para a secretária cobrar depois.

## Nova tela: Faturas a enviar (Convênios)
Rota: `/financeiro/faturas-convenio`
- Lista agrupada por `operator_id` + `insurance_invoice_period`.
- Cada grupo mostra: operadora, mês, total, qtd de consultas, status (`aberta` / `enviada` / `paga`).
- Ações: ver detalhes (lista de pacientes/data/procedimento/valor), marcar como enviada, marcar como paga (lote — atualiza todas transações do grupo).
- Banner no dashboard quando dia ≥ 18 do mês: "Você tem X faturas prontas para envio dia 20".

## Banco (migração)
- `financial_transactions`:
  - `operator_id uuid null references insurance_operators(id)`
  - `insurance_invoice_period text null` (formato `YYYY-MM`)
  - `insurance_invoice_status text null` (`open|sent|paid`)
- Índice composto `(operator_id, insurance_invoice_period)`.
- Mantém RLS atual (já filtra por clinic_member).

## Arquivos a criar / editar
- `src/components/attendance/FinishPaymentDialog.tsx` (novo — substitui `ConsultationPaymentDialog`)
- `src/pages/Attendance.tsx` (refatorar `handleFinish`)
- `src/pages/financial/InsuranceInvoices.tsx` (nova tela)
- Rota em `src/App.tsx`
- `supabase/functions/create-consultation-checkout/index.ts` (nova)
- `supabase/functions/stripe-webhook/index.ts` (estender para tratar checkout consulta)
- Migration única adicionando colunas + índice em `financial_transactions`

## Validação / Testes manuais
1. Finalizar atendimento sem procedimentos → modal só permite "Registrar depois".
2. Convênio Unimed: criar credenciamento + tabela com 1 procedimento → finalizar → transação cai em "Faturas a enviar" no mês corrente.
3. Convênio sem código mapeado → alerta vermelho, botão confirmar desabilitado.
4. Stripe agora → checkout abre, paga em modo teste → webhook marca `paid`.
5. Particular depois → vai para contas a receber pendente.

## Fora deste escopo
- Geração de PDF/CSV da fatura conv (pode entrar depois).
- Stripe Terminal (maquininha física).
- Comissão automática por procedimento.
