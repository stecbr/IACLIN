## Pacientes do Dia

Nova aba focada no profissional (médico/dentista) que mostra todos os pacientes agendados para o dia, com possibilidade de iniciar o atendimento direto dali. Aparece acima de "Pacientes" no menu lateral.

### Onde

- Rota: `/pacientes-do-dia`
- Menu lateral (`AppSidebar.tsx`): novo item logo acima de "Pacientes" no grupo Clínica
- Ícone: `CalendarDays` (lucide)
- Visível para roles: `admin`, `dentist` (secretary continua tendo a Sala de Espera)

### Comportamento da página

Lista vertical estilo timeline dos agendamentos do dia, ordenada por horário, mostrando para cada consulta:

- Horário (start_time → end_time) com destaque para "agora", "próximo" e "atrasado"
- Avatar + nome do paciente
- Procedimento (nome + cor) e sala (se houver)
- Status visual de presença: Aguardado / Na recepção / Em atendimento / Finalizado / Falta
- Para dentistas: filtra automaticamente pelas consultas do próprio profissional. Para admin: filtro opcional por profissional (mesmo padrão de `WaitingRoom.tsx`).

Ações por card:
- **Iniciar atendimento** — só habilitado quando paciente está `arrived` ou `not_arrived`. Atualiza `presence_status='in_service'`, `status='in_progress'`, dispara `startSession()` do `consultationSession.ts` e navega para `/atendimento/:appointmentId`.
- **Voltar ao atendimento** — quando já existe sessão ativa local para aquele appointment (FAB lógica), navega de volta.
- **Marcar presença** — atalho rápido (`arrived`) para casos sem secretária.
- **Ver paciente** — link para `/patients/:id`.

KPIs no topo (mesmo estilo dos tiles em `WaitingRoom.tsx`): Total do dia / Aguardando / Em atendimento / Finalizados.

Estado vazio quando não houver agendamentos no dia.

Realtime via Supabase channel em `appointments` filtrando `clinic_id` (mesma abordagem da Sala de Espera) para refletir mudanças sem refresh manual.

### Diferença vs. Sala de Espera

- Sala de Espera é operacional (secretaria) e organizada em colunas Kanban por presença.
- Pacientes do Dia é centrada no profissional, formato linha do tempo, foco em iniciar/retomar consulta. Reaproveita a sessão local existente (`consultationSession.ts`, `useActiveConsultation`) para integrar com timer flutuante já implementado.

### Arquivos

**Novos**
- `src/pages/PatientsOfDay.tsx` — página com query, KPIs, lista, realtime e ações.
- `src/components/patients-of-day/DayAppointmentRow.tsx` — card/linha de cada consulta.

**Editados**
- `src/App.tsx` — registrar rota `/pacientes-do-dia` dentro de `ProtectedRoute`.
- `src/hooks/useRoleAccess.ts` — adicionar `{ path: '/pacientes-do-dia', allowedRoles: ['admin', 'dentist'] }`.
- `src/components/AppSidebar.tsx` — inserir item "Pacientes do Dia" no `clinicNav` posicionado imediatamente antes de "Pacientes" (categorias = todas, roles = admin+dentist), com badge de contagem do dia (reutilizando query existente `today-apt-count`).

### Detalhes técnicos

- Query: `appointments` do dia (`gte/lte` em `start_time`) com joins em `patients(full_name, photo_url)` e `procedures(name, color)`, filtrando `clinic_id` e excluindo `cancelled`. Para dentista: também `eq('dentist_id', user.id)`.
- Iniciar atendimento: update `{ presence_status: 'in_service', status: 'in_progress', service_started_at: now() }`, depois `startSession({ appointmentId, patientId, patientName, startedAt })`, depois `navigate('/atendimento/:id')`.
- Detectar sessão ativa: `useActiveConsultation()` para mostrar botão "Voltar ao atendimento" no card correspondente.
- Realtime: canal `patients-of-day-${clinic_id}` com `postgres_changes` em `appointments`.
- Mobile: lista colapsa em cards verticais; KPIs grid 2x2.

### Fora do escopo

- Não altera Sala de Espera nem fluxo do `Attendance.tsx`.
- Não muda schema de banco.
- Não introduz novas permissões além das já existentes.
