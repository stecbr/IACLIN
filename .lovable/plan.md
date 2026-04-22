

# Plano: Painel do Médico (visão dedicada)

Criar uma experiência separada para o `dentist`, removendo módulos administrativos (Secretária IA, Financeiro, Gestão da Clínica, Configurações da clínica) e filtrando dados para mostrar **apenas o que pertence ao médico logado**.

## 1. O que muda na navegação do médico

Sidebar enxuta para `dentist`:

- **Início (Hoje)** — dashboard pessoal: próximas consultas, atendimentos do dia, retornos sugeridos, atalho "iniciar atendimento", aniversariantes da semana entre os pacientes dele.
- **Minha Agenda** — somente `appointments` com `dentist_id = auth.uid()`.
- **Meus Pacientes** — somente pacientes com pelo menos um `appointment` ou `clinical_record` dele. Ao clicar, abre o **prontuário completo** com acesso a anamnese, odontograma, exames/documentos, histórico/timeline, planos de tratamento (mesmas telas atuais — não vão ser duplicadas).
- **Atendimento** — fluxo clínico atual.
- **Odontograma** — acesso direto.
- **Orçamentos / Planos de Tratamento** — somente os que ele criou (`dentist_id = auth.uid()`), com valores totais visíveis.
- **Disponibilidade** — gerenciar próprios horários/folgas.
- **Minhas Clínicas** (ClinicSwitcher na sidebar) — só aparece se o médico atende em mais de uma clínica.
- **Meu Perfil** — dados pessoais, especialidade, registro, foto, senha.

Sai da sidebar do médico:
- ❌ Secretária IA (`/secretaria-ia`)
- ❌ Financeiro (`/financial`)
- ❌ Clínica → Visão geral / Médicos / Faturamento
- ❌ Configurações da clínica (vira só "Meu Perfil")

## 2. Filtros por dono dos dados

Quando `effectiveRole === 'dentist'`, aplicar filtros automáticos (sem toggle "ver tudo"):

- **Agenda** (`src/pages/Agenda.tsx`): query e filtro de profissional travados em `dentist_id = auth.uid()`.
- **Pacientes** (`src/pages/Patients.tsx`): listar apenas IDs únicos de pacientes presentes em `appointments` ou `clinical_records` do médico. Detalhe do paciente (`/patients/:id`) continua liberado e mostra **tudo** do prontuário (anamnese, odontograma, documentos/exames, timeline, planos).
- **Orçamentos** (`src/pages/Budgets.tsx`): kanban filtrado por `treatment_plans.dentist_id = auth.uid()`. Totais (R$) continuam visíveis nos cards do médico.
- **Notificações** (`src/components/NotificationBell.tsx`): hoje a query traz tudo da clínica via RLS; ajustar a query no front para `user_id = auth.uid()` quando médico, escondendo notificações da clínica que não são dele.
- **Início**: `DentistHome` calcula KPIs apenas dos próprios atendimentos/pacientes.

## 3. Mudanças técnicas

**RBAC** (`src/hooks/useRoleAccess.ts`) — atualizar `routePermissions`:

```text
'/'                       → admin, dentist, secretary
'/agenda'                 → admin, dentist, secretary
'/disponibilidade'        → admin, dentist
'/patients'               → admin, dentist, secretary
'/patients/:id'           → admin, dentist, secretary
'/odontogram'             → admin, dentist
'/atendimento/:id'        → admin, dentist
'/budgets'                → admin, dentist            (NOVO: liberar pro médico)
'/financial'              → admin, secretary         (médico fora)
'/secretaria-ia*'         → admin                    (médico fora)
'/clinica*'               → admin                    (médico fora)
'/settings'               → admin, secretary         (médico fora)
'/perfil'                 → admin, dentist, secretary (NOVO)
```

**Sidebar** (`src/components/AppSidebar.tsx`) — anotar cada item com `allowedRoles` e deixar `filterNavItems` (já existente) cuidar da visibilidade. Esconder grupos "Gestão da Clínica" para `dentist`. Adicionar `ClinicSwitcher` no topo quando houver múltiplas clínicas.

**Mobile bottom nav** (`src/components/MobileBottomNav.tsx`) — para médico: Início, Agenda, Pacientes, Perfil.

**Página Início** (`src/pages/Index.tsx`) — detectar `effectiveRole === 'dentist'` e renderizar `DentistHome` em vez do dashboard de admin.

**Componentes/páginas novos**:
- `src/pages/dentist/DentistHome.tsx` — KPIs pessoais + próximas consultas + retornos.
- `src/pages/Profile.tsx` — edita `profiles` + `clinic_members.specialty/registration_number`.
- `src/components/ClinicSwitcher.tsx` — dropdown na sidebar (a infra já existe no `AuthContext`).

**Filtros nos hooks/páginas**: adicionar branch `if (effectiveRole === 'dentist') query.eq('dentist_id', user.id)` em `Agenda.tsx`, `Budgets.tsx` e na lista de `Patients.tsx` (usar JOIN/`in` com IDs vindos de `appointments`+`clinical_records` do médico).

**Notificações**: ajustar `NotificationBell` para filtrar por `user_id = auth.uid()` quando `dentist`, em vez de pegar tudo da clínica.

**Memória**: atualizar `mem://auth/roles` com a nova matriz e criar `mem://features/dentist-panel` documentando o painel dedicado.

## 4. O que NÃO muda

- Detalhe do paciente (`/patients/:id`) continua o mesmo — médico vê **anamnese, odontograma, documentos/exames, histórico, planos** completos do paciente que ele atende.
- RLS do banco fica como está (acesso por clínica). Os filtros por `dentist_id` são aplicados no front, então qualquer admin/secretária continua vendo tudo.
- Nenhuma mudança em edge functions ou migrations.

