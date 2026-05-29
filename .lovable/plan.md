## Exclusão pontual: clínica "Bumbum duro"

**Alvo**
- Clínica: `Bumbum duro` (id `4158c8ae-98ac-4f84-b1b8-715066b4a356`)
- Dono: `pl8209297@gmail.com` (id `cbf16d78-2141-4086-927d-fd8564a1353f`)
- Membro: `jose@gmail.com` (id `bfea9bdb-e633-4d52-93d6-54774997aaf2`)
- Nenhum paciente, agendamento, financeiro ou assinatura vinculados.

**Passos (uma única migration de DELETE pontual)**
1. Apagar dados dependentes da clínica em todas as tabelas com `clinic_id = 4158c8ae...`: `clinic_members`, `clinic_rooms`, `clinic_invites`, `ai_tenants`, `ai_secretary_config`, `ai_secretary_handoff`, `ia_gestor_threads`, `ia_gestor_folders`, `whatsapp_instances`, `whatsapp_messages`, `professional_schedule_template`, `professional_availability`, `professional_blocked_dates`, `insurance_plans`, `operator_credentialings`, `prescription_templates`, `notifications`, `patient_chart_shares`, `clinical_map_entries`, `clinical_records`, `anamneses`, `consultation_recordings`, `appointment_requests`, `financial_transactions`, `appointments`, `patients`.
2. `DELETE FROM platform_subscriptions WHERE entity_type='clinic' AND entity_id=…` (defensivo).
3. `DELETE FROM clinics WHERE id=…`.
4. `DELETE FROM user_roles WHERE user_id IN (dono, jose)`.
5. `DELETE FROM auth.users WHERE id IN (dono, jose)` — remove definitivamente as duas contas de login.

Tudo roda dentro de uma migration única, transacional. Como não há pacientes/agenda/financeiro, a operação é rápida e sem efeito colateral em outras clínicas (confirmei que nenhum dos dois usuários pertence a outra clínica).

**Sem mudanças de código** — é apenas limpeza de dados via migration SQL.
