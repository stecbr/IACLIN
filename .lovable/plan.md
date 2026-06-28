## Blocos B & C — Avisos Globais + Paywall por Inadimplência

### 1. Hook `src/hooks/useSubscriptionStatus.ts` (novo)

Consulta `platform_subscriptions` para a clínica atual (`entity_type='clinic'`, `entity_id=currentClinicId`), ordenando por `created_at` desc e pegando o registro mais recente.

Retorno:
```ts
{
  status: 'active' | 'trialing' | 'overdue' | 'cancelled' | 'none',
  isActive: boolean,            // active | trialing
  isTrial: boolean,             // status === 'trialing'
  isOverdueOrCancelled: boolean,
  daysUntilDue: number | null,  // diff em dias entre current_period_end e hoje
  currentPeriodEnd: Date | null,
  hasSubscription: boolean,
  isLoading: boolean,
  refetch: () => void,
}
```

Implementado via `useQuery` (chave: `['subscription-status', clinicId]`), com `staleTime` de 5 min. Se não há `currentClinicId` ou usuário está em modo pessoal, retorna `status: 'none'` e libera.

### 2. Bloco B — Banner de aviso de vencimento

**Novo componente `src/components/SubscriptionWarningBanner.tsx`**
- Usa `useSubscriptionStatus` + `useAuth` (precisa de `isClinicOwner` ou `clinicRole === 'admin'`).
- Renderiza apenas se: `isActive === true` E `daysUntilDue !== null` E `daysUntilDue <= 7` E usuário é dono/admin.
- Visual: faixa amber (tokens semânticos, fade-in via Framer Motion conforme regra de modais/animação), ícone `AlertTriangle`, texto curto:
  - Trial: "Seu período de testes termina em X dias. Ative seu plano para evitar o bloqueio."
  - Pago: "Sua assinatura vence em X dias. Regularize para evitar o bloqueio."
  - Vence hoje: "Sua assinatura vence hoje."
- Link "Ir para assinatura" → `navigate('/settings?tab=subscription')`.
- Dismissível por sessão (sessionStorage `iaclin.subWarn.dismissed`) — reaparece no próximo login.

**Integração em `src/components/AppLayout.tsx`**
- Renderizado dentro do `<main>`, logo acima do `<PublishPendingBanner />`, dentro do `motion.div` (para herdar a animação de rota).
- Não renderiza se `blockedByPermission` ou `isMembershipSuspended` já estão ativos.

### 3. Bloco C — Paywall por inadimplência

**Novo componente `src/components/SubscriptionGuard.tsx`**
- Lê `useSubscriptionStatus`, `useAuth` (`clinicRole`, `isClinicOwner`, `signOut`, `profile`), `useLocation`.
- Se `isLoading` → renderiza `children` (evita flash; banner aparece depois).
- Se `!isOverdueOrCancelled` → renderiza `children` normalmente.
- Se `isOverdueOrCancelled === true`:
  - **Dono/Admin** (`isClinicOwner || clinicRole === 'admin'`):
    - Permite acesso EXCLUSIVO a `/settings` (qualquer aba) e `/perfil`. Se a rota atual for uma dessas, renderiza `children` (com banner vermelho fixo no topo via `SubscriptionPaywallBanner` interno, lembrando que está em modo restrito).
    - Caso contrário, renderiza tela cheia `<AdminPaywallScreen />`:
      - Card central, ícone `Lock` vermelho, título "Assinatura suspensa".
      - Texto: "Identificamos uma pendência no pagamento da sua assinatura. Regularize agora para reativar o acesso ao IACLIN."
      - Botão primário "Ir para pagamento" → `navigate('/settings?tab=subscription')`.
      - Botão secundário "Sair" → `signOut()`.
  - **Funcionários** (`dentist` vinculado, `secretary`, `auxiliary` que NÃO são donos):
    - Renderiza tela cheia `<StaffSuspendedScreen />`:
      - Ícone `AlertOctagon` âmbar, título "Sistema temporariamente indisponível".
      - Texto: "O acesso ao sistema está suspenso. Entre em contato com o administrador ou responsável pela clínica para regularizar o acesso."
      - Botão "Sair" → `signOut()`.
      - Sem qualquer rota interna disponível.

**Integração em `src/components/AppLayout.tsx`**
- Envolve o `children` (depois do `PublishPendingBanner` e do `SubscriptionWarningBanner`) com `<SubscriptionGuard>`.
- Mantém os checks já existentes (`isMembershipSuspended` continua tendo precedência absoluta).
- Pacientes (`isPatient`) e Operadoras não passam pelo guard (não estão no `AppLayout` da clínica, ou retornam `status: 'none'`).

### 4. Regras importantes

- **Não tocar** em webhooks (`stripe-webhook`, `mercadopago-webhook`) — apenas leitura.
- Status `'none'` (sem assinatura encontrada) NÃO bloqueia — comportamento atual preservado para contas legadas/seed; só `overdue` e `cancelled` ativam o paywall.
- Modo Pessoal (`isPersonalMode`) ignora completamente — sem clínica, sem assinatura.
- Super Admin nunca é bloqueado (rotas `/superadmin/*` ficam fora do `AppLayout`/`SubscriptionGuard`).
- Animações respeitam a regra de UI: fade-in/out apenas, sem slide/zoom.
- Todas as cores via tokens semânticos do `index.css` — sem `bg-red-500` cru.

### Resumo de arquivos

| Arquivo | Tipo |
|---|---|
| `src/hooks/useSubscriptionStatus.ts` | novo |
| `src/components/SubscriptionWarningBanner.tsx` | novo (Bloco B) |
| `src/components/SubscriptionGuard.tsx` | novo (Bloco C, inclui Admin/Staff screens) |
| `src/components/AppLayout.tsx` | integra banner + guard |

Após sua aprovação, executo na ordem: hook → banner → guard → integração no `AppLayout`.
