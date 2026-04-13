

# Plano: 4 Features Premium com padroes visuais 21st.dev

## 1. Onboarding Tour / Empty States Premium
**O que muda:**
- Componente `EmptyState` redesenhado com ilustracoes SVG inline (dente, calendario, cifrao), gradientes sutis e animacao fade-in
- Cada pagina (Pacientes, Agenda, Financeiro) mostra um empty state unico com CTA contextual ("Cadastre seu primeiro paciente", "Agende sua primeira consulta")
- Primeiro acesso pos-onboarding: modal de boas-vindas com 3 passos animados (tour rapido)

**Arquivos:** `src/components/EmptyState.tsx` (redesign), novo `src/components/WelcomeTour.tsx`

---

## 2. Notificacoes / Activity Feed
**O que muda:**
- Icone de sino no header (AppLayout) com badge animado (pulse) mostrando contagem
- Dropdown/popover com lista de atividades recentes: consultas confirmadas, pagamentos registrados, novos pacientes
- Cada item com icone, timestamp relativo ("ha 5 min"), e link para o recurso
- Tabela `notifications` no banco com tipo, mensagem, referencia e flag `read`
- Trigger no banco para gerar notificacoes automaticas ao inserir consulta ou pagamento

**Arquivos:** novo `src/components/NotificationBell.tsx`, migration para tabela `notifications`, editar `src/components/AppLayout.tsx`

**Banco:** Nova tabela `notifications` (id, clinic_id, user_id, type, title, message, reference_id, reference_type, read, created_at) com RLS por clinic_member

---

## 3. Timeline do Paciente
**O que muda:**
- Na pagina PatientDetail, adicionar uma tab "Timeline" com linha vertical cronologica
- Cada evento (consulta, pagamento, documento, anotacao) como um card na timeline com icone colorido, data e descricao
- Dados puxados de appointments, financial_transactions e documents do paciente
- Animacao stagger (cada item aparece com delay) usando CSS

**Arquivos:** novo `src/components/patients/PatientTimeline.tsx`, editar `src/pages/PatientDetail.tsx`

---

## 4. Kanban de Orcamentos
**O que muda:**
- Nova pagina `/budgets` com board Kanban de 4 colunas: Pendente, Em Negociacao, Aprovado, Perdido
- Cards draggable usando a lib `@dnd-kit` (leve, React-native)
- Cada card mostra paciente, valor total, procedimentos resumidos e data
- Usa a tabela `treatment_plans` existente (campo `status` ja tem pending/approved, adicionar `negotiating` e `lost`)
- Nova rota no App.tsx, item no sidebar e command palette

**Arquivos:** novo `src/pages/Budgets.tsx`, novo `src/components/budgets/BudgetCard.tsx`, migration para adicionar status values, editar `App.tsx`, `AppSidebar.tsx`, `CommandPalette.tsx`, `MobileBottomNav.tsx`

**Banco:** Migration para permitir novos valores de status em treatment_plans

---

## Ordem de implementacao sugerida
1. Empty States Premium (visual, sem banco)
2. Timeline do Paciente (visual, dados existentes)
3. Notificacoes (novo componente + tabela)
4. Kanban de Orcamentos (nova pagina + drag-and-drop + migration)

## Detalhes tecnicos
- `@dnd-kit/core` e `@dnd-kit/sortable` para o Kanban (~15kb gzipped)
- Notificacoes usam realtime do banco para updates instantaneos
- Nenhuma outra dependencia nova necessaria
- Todos os componentes seguem dark mode e responsividade existentes

