# Revisão do Módulo Prontuário / Atendimento

## 1. O que JÁ EXISTE no sistema

### Ficha do Paciente — `src/pages/PatientDetail.tsx`
- Cabeçalho com dados, convênio, WhatsApp, edição.
- Abas dinâmicas por especialidade: **Info, Anamnese, Documentos, Consultas, Orçamentos, Financeiro, Timeline, Sessões, Evolução, Planos alimentares**.
- Componentes maduros: `PatientAnamnese`, `PatientDocuments`, `PatientTimeline`, `PatientSpecialtyList`, `PatientFormDialog`.
- Histórico associado corretamente via `appointments` + `clinical_records` por `patient_id`.

### Atendimento — `src/pages/Attendance.tsx` + `src/components/attendance/*`
- Fluxo completo com abas por especialidade: **SOAP, Antropometria, Plano Alimentar, Avaliação, Sinais Vitais, Diagnóstico/Hipóteses, Conduta, Solicitações, Notas, Procedimentos, Odontograma**.
- `ConsultationTimer` flutuante + sessão local (`consultationSession`).
- `HistoryDrawer` lateral para histórico do paciente.
- `PatientAlertsBar` (alergias/medicamentos).
- Salvamento estruturado em `clinical_records` + tabelas filhas (`clinical_record_procedures`, `clinical_record_requests`).
- Bloqueio inteligente ao finalizar (exige diagnóstico/hipótese + procedimento/conduta).
- Geração automática de `financial_transactions` ao finalizar.
- Separação clínica vs pessoal já implementada via `clinic_id NULL` (RLS já trata o caso "personal owner").

### Documentos / PDFs — `src/lib/generate*Pdf.ts` + ferramentas
- `generateBudgetPdf`, `generatePrescriptionPdf`, `generateExamRequestPdf`, `generateReferralPdf`, `generateCertificatePdf`.
- Componentes: `PrescriptionPad`, `CertificateGenerator`, `ExamRequestPad`, `ReferralLetterPad` (já usam logo da clínica via `fetchClinicForPdf`).
- `AttendanceSummaryModal` com `window.print()` para imprimir resumo.

### Voz / Ditado — `src/components/dentist/tools/VoiceDictation.tsx`
- Web Speech API (pt-BR), "anexar ao prontuário" como append em `notes`.
- **Não tem**: gravação real de áudio, transcrição via IA, resumo, anamnese estruturada, distribuição automática nos campos.

### Odontograma
- Página dedicada `/odontogram` + `DentalExamForm` embutido na aba do atendimento.

---

## 2. Diagnóstico — Gaps e Melhorias

| Área | Status | Ação |
|---|---|---|
| Ficha clínica do paciente | OK | manter |
| Histórico associado | OK | manter |
| Separação clínica vs pessoal | OK (RLS) | adicionar filtro/badge visual no histórico |
| Odontograma básico | OK | manter |
| Diagnóstico, conduta, prescrição, encaminhamento, exames | OK (abas separadas) | reorganizar em layout único mais fluido |
| Impressão / PDF do atendimento | Parcial (só `window.print`) | criar `generateAttendancePdf` profissional com logo |
| Atestado / receita / exame / encaminhamento | OK (avulso) | já reusados — apenas conectar à aba Solicitações para gerar PDF in-place |
| **Gravação real de consulta** | **Falta** | implementar do zero |
| **Transcrição IA** | **Falta** | edge function via Lovable AI Gateway |
| **Resumo / Anamnese estruturada / SOAP / Hipóteses por IA** | **Falta** | mesma edge function, structured output |
| **Mapeamento automático nos campos** | **Falta** | função client que distribui o JSON da IA nos `setState` existentes |
| Edição pós-IA | N/A | aproveitar inputs já existentes (zero retrabalho) |

---

## 3. Plano de Implementação

### Fase A — Reaproveitamento e PDF profissional (sem novas telas)
1. **`src/lib/generateAttendancePdf.ts`** (novo): PDF do atendimento usando o mesmo padrão visual do `generateBudgetPdf` (logo da clínica, paciente, profissional, data, conteúdo estruturado, assinatura quando houver).
2. Substituir `window.print()` em `AttendanceSummaryModal` por botão "Exportar PDF" + manter "Imprimir".
3. Adicionar botão "PDF do atendimento" no `PatientTimeline` (ícone `FileDown`) — reusa o mesmo gerador.

### Fase B — Gravação inteligente da consulta (fluxo principal)
Inspirado no iClinic, **sem copiar visual** — design Apple-like alinhado com o sistema (rosé/glass quando tema custom).

1. **Migração**: tabela `consultation_recordings`
   - `id, clinical_record_id, appointment_id, patient_id, dentist_id, clinic_id`
   - `audio_storage_path` (bucket privado `consultation-audio`)
   - `duration_seconds, status` (`recording|processing|done|failed`)
   - `transcript text, summary text, hypotheses jsonb, soap jsonb, anamnesis jsonb`
   - `consent_accepted_at timestamptz`
   - RLS: dentista dono OU membro da clínica.
   - Bucket privado + policies por dono/clínica.
   - Tabela `user_consents` (tipo `recording_terms`) para controle de "primeiro acesso".

