---
name: Dentist Panel
description: Dedicated dashboard and navigation for dentist role with personal data filters
type: feature
---
Painel dedicado ao médico (`role = dentist`):
- `/` renderiza `DentistHome` (KPIs pessoais: consultas hoje, atendimentos no mês, pacientes únicos, planos abertos, agenda do dia, aniversariantes da semana entre seus pacientes).
- `/agenda`, `/budgets` filtrados por `dentist_id = auth.uid()`.
- `/patients` lista apenas IDs únicos de `appointments` ou `clinical_records` do médico.
- `/perfil` (Profile.tsx) edita `profiles` (nome, telefone) + `clinic_members` (especialidade, registration_number) + senha.
- Sidebar: oculta Secretária IA, Financeiro, Clínica (admin/owner). Mostra "Meu Perfil" no rodapé em vez de Configurações.
- Mobile bottom nav: Início, Agenda, Pacientes, Perfil + Mais (Odontograma, Orçamentos).
- Notificações filtradas por `user_id`.
