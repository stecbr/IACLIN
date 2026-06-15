## Diagnóstico atual

- **Prontuário (`PatientDetail`)**: aba "Documentos" já existe (`PatientDocuments`) — médico vê tudo. ✅
- **Atendimento (`HistoryDrawer`)**: não há nenhuma seção de documentos/exames hoje. ❌
- **App do paciente (`PatientExams`)**: somente leitura. Não há botão de upload, e a RLS de `documents` não tem policy de INSERT para o paciente. ❌
- **Storage `patient-files`**: bucket privado. Hoje só clinic_members fazem upload.

## O que vai ser feito

### 1. Permitir o paciente enviar exames

**Migration** (RLS + Storage):
- `documents`: novas policies para o paciente, escopadas a `patients.patient_user_id = auth.uid()`:
  - INSERT permitido apenas com `category = 'patient_exam'` e `uploaded_by = auth.uid()`.
  - DELETE permitido apenas no que ele mesmo enviou (`uploaded_by = auth.uid()` + `category = 'patient_exam'`).
- `storage.objects` no bucket `patient-files`: policies de INSERT/DELETE/SELECT para o paciente quando o `name` começar com `<patient_id>/patient-uploads/...` e o `patients.patient_user_id = auth.uid()`.

**UI — `src/pages/patient/PatientExams.tsx`**:
- Botão "Enviar exame" no topo da aba "Exames".
- Suporta múltiplos arquivos (imagem e PDF), 20 MB cada.
- Upload em `patient-files/<patient_id>/patient-uploads/<timestamp>-<rand>.<ext>`, com registro em `documents` (`category: 'patient_exam'`, `uploaded_by: user.id`, nome original do arquivo).
- Lista combinada continua usando a aba "Exames" — adicionar `'patient_exam'` ao set `EXAM_CATEGORIES` e um pequeno badge "Enviado por você" quando `uploaded_by === user.id`.
- Permitir excluir somente os arquivos do próprio paciente.

### 2. Médico ver documentos durante o atendimento

**`src/components/attendance/HistoryDrawer.tsx`**:
- Adicionar nova aba/seção "Documentos" (lendo `documents` por `patient_id`, ordenado por `created_at desc`).
- Destacar visualmente os exames enviados pelo paciente (`category = 'patient_exam'`, badge "Paciente").
- Cada item abre via `getSignedFileUrl` (lightbox para imagem, nova aba para PDF/outros) — mesmo padrão de `PatientDocuments`.
- Mostrar contador no botão de Histórico quando houver documentos novos desde a última consulta finalizada (opcional, leve).

### 3. Detalhes técnicos

- Reusar `getSignedFileUrl` de `src/lib/storageSignedUrl.ts`.
- Categoria nova `patient_exam` (não conflita; `PatientExams` já trata categorias por set).
- Sem mudanças em `PatientDocuments` no prontuário — ele já consome `documents` por `patient_id` e exibirá os arquivos do paciente automaticamente.
- Sem edge function: upload direto do client, RLS garante o escopo.

## Arquivos afetados

- **novo**: `supabase/migrations/<ts>_patient_upload_exams.sql` (policies em `documents` e `storage.objects`).
- **editado**: `src/pages/patient/PatientExams.tsx` (upload + delete próprio).
- **editado**: `src/components/attendance/HistoryDrawer.tsx` (aba Documentos).
- **editado**: `src/components/patients/PatientDocuments.tsx` (badge "Enviado pelo paciente" quando `category = 'patient_exam'`).

## Fora de escopo

- Notificação automática ao médico/clínica no upload do paciente.
- OCR/IA sobre o exame.
- Compartilhamento entre clínicas dos exames do paciente.