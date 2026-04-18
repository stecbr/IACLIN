

User wants the first 3 items implemented together:
1. Agendamento direto pelo painel + detalhe da consulta com mapa/WhatsApp
2. Notificações em tempo real (sino + toasts)
3. Timeline de histórico clínico

## Plano: 3 melhorias na área do paciente

### 1. Agendamento direto + Detalhe da consulta

**Novo:** `src/components/patient/AppointmentDetailDrawer.tsx`
- Drawer (Sheet) que abre ao clicar numa consulta em `PatientAppointments` ou no card "Próxima consulta" do `PatientHome`
- Mostra: dentista (avatar + nome), clínica (nome, endereço, telefone), data/hora formatada, status, procedimento, observações
- Mini-mapa Leaflet (reusa padrão de `MarketplaceMap` — imperativo via ref) com marcador na clínica
- Botões: "Abrir no Google Maps" (link externo), "WhatsApp da clínica" (`https://wa.me/...`), "Cancelar consulta", "Confirmar presença"

**Modificar:** `src/hooks/usePatientData.ts`
- Adicionar `procedure_id` + `procedure_name` ao select de appointments (join com `procedures`)
- Adicionar `latitude`/`longitude` ao select de clinics (se existir; senão geocode via `lib/geocode.ts` no drawer)

**Modificar:** `src/pages/patient/PatientHome.tsx` + `PatientAppointments.tsx`
- Tornar cards de consulta clicáveis → abrem o drawer
- Botão "Agendar consulta" já existe → garantir que `MarketplaceHeader` reconhece o paciente logado e o `BookingConfirmation` pré-preenche dados (já feito anteriormente)

### 2. Notificações em tempo real

**Novo:** `src/hooks/usePatientNotifications.ts`
- Query `notifications` filtrando por `user_id = auth.uid()` (RLS já permite)
- Subscription Supabase Realtime no canal `notifications` para INSERT
- Ao receber: `toast.success/info` + invalidar query
- Retorna: `{ notifications, unreadCount, markAsRead, markAllAsRead }`

**Migration necessária:**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
-- Trigger novo: notificar paciente quando appointment muda status
CREATE OR REPLACE FUNCTION notify_patient_appointment_change() ...
-- INSERT em notifications com user_id = patients.patient_user_id
```

**Modificar:** `src/components/PatientLayout.tsx`
- Adicionar `<PatientNotificationBell />` ao header (espelha `NotificationBell` da clínica, mas com hook próprio)

**Novo:** `src/components/patient/PatientNotificationBell.tsx`
- Popover com lista de notificações, badge animado de não lidas, "marcar todas como lidas"

**Bonus:** Subscription também em `appointments` (filtro `patient_id`) para invalidar `usePatientData` em tempo real

### 3. Timeline de histórico clínico

**Novo:** `src/pages/patient/PatientHistory.tsx`
- Reusa `PatientTimeline` (já existe em `src/components/patients/PatientTimeline.tsx`)
- MAS: o componente atual recebe `patientId` (clinic patient row). Precisamos passar todos os `patient.id` vinculados ao `patient_user_id` (paciente pode ter prontuário em várias clínicas)
- Solução: criar `PatientTimelineMulti` que aceita `patientIds: string[]` e faz `.in('patient_id', ids)` nas queries

**Novo:** `src/components/patient/PatientTimelineMulti.tsx`
- Cópia adaptada de `PatientTimeline` aceitando array de IDs
- Mesmo design (linha vertical, dots coloridos, cards com hover)

**Modificar:** `src/components/PatientSidebar.tsx`
- Adicionar item "Histórico" entre "Minhas Consultas" e "Meus Exames" — ícone `History` (lucide)

**Modificar:** `src/App.tsx`
- Nova rota `/paciente/historico` → `<PatientHistory />`

**Modificar:** `src/hooks/useRoleAccess.ts`
- Permitir `/paciente/historico` para role `patient`

**Modificar:** `src/pages/patient/PatientHome.tsx`
- Adicionar mini-preview da timeline (últimos 3 eventos) com link "Ver tudo"

### Resumo de arquivos

**Novos (6):**
- `src/components/patient/AppointmentDetailDrawer.tsx`
- `src/components/patient/PatientNotificationBell.tsx`
- `src/components/patient/PatientTimelineMulti.tsx`
- `src/hooks/usePatientNotifications.ts`
- `src/pages/patient/PatientHistory.tsx`
- 1 migration SQL (realtime + trigger paciente)

**Modificados (6):**
- `src/hooks/usePatientData.ts` (+ procedure, + lat/lng, + lista de patientIds exposta)
- `src/pages/patient/PatientHome.tsx` (drawer + mini-timeline)
- `src/pages/patient/PatientAppointments.tsx` (drawer)
- `src/components/PatientLayout.tsx` (+ bell)
- `src/components/PatientSidebar.tsx` (+ Histórico)
- `src/App.tsx` + `src/hooks/useRoleAccess.ts` (rota nova)

