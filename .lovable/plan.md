## Finalização do Sistema de Planos & Pagamentos

Concluir as etapas pendentes do módulo de assinaturas (Stripe + PIX manual) já iniciado.

### 1. Página de Status de Pagamentos (Superadmin)
Criar `src/pages/superadmin/SuperAdminPayments.tsx`:
- Tabela unificada de `platform_payments` com filtros por status (pago / pendente / atrasado / falhou) e método (cartão / PIX / manual).
- Colunas: entidade (clínica/médico/operadora), plano, ciclo, valor final, método, status, vencimento, pago em.
- Badges coloridos por status; destaque para vencidos.
- Ação rápida "Registrar PIX" abrindo o `RecordPaymentDialog`.
- KPIs no topo: MRR estimado, inadimplência, próximos vencimentos (7 dias).

### 2. Rotas e Navegação
Em `src/App.tsx` registrar:
- `/superadmin/planos` → `SuperAdminPlans`
- `/superadmin/cupons` → `SuperAdminCoupons`
- `/superadmin/pagamentos` → `SuperAdminPayments`

Em `SuperAdminLayout.tsx` adicionar os 3 links no menu lateral (ícones: `Package`, `TicketPercent`, `CreditCard`).

### 3. Integração nas Configurações dos Clientes
Inserir `<SubscriptionSection />` em:
- `src/pages/SettingsPage.tsx` (clínica / médico) — nova aba "Assinatura".
- `src/pages/operadora/OperatorSettings.tsx` — card "Assinatura" abaixo dos dados.
- `src/pages/patient/PatientSettings.tsx` — **não** (paciente não tem plano).

A `SubscriptionSection` já cobre: visualizar plano atual, ciclo, método de pagamento, vencimento, histórico, alerta de vencido, e botões "Trocar plano" / "Trocar forma de pagamento".

### 4. Edge Functions Stripe (built-in)
Habilitar `enable_stripe_payments` e criar:
- `create-checkout-session` — recebe `plan_id` + `entity_type/id`, cria Checkout Stripe (modo subscription) e devolve URL.
- `create-customer-portal` — abre portal Stripe para o cliente trocar cartão / cancelar.
- `stripe-webhook` (verify_jwt=false) — escuta `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`; insere em `platform_payments` (trigger já estende `current_period_end`) e atualiza `status` da assinatura.

Configuração em `supabase/config.toml`: bloco para `stripe-webhook` com `verify_jwt = false`.

### 5. Botões "Registrar PIX" nas Tabelas Admin
Em `SuperAdminClinics`, `SuperAdminDoctors`, `SuperAdminOperators`: adicionar ação no menu da linha para abrir `RecordPaymentDialog` quando a entidade já tiver `subscription`.

### 6. Tipos & Hook
- Atualizar `usePlatformAdminData` para também retornar `payments` (lista global ou por entidade) usada no `SuperAdminPayments`.
- Garantir tipos em `src/types/superadmin.ts` (já existem `PlatformPayment`).

### Ordem de execução
1. Habilitar Stripe (`enable_stripe_payments`)
2. Criar edge functions + config webhook
3. Criar `SuperAdminPayments` + atualizar hook
4. Registrar rotas + menu lateral
5. Adicionar botões "Registrar PIX" nas tabelas
6. Integrar `SubscriptionSection` em Settings e OperatorSettings
7. Testar fluxo: criar plano → atribuir → checkout Stripe (modo teste) → webhook → status atualizado; registrar PIX manual → status atualizado.

### Fora deste plano
- Cobrança PIX automática (continua manual conforme decidido).
- Notificações por e-mail de cobrança (pode entrar em uma etapa futura).
