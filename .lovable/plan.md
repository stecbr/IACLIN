ns: A revisão completa será entregue em 3 fases priorizadas. Cada fase é um conjunto coeso que pode ser validado de forma independente antes da próxima.

---

## Fase 1 — Fluidez (SPA), nomenclaturas e dark mode crítico

### 1.1 Comportamento SPA (eliminar refresh / piscadas)
- Auditar e substituir por navegação client-side:
  - Trocar todos os `<a href="/...">` internos por `<Link>` do `react-router-dom` (ex.: `MarketplaceHeader`, headers, CTAs do dashboard).
  - Substituir `window.location.href = ...` e `location.assign(...)` por `navigate(...)`.
  - Remover `window.location.reload()` em fluxos como troca de clínica, login, personalização, filtros, salvar configurações — usar invalidação de query/estado.
- Troca de workspace (ClinicSwitcher): atualizar contexto + invalidar caches React Query, sem reload.
- Login e logout: redirecionar via `navigate` mantendo o app montado; remover full reload no `AuthContext`.
- Personalização (tema, cores, logo): aplicar via CSS vars em tempo real; nunca recarregar.
- Filtros (agenda, pacientes, financeiro, kanban): manter estado local + URL search params, sem remount.
- Cards clicáveis e menus de 3 pontos: garantir que ações usem mutations + optimistic update no React Query.

### 1.2 Persistência de componentes globais
- Garantir que o gravador/transcrição (`RecordingContext` + `GlobalRecordingBar`) sobrevive a navegação — confirmar montagem única no root e que mudanças de rota não desmontam o provider.
- Verificar `ActiveConsultationBar`, `NotificationBell` e `CommandPalette` — devem manter estado entre rotas.
- Trocar `<AnimatePresence mode="wait">` por animação que não force unmount pesado em páginas que carregam dados grandes (agenda, prontuário).

### 1.3 Estados de loading
- Substituir loadings que zeram a tela por skeletons in-place.
- Padronizar uso de `staleTime` e `placeholderData: keepPreviousData` no React Query para evitar “piscar” ao refazer queries.

### 1.4 Renomeações
- “Marketplace” → **“Rede Médica”** em toda UI, breadcrumbs, sidebar, headers e textos auxiliares.
  - Rotas permanecem (`/marketplace`) para não quebrar links; apenas labels mudam. Avaliar alias `/rede-medica` opcional.
- Remover totalmente “VIP” do prontuário e etiquetas (componente de tags, presets, badges, filtros, seeds).
- Etiquetas: deixar somente customizáveis — sem exemplos pré-cadastrados.

### 1.5 Dark mode — auditoria crítica
- Corrigir logo sumindo na tela de login (`/auth`) — usar `useTheme().resolved` para alternar `logo-light`/`logo-dark`, igual ao `AppLayout`.
- Varredura por:
  - `text-white`, `text-black`, `bg-white`, `bg-gray-*` hardcoded → trocar por tokens semânticos.
  - Placeholders, hover, borders e ícones invisíveis no dark.
  - Componentes com `bg-transparent` sobre fundo escuro perdendo legibilidade.
- Garantir contraste mínimo AA em textos auxiliares (`text-muted-foreground` no dark está fraco — ajustar token).

---

## Fase 2 — Tipografia (escala Linear/Notion) e sobriedade visual

### 2.1 Escala tipográfica nova (base 15px)
- Atualizar `index.css` e `tailwind.config.ts`:
  - `html { font-size: 15px }` ou redefinir `fontSize` no Tailwind.
  - Hierarquia: H1 28/32, H2 22/28, H3 18/24, body 15/22, label 13/18, caption 12/16.
  - `letter-spacing` levemente negativo em títulos (-0.01em), peso 600 em headings, 500 em labels.
  - `line-height` generoso (1.5 body, 1.3 títulos).
- Componentes a ajustar globalmente:
  - `CardTitle`, `CardDescription`, `PageHeader`, labels de formulário, tabelas, dropdowns, sidebar, menus, tooltips, badges.
  - Valores financeiros e de orçamento com peso tabular (`tabular-nums`) e tamanho mais firme.

### 2.2 Sobriedade premium médica
- Remover emojis decorativos da UI (manter apenas em conteúdo gerado por usuário/IA).
- Padronizar:
  - `shadow-card` / `shadow-card-hover` consistentes; remover sombras pesadas.
  - Radius unificado (`--radius` já existe — aplicar em todos os custom components).
  - Hover: transição 150ms, mudança sutil de `bg-muted/50` + leve elevação.
  - Espaçamento: padronizar grid de 4/8/12/16/24.
- Revisar ícones “fofos” / coloridos demais; preferir traço único (Lucide já é base).
- Eliminar gradientes excessivos em cards de KPI; manter tom monocromático com accent discreto.

---

## Fase 3 — Responsividade, bugs e polimento

### 3.1 Bugs de responsividade
- Menu “Personalizar” (PatientPersonalizeMenu, ThemeCustomizer): garantir scroll interno + larguras min/max em telas < 768px.
- Dropdowns que vazam viewport (usar `collisionPadding` do Radix).
- Cards de agenda e prontuário com overflow horizontal em mobile.
- Botões de 3 pontos com área de toque mínima 40x40.
- Filtros colapsáveis no mobile (drawer em vez de barra).

### 3.2 Fluxos críticos
- Agenda: confirmar que troca de visualização (dia/semana/mês), filtro de médico e abertura de detalhe não fazem refetch desnecessário.
- Prontuário: abas (anamnese, documentos, timeline, financeiro) usam estado local sem remount pesado.
- Login: foco automático, Enter submete, redirect via `navigate`.

### 3.3 QA final
- Percorrer rotas principais em light e dark, desktop e mobile.
- Conferir Lighthouse/Performance básica (sem builds — só análise visual e de comportamento).

---

## Detalhes técnicos

- Stack: React 18 + Vite + Tailwind + shadcn + React Query + Framer Motion.
- Convenções a respeitar (memória do projeto):
  - Tokens semânticos HSL em `index.css` — proibido cor literal em componentes.
  - Modais com fade-in/out apenas.
  - Datas locais nunca normalizadas para UTC.
  - Mobile: bottom nav iOS, skeletons.
- Não tocar em: `src/integrations/supabase/{client,types}.ts`, `supabase/config.toml` (project-level), migrações existentes.
- Renomeações de UI **não** alteram schema/rotas backend.
- Memória `mem://features/marketplace` será atualizada para refletir o novo nome “Rede Médica”.

## Fora de escopo desta rodada
- Mudanças em RLS, edge functions ou modelo de dados.
- Refatoração de arquitetura de pastas.
- Novas features (somente lapidação).

## Entrega sugerida
Começo pela **Fase 1** (maior impacto percebido antes da validação com médicos). Ao final de cada fase, aviso para você revisar antes de seguir.