2. **Componente `RecordingFlow`** (`src/components/attendance/recording/`):
   - `RecordConsultationButton.tsx` — botão "Gravar consulta" no header do `Attendance`.
   - `ConsentDialog.tsx` — modal de Termos de Uso (só primeiro acesso, persiste em `user_consents`).
   - `RecordingFloatingBar.tsx` — barra flutuante: timer + waveform animada (Web Audio API + canvas), botão pausar/retomar, finalizar. Drag opcional.
   - `FinishConfirmDialog.tsx` — modal "Quer finalizar a gravação?" com checkbox "Não mostrar novamente".
   - `ProcessingOverlay.tsx` — barra circular com etapas: *Transcrevendo → Resumindo → Estruturando anamnese → Hipóteses*.
   - `RecordingResultsDialog.tsx` — modal com 5 abas: **Transcrição, Resumo, Hipóteses diagnósticas, SOAP, Anamnese estruturada**. Editor rico (textarea estilizada + formatos básicos). Botões: *Salvar informações* (distribui), *Fechar*, *Reprocessar*.

3. **Edge function `transcribe-consultation`** (`supabase/functions/transcribe-consultation`):
   - Recebe `recording_id`.
   - Lê áudio do storage (signed URL).
   - **STT**: usa Lovable AI Gateway com `google/gemini-3-flash-preview` (suporta áudio multimodal nativamente) ou fallback Whisper se preciso. Retorna texto + diarização (médico/paciente quando possível).
   - **Structured output** (`Output.object` + zod) gera JSON unificado:
     ```ts
     { transcript, summary,
       chief_complaint, history_present_illness, symptom_duration,
       physical_exam, hypotheses[], severity, diagnosis,
       treatment_plan, follow_up_reason,
       requests: { exam[], prescription[], certificate[], referral[] },
       soap: { s, o, a, p },
       anamnesis: { allergies, medications, surgeries, family, social, ... } }
     ```
   - Persiste em `consultation_recordings`. Atualiza `status`.

4. **Mapeamento automático no client** (`applyAiResultToAttendance(result)`):
   - Reusa os `setState` existentes em `Attendance.tsx`: `setChiefComplaint`, `setHpi`, `setDurationValue/Unit`, `setPhysicalExam`, `setHypotheses`, `setDiagnosis`, `setTreatmentPlan`, `setFollowUpReason`, `setRequests` (faz merge), `setSoap`, `setClinicalNotes` (recebe o resumo).
   - **Não cria novos campos** — distribui no que já existe.
   - Toast: "Atendimento preenchido com IA. Revise antes de salvar."

### Fase C — Polimentos UX
- **Atalho global**: botão "Gravar consulta" também no `FloatingConsultationButton` quando há sessão ativa.
- **Indicador de gravação ativa**: badge piscando no header do atendimento.
- **Histórico de gravações** por paciente: nova entrada na timeline (`type: 'recording'`) com link para abrir resultados.
- **Tema**: respeita variáveis semânticas existentes (`--primary`, `--accent`, `--card`); a barra flutuante usa `glass` sutil em modo Rosé Couture.

---

## 4. Arquivos afetados

**Novos**
- `supabase/migrations/<ts>_consultation_recordings.sql`
- `supabase/functions/transcribe-consultation/index.ts`
- `src/lib/generateAttendancePdf.ts`
- `src/lib/applyAiResultToAttendance.ts`
- `src/components/attendance/recording/RecordConsultationButton.tsx`
- `src/components/attendance/recording/ConsentDialog.tsx`
- `src/components/attendance/recording/RecordingFloatingBar.tsx`
- `src/components/attendance/recording/FinishConfirmDialog.tsx`
- `src/components/attendance/recording/ProcessingOverlay.tsx`
- `src/components/attendance/recording/RecordingResultsDialog.tsx`
- `src/hooks/useAudioRecorder.ts`

**Alterados**
- `src/pages/Attendance.tsx` — adicionar botão "Gravar" no header, montar `RecordingFlow`, expor setters via callback.
- `src/components/attendance/AttendanceSummaryModal.tsx` — botão "Exportar PDF".
- `src/components/patients/PatientTimeline.tsx` — entrada para gravações + botão PDF do atendimento.
- `src/integrations/supabase/types.ts` — atualizado automaticamente pela migração.

**Não alterados (compatibilidade)**
- Estrutura de `clinical_records`, `clinical_record_procedures`, `clinical_record_requests`, abas atuais, `useSpecialtyProfile`, RLS atual.

---

## 5. Critérios de Aceitação
- Botão "Gravar consulta" funciona mesmo no primeiro acesso (consentimento → gravação).
- Barra flutuante mostra tempo + waveform real, pausar/retomar, finalizar.
- Modal de confirmação ao finalizar (com "não mostrar novamente").
- Processamento mostra etapas e percentual.
- Modal de resultados com 5 abas editáveis.
- "Salvar informações" preenche os campos existentes do atendimento e o usuário pode revisar e clicar "Salvar" / "Finalizar atendimento" normalmente.
- PDF do atendimento gerado com logo da clínica, paciente, profissional, data.
- Atestado, receita, exame, encaminhamento continuam funcionando como hoje.
- Nenhuma tela duplicada — todo o pós-IA usa os componentes/forms já existentes.
