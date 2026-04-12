

# IACLIN — Polish para "cara de software profissional"

Analisei todos os arquivos do projeto. O app ja tem uma boa base (sidebar com grupos, dashboard com KPIs reais, charts Recharts, command palette), mas varios detalhes ainda dão "cara de template" em vez de produto. Aqui esta o que precisa mudar:

---

## Problemas Atuais

1. **Mobile sem navegacao propria** — no mobile a sidebar esconde e nao ha bottom navigation (padrao de apps como Linear mobile, Cal.com)
2. **Settings e vazio** — placeholder "em breve" quebra a sensacao de produto completo
3. **Sem loading skeletons** — tudo mostra spinner generico; apps profissionais usam skeleton placeholders
4. **Sem dark mode toggle** — o CSS ja tem tokens dark, mas nao ha como o usuario alternar
5. **Header subutilizado** — so breadcrumb + Cmd+K, sem notificacoes ou acoes contextuais
6. **Transicoes de pagina abruptas** — o `animate-in` e basico, sem page transitions suaves
7. **Tabelas sem paginacao** — listas de pacientes e transacoes crescem infinitamente
8. **Formularios em dialogs pequenos** — dialogs de cadastro ficam apertados em mobile
9. **Sem feedback visual de estado** — nao ha toast de confirmacao com undo, nao ha indicators de sync
10. **Odontograma nao e responsivo** — SVGs de tamanho fixo quebram em telas menores

---

## Mudancas Planejadas

### 1. Bottom Navigation para Mobile
- Criar `MobileBottomNav.tsx` com 5 icones (Dashboard, Agenda, Pacientes, Financeiro, Mais)
- Mostrar apenas em `< 768px`, esconder sidebar completamente no mobile
- Estilo iOS tab bar: backdrop blur, borda top sutil, icone ativo com label

### 2. Loading Skeletons
- Criar `SkeletonCard.tsx`, `SkeletonTable.tsx`, `SkeletonChart.tsx`
- Substituir todos os spinners (`animate-spin rounded-full border`) por skeletons contextuais
- Dashboard: 4 skeleton KPI cards + skeleton chart area
- Pacientes: skeleton rows/cards
- Financeiro: skeleton table + skeleton chart

### 3. Dark Mode Toggle
- Criar `ThemeProvider` context com localStorage persistence
- Adicionar toggle no header (sol/lua) e na Settings
- Aplicar classe `dark` no `<html>` (ja tem tokens CSS prontos)

### 4. Settings Page Completa
- Secoes: Perfil (nome, email, avatar), Clinica (nome, endereco, horarios), Aparencia (dark mode), Procedimentos (listar/editar tabela procedures)
- Layout com sidebar de secoes + conteudo (tipo Notion settings)

### 5. Header Contextual Melhorado
- Adicionar botao de acao contextual por pagina (ex: "Nova Consulta" na Agenda, "Novo Paciente" em Pacientes)
- Notification bell com badge de contagem (consultas hoje + pagamentos vencidos)
- Dark mode toggle no header

### 6. Page Transitions + Micro-interacoes
- Usar `framer-motion` para `AnimatePresence` nas rotas (fade + slide sutil)
- Hover scale sutil em cards (1.01)
- Tooltip nos icones da sidebar quando colapsada (ja existe via SidebarMenuButton tooltip)
- Smooth scroll no grid da agenda

### 7. Paginacao + Busca Melhorada
- Paginacao na tabela de pacientes (20 por pagina)
- Paginacao nas transacoes financeiras
- Debounce no input de busca (300ms)

### 8. Responsividade do Odontograma
- Tornar o SVG grid responsivo com `viewBox` e `max-w` constraints
- Em mobile: empilhar arcadas (superior em cima, inferior embaixo) ao inves de lado a lado
- Aumentar area de toque dos dentes em mobile

### 9. Toasts + Feedback
- Usar toast com acao de undo para delecoes
- Adicionar indicador de "salvando..." em formularios inline
- Badge de "ao vivo" pulsando no header quando conectado ao realtime

### 10. Refinamentos Visuais Finais
- Trocar o logo "IA" por um SVG real (dente estilizado)
- Cards com `ring-1 ring-border/50` ao inves de `border` para visual mais clean
- Tabela com rows alternadas sutis (`even:bg-muted/30`)
- Inputs com `focus-visible:ring-2 focus-visible:ring-primary/20` consistente
- Avatar com imagem real quando disponivel (upload no perfil)

---

## Arquivos a Criar/Modificar

| Arquivo | Acao |
|---|---|
| `src/components/MobileBottomNav.tsx` | Novo — bottom tab bar |
| `src/components/ThemeProvider.tsx` | Novo — dark mode context |
| `src/components/SkeletonLoaders.tsx` | Novo — skeleton components |
| `src/components/AppLayout.tsx` | Modificar — add bottom nav, theme toggle, notification bell |
| `src/components/AppSidebar.tsx` | Modificar — esconder em mobile |
| `src/pages/SettingsPage.tsx` | Reescrever — settings completa |
| `src/pages/Index.tsx` | Modificar — skeletons, micro-animacoes |
| `src/pages/Patients.tsx` | Modificar — paginacao, skeletons |
| `src/pages/Financial.tsx` | Modificar — paginacao, skeletons |
| `src/pages/Odontogram.tsx` | Modificar — responsividade mobile |
| `src/pages/Agenda.tsx` | Modificar — mobile layout |
| `src/index.css` | Modificar — refinamentos visuais |
| `src/App.tsx` | Modificar — wrap com ThemeProvider |

## Ordem de Implementacao

1. ThemeProvider + dark mode toggle + refinamentos CSS
2. Loading skeletons + micro-animacoes
3. Mobile bottom navigation + responsividade
4. Header contextual (notificacoes + acoes por pagina)
5. Settings page completa
6. Paginacao + odontograma responsivo

