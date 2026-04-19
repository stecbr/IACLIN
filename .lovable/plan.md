

## Gerenciamento de Disponibilidade do Profissional + Especialidade

### 1. Banco de dados (migração)

**Nova tabela `professional_availability`** — define os turnos de trabalho de cada profissional por dia.

```text
professional_availability
├── id (uuid, pk)
├── clinic_id (uuid)
├── user_id (uuid)         ← profissional (clinic_member)
├── work_date (date)       ← dia específico (não recorrente, suporta domingos/feriados)
├── start_time (time)
├── end_time (time)
├── is_holiday_override (bool)  ← marcou "vou trabalhar em feriado"
├── created_at, updated_at
└── UNIQUE(user_id, work_date, start_time)
```

RLS: membros da clínica veem/editam; pacientes/anônimos podem **ler** (necessário pro marketplace e booking).

**Nova coluna em `clinic_members`**: `specialty text` — o id da especialidade (ex.: `cardiologia`, `dentista`) escolhida na aba Configurações.

### 2. Nova aba no painel do profissional: "Disponibilidade"

- Rota: `/disponibilidade` (sidebar com ícone `CalendarClock`, abaixo de Agenda).
- RBAC: admin + dentist (não secretary).

**Layout:**
- **Banner de aviso** topo: "Defina sua agenda de [Próximo Mês] até dia 15 de [Mês Atual]". Vira amarelo se hoje > dia 10, vermelho se > dia 15 (e ainda sem disponibilidade do mês seguinte).
- **Calendário mensal** (`shadcn Calendar` mode `multiple`, `pointer-events-auto`) à esquerda — clicar um dia abre painel à direita.
- **Painel direito** — lista de turnos do dia selecionado (início/fim), botão "Adicionar turno", botão remover. Salva direto no banco (otimista com toast).
- **Feriados**: usa biblioteca `date-holidays` (já cobre Brasil — nacionais, estaduais por UF, municipais por código IBGE). Lê `clinic.state` + `clinic.city` pra resolver. Dias de feriado aparecem com borda âmbar no calendário e tooltip com o nome.
- **Modal de confirmação** ao tentar abrir disponibilidade em feriado: "Atenção: O dia [dd/MM] é feriado ([nome]). Deseja abrir agenda mesmo assim?" com botões "Sim, vou trabalhar" / "Cancelar". Se confirmar, marca `is_holiday_override = true`.

### 3. Configurações → campo "Especialidade"

- Nova subseção em `SettingsPage.tsx` (ou dentro de "Perfil") com `Select` populado a partir da lista `SPECIALTIES` (já existe em `SpecialtyStep.tsx` — vou exportar e reutilizar).
- Salva em `clinic_members.specialty` do membro logado na clínica atual.
- Aviso sutil: "Você só aparecerá nas buscas de pacientes para esta especialidade."

### 4. Conexão com o agendamento do paciente

Atualizar `src/components/patient/booking/ClinicDoctorStep.tsx`:

1. Em vez de gerar slots a partir de `clinic.business_hours` para todos os membros, **buscar `professional_availability` na data escolhida**, agrupar por `user_id`.
2. **Filtrar membros pela especialidade**: `clinic_members.specialty === specialty.id` (a especialidade selecionada na etapa 1).
3. Slots de 30 min são gerados dentro de cada turno do profissional, removendo os já agendados em `appointments`.
4. Empty state: "Nenhum profissional desta especialidade tem horário disponível neste dia."

Atualizar `src/components/patient/booking/DateStep.tsx`: o "preview de disponibilidade" passa a contar profissionais com `professional_availability` na data + filtrados por especialidade.

### 5. Conexão com o Marketplace

Atualizar `src/pages/Marketplace.tsx` / `MarketplaceMap.tsx` / `DoctorCard.tsx`:
- Cada clínica/profissional no mapa só é exibido se houver pelo menos uma `professional_availability` futura (próximos 30 dias) que case com a(s) especialidade(s) filtrada(s).
- Card do profissional mostra "Próximo horário disponível: [data/hora]" puxando do registro mais próximo.

### 6. Arquivos novos / editados

**Novos:**
- `supabase/migrations/<timestamp>_professional_availability_and_specialty.sql`
- `src/pages/Availability.tsx` — página principal
- `src/components/availability/AvailabilityCalendar.tsx` — calendário mensal com marcação de feriados
- `src/components/availability/DayShiftsPanel.tsx` — painel direito de turnos
- `src/components/availability/HolidayConfirmDialog.tsx` — modal de feriado
- `src/components/availability/MonthlyDeadlineBanner.tsx` — banner regra do dia 15
- `src/lib/holidays.ts` — wrapper sobre `date-holidays`
- `src/components/settings/SpecialtySection.tsx` — select de especialidade

**Editados:**
- `src/App.tsx` — adicionar rota `/disponibilidade`
- `src/components/AppSidebar.tsx` — adicionar item "Disponibilidade"
- `src/hooks/useRoleAccess.ts` — adicionar regra para `/disponibilidade`
- `src/pages/SettingsPage.tsx` — adicionar seção "Especialidade"
- `src/components/patient/booking/SpecialtyStep.tsx` — exportar `SPECIALTIES` (já está exportado, ok)
- `src/components/patient/booking/ClinicDoctorStep.tsx` — usar `professional_availability` + filtro por `specialty`
- `src/components/patient/booking/DateStep.tsx` — preview baseado em disponibilidade real
- `src/pages/Marketplace.tsx` + `src/components/marketplace/DoctorCard.tsx` — filtrar por disponibilidade futura

### 7. Dependência

Adicionar `date-holidays` (~80kb, MIT, cobre BR completo com estados e municípios).

### Fora de escopo
- Templates recorrentes ("toda segunda 8-12") — V2.
- Auto-bloqueio em férias — V2.
- Notificação push lembrando o dentista do dia 15 — pode ficar só como banner agora.

