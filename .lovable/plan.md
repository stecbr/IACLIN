## Objetivo
Refinar gating, UX e atalho DEV do `SubscriptionOnboardingModal`.

## 1. Visibilidade do modal (`AppLayout.tsx`)

Reescrever a query/effect em `AppLayout.tsx` (linhas 48-75):

- **Roles permitidos** (whitelist explícita): `admin`, `owner`, `dentist`, `doctor` (qualquer profissional clínico). Bloquear estritamente `secretary`, `auxiliary`, `patient`, `operator`, `super_admin`/`platform_admin`.
- **Check de assinatura ativa cobrindo vínculo**:
  - Para o usuário (`entity_type='doctor'`, `entity_id=user.id`) — cobre autônomo.
  - Para a clínica atual (`entity_type='clinic'`, `entity_id=currentClinicId`) — cobre dono.
  - Para **todas** as clínicas em que o usuário é membro ativo (`clinic_members.status='active'`) — cobre médico/dentista vinculado. Buscar lista via `clinic_members` e incluir esses IDs no `.in('entity_id', ids)` com `status='active'`.
- Só abre o modal quando: usuário tem role permitido **E** nenhuma das entidades acima tem assinatura ativa.

## 2. Aviso de desvinculação

- Adicionar detecção: usuário com role profissional, `clinicsLoaded=true`, sem nenhum vínculo ativo (`clinic_members`/`isPersonalMode`), e que previamente teve vínculo. Heurística simples: se `roles` inclui `dentist`/`doctor` mas `clinics.length === 0` e não há assinatura própria → exibir banner.
- Criar `UnlinkedFromClinicBanner.tsx` (variante `destructive`/amber) com texto: "Você foi desvinculado da clínica anterior. Escolha como continuar usando o IACLIN." e botão "Escolher opção" que abre o modal.
- Forçar `setSubOnboardingOpen(true)` automaticamente nesse cenário (já coberto pela regra 1, mas garantir prioridade).
- Renderizar o banner em `AppLayout.tsx` junto aos demais (`SubscriptionWarningBanner`, `SoloTransitionBanner`).

## 3. Fluidez do carrossel (`SubscriptionOnboardingModal.tsx` – `PlansCarousel`)

Substituir a implementação atual baseada em `motion.div drag` (que trava por causa de `dragMomentum={false}` e snap rígido) por um carrossel CSS nativo:

```
<div className="overflow-x-auto scroll-smooth snap-x snap-mandatory touch-pan-x overscroll-x-contain -mx-1 px-1 pb-2 [&::-webkit-scrollbar]:hidden">
  <div className="flex gap-3">
    {plans.map(... className="snap-start shrink-0 w-[220px]")}
  </div>
</div>
```

- Manter dots clicáveis usando `scrollTo({left, behavior:'smooth'})` no container ref.
- Atualizar índice ativo via `onScroll` (debounced) calculando `Math.round(scrollLeft / CARD_STEP)`.
- Habilitar drag-com-mouse no desktop via handlers `onMouseDown/Move/Up` que ajustam `scrollLeft` (mantém touch nativo no mobile).
- Remover `useMotionValue`/`animate` e a lógica `dragMomentum`.

## 4. Botão DEV "Ativar Modo Desenvolvedor"

No card do plano de teste (`PlansStep`, linhas ~366-410):

- Renomear botão "Assinar" → **"Ativar Modo Desenvolvedor"** (ícone `Zap`).
- A função `handleActivateTest` já chama o RPC `upsert_platform_subscription` com `status='active'` e `payment_method='manual'` — **manter**, mas:
  - Garantir que **não** dispare `mercadopago-create-subscription` nem redirecione externamente (verificado: já não dispara).
  - Adicionar `p_current_period_end` = `now() + interval '1 year'` ao RPC para evitar que o `SubscriptionGuard` marque como vencido. Se o RPC atual não aceitar esse parâmetro, criar migração para adicionar parâmetro opcional (default 1 ano à frente quando `notes` contém "desenvolvimento").
  - Após sucesso: invalidar `['active-sub-check']` e `['subscription-status']`, fechar modal, `toast.success('Modo Desenvolvedor ativado — acesso liberado.')`.
- Adicionar microcopy abaixo do botão: "Libera acesso completo sem cobrança. Apenas para times de desenvolvimento."

## Arquivos afetados

- `src/components/AppLayout.tsx` — gating do modal + render do novo banner.
- `src/components/subscription/SubscriptionOnboardingModal.tsx` — carrossel CSS + botão DEV renomeado.
- `src/components/subscription/UnlinkedFromClinicBanner.tsx` — novo.
- Migração SQL (se necessário) ajustando `upsert_platform_subscription` para aceitar `p_current_period_end`.

## Fora de escopo
Cancelamento real de plano, integração com Mercado Pago, alterações em `platform_plans`.
