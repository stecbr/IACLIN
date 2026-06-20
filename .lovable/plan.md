
## Problemas identificados

1. **Pacientes/Exames (área do paciente) não mostra os pedidos feitos no atendimento.**
   - O atendimento salva pedidos com kinds: `lab_exam`, `imaging_exam`, `prescription`, `referral`.
   - A página `PatientExams.tsx` só lê: `prescription`, `referral`, `doc_exam_request`, `doc_prescription`, `doc_referral`, `doc_certificate`.
   - Resultado: **exames laboratoriais e de imagem ficam invisíveis** para o paciente.

2. **Resumo do atendimento não fica salvo em lugar nenhum como PDF.**
   - Hoje, ao finalizar, o `AttendanceSummaryModal` abre. O botão "Exportar PDF" só faz `window.open + print` — nada é guardado.
   - O médico precisa que, ao finalizar o atendimento, o sistema **automaticamente** crie uma pasta nos "Arquivos privados" do paciente (aba **Arquivos** em `/patients/:id`) nomeada com a data/hora da consulta, e salve dentro dela:
     - Resumo do Atendimento (PDF)
     - Receituário (PDF) — se houver prescrição
     - Solicitação de Exames (PDF) — se houver lab_exam/imaging_exam
     - Encaminhamento (PDF) — se houver referral
     - Atestado (PDF) — se houver

## O que vai ser feito

### 1. Exibir exames/encaminhamentos no prontuário do paciente

**`src/pages/patient/PatientExams.tsx`**
- Acrescentar handling para `kind === 'lab_exam'` e `kind === 'imaging_exam'` no `recordDocs` query — agrupar como "Solicitação de exames" (mesma estrutura `ExamRequestFromRecord`), montando `exams: [payload.name]`, `indication: payload.justification`.
- Já existe handling de `prescription` e `referral` — confirmar que aparecem na lista filtrada.

### 2. Gerar PDFs como Blob (não só print)

Adicionar dependência leve **`html2pdf.js`** (wraps jsPDF + html2canvas, ~300 KB) para converter HTML em Blob no navegador.

Refatorar geradores para expor uma função `buildXxxBlob()` (paralela ao `generateXxxPdf()` que dá print). Usar o mesmo HTML interno:
- `src/lib/generateAttendancePdf.ts` → adicionar `buildAttendancePdfBlob(data): Promise<Blob>`
- `src/lib/generatePrescriptionPdf.ts` → `buildPrescriptionPdfBlob(...)`
- `src/lib/generateExamRequestPdf.ts` → `buildExamRequestPdfBlob(...)`
- `src/lib/generateReferralPdf.ts` → `buildReferralPdfBlob(...)`
- `src/lib/generateCertificatePdf.ts` → `buildCertificatePdfBlob(...)`

### 3. Auto-arquivar na finalização do atendimento

**`src/pages/Attendance.tsx` → função `handleFinish`** (depois de marcar `appointment.status = 'completed'`, antes do `toast.success`):

1. Chamar nova função `archiveAttendanceFiles({ appointment, record, requests, user, ... })` (novo módulo `src/lib/archiveAttendanceFiles.ts`).
2. Ela faz:
   - `INSERT documents` (folder) com:
     - `patient_id`, `uploaded_by = user.id`
     - `file_type = 'folder'`, `category = 'doctor_folder'`
     - `name = "Consulta {dd/MM/yyyy HH:mm}"`
   - Para cada PDF: gera Blob → `supabase.storage.from('patient-files').upload(path, blob)` (path: `{patientId}/consultas/{folderId}/{slug}.pdf`) → `INSERT documents` com `category = 'doctor_file:{folderId}'`, `name = "Resumo de Atendimento.pdf"` etc., `file_type = 'application/pdf'`, `file_url = path`.
3. Falhas individuais não bloqueiam a finalização — só mostram `toast.warning`.

A aba **Arquivos** (`PatientFiles.tsx`) já lê `doctor_folder` + `doctor_file:{folderId}` — vai aparecer automaticamente.

### 4. Não duplicar quando re-finalizar

Antes de criar a pasta, checar se já existe uma pasta `doctor_folder` para este `appointment_id` — guardar `appointment_id` num campo. Como `documents` não tem essa coluna, vou usar uma convenção no `name` (`Consulta {data} #appt:{id8}`) ou criar uma migration adicionando `appointment_id` na tabela `documents` (preferido — mais limpo).

**Migration**: adicionar coluna `appointment_id uuid null` em `public.documents` + índice. Sem mudança de RLS (já existente cobre por paciente/uploader).

## Resumo técnico (para devs)

| Arquivo | Mudança |
|---|---|
| `package.json` | + `html2pdf.js` |
| `src/lib/generateAttendancePdf.ts` | + `buildAttendancePdfBlob` |
| `src/lib/generatePrescriptionPdf.ts` | + `buildPrescriptionPdfBlob` |
| `src/lib/generateExamRequestPdf.ts` | + `buildExamRequestPdfBlob` |
| `src/lib/generateReferralPdf.ts` | + `buildReferralPdfBlob` |
| `src/lib/generateCertificatePdf.ts` | + `buildCertificatePdfBlob` |
| `src/lib/archiveAttendanceFiles.ts` | **novo** — orquestra blob → storage → documents |
| `src/pages/Attendance.tsx` | chamar `archiveAttendanceFiles` no `handleFinish` |
| `src/pages/patient/PatientExams.tsx` | reconhecer `lab_exam`/`imaging_exam` |
| Migration | `ALTER TABLE public.documents ADD COLUMN appointment_id uuid;` + índice |

## Fora do escopo

- Não mexer no fluxo da secretária / financeiro.
- Não mexer no modal de resumo nem nos botões manuais de PDF existentes (continuam funcionando via `window.print`).
- Não regenerar PDFs para atendimentos antigos — só novos atendimentos finalizados a partir da implementação.
