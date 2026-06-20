## Diagnóstico

1. **Documentos vem pré-preenchido ao abrir um novo atendimento**
   `DocumentsTab.tsx` salva um rascunho em `localStorage` na chave `doc-draft-${patientId}-${today}` e o restaura no mount. Como a chave usa só paciente + dia, qualquer atendimento aberto no mesmo dia mostra o que foi digitado antes — mesmo após finalizar a consulta anterior.

2. **PDF “Resumo de Atendimento.pdf” sai em texto cru (image-269)**
   O `htmlToPdfBlob` renderiza via `<iframe srcdoc>` e passa `iframe.contentDocument.body` para `html2pdf`. Internamente o html2pdf cria um clone do elemento num container fora do iframe — o clone fica sem as regras `<style>` que estavam no `<head>` do `srcdoc`, então o canvas captura só texto sem CSS (sem cabeçalho colorido, sem grid, sem tabela). O fluxo de impressão da consulta (image-270) funciona porque usa `window.open` + `window.print` no HTML completo.

3. **“Documentos Médicos” do botão “Imprimir documentos” não aparecem na pasta do paciente nem na visão do paciente**
   - `DocumentsTab.handlePrint` só abre um `window.open` para imprimir e grava `clinical_record_requests` (`doc_exam_request`, `doc_prescription`, `doc_referral`, `doc_certificate`). Não gera nenhum PDF salvo em `documents`/Storage, então nada vai para `patients/Arquivos/Consulta dd/mm/aaaa`.
   - `PatientExams` e `PatientRecord` já leem esses `doc_*` corretamente — o que faltava aparecer realmente são os PDFs físicos arquivados.

## Mudanças

### 1. `src/lib/htmlToPdfBlob.ts` — renderização fiel
Substituir a abordagem do iframe por uma que preserva o CSS:
- Extrair `<style>` + `<body>` do HTML completo (usar o mesmo padrão de `extractHtmlParts`).
- Criar um container `div` fixo fora da tela, com `width: 210mm`, `background:#fff`, injetar `<style>...</style>` + body do documento dentro dele (mantendo o CSS no escopo desse container).
- Aguardar `document.fonts.ready` e `Promise.all(images.map(loaded))` antes de capturar.
- Passar esse `div` para `html2pdf().set({ ... pagebreak: { mode: ['css','legacy'] } }).from(el).outputPdf('blob')`.
- Limpar o container no `finally`.

Isso replica o mesmo HTML que vai para `window.print` (image-270), agora em PDF.

### 2. `src/components/attendance/DocumentsTab.tsx` — arquivar “Documentos Médicos”
Em `handlePrint`, após gerar o `combined` HTML e abrir o `window.print`, **também** gerar `htmlToPdfBlob(combined, 'Documentos Médicos.pdf')` e fazer upload na mesma pasta da consulta do paciente. Para reutilizar a lógica de pasta (idempotente por `appointment_id`), extrair de `archiveAttendanceFiles.ts` um helper exportado `ensureConsultationFolder({ patientId, userId, appointmentId, startTime })` que devolve o `folderId`, e exportar `uploadPdfToFolder(...)`. Em seguida usar essas duas funções no `DocumentsTab`.

Requisitos no DocumentsTab para isso funcionar:
- Adicionar prop opcional `appointmentId?: string` e `appointmentStartTime?: string`. Atendimento.tsx já tem ambos — passar no JSX.
- Só arquivar quando `appointmentId` existir e houver ao menos um documento preenchido. Falhas reportadas via `toast`, sem bloquear a impressão.

### 3. `src/components/attendance/DocumentsTab.tsx` — não pré-preencher novo atendimento
- Trocar a chave de rascunho `doc-draft-${patientId}-${today}` por `doc-draft-${appointmentId}` (fallback ao formato antigo se `appointmentId` ausente, para não quebrar telas sem agendamento).
- Limpar `localStorage.removeItem(draftKey)` ao final de `handlePrint` bem-sucedido **e** quando o atendimento é finalizado.
- Em `src/pages/Attendance.tsx#handleFinish`, depois do archive, também remover a chave `doc-draft-${appointmentId}`.

### 4. Nenhuma mudança em RLS, schema, ou no fluxo de finalização
O `archiveAttendanceFiles` continua sendo chamado em `handleFinish`. A correção do `htmlToPdfBlob` automaticamente faz com que o “Resumo de Atendimento.pdf” saia bonito como em image-270 e que os “Documentos Médicos.pdf” arquivados saiam idênticos ao print.

## Arquivos editados
- `src/lib/htmlToPdfBlob.ts` (reescrito)
- `src/lib/archiveAttendanceFiles.ts` (exportar `ensureConsultationFolder` + `uploadPdfToFolder`)
- `src/components/attendance/DocumentsTab.tsx` (chave do draft por `appointmentId`, arquivar PDF combinado, limpar draft)
- `src/pages/Attendance.tsx` (passar `appointmentId`/`startTime` para `DocumentsTab`, limpar draft de docs em `handleFinish`)

## Fora de escopo
- Mudar layout de qualquer PDF.
- Mexer em RLS já adicionadas (`patient_user_id`) — elas já permitem o paciente ver os `clinical_record_requests`.
- Mexer no `AttendanceSummaryModal`, no `window.print`, ou no `PatientFiles.tsx`.
