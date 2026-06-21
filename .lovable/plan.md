## Objetivo

1. Replicar em `/paciente/prontuario` a mesma lógica de classificação dos PDFs arquivados (`doctor_file:*`) já implementada em `/paciente/exames`, distribuindo-os nas abas **Prescrições**, **Exames**, **Encaminhamentos** e **Documentos** (em vez de só caírem na lista bruta de documentos).
2. Garantir que o nome do médico apareça em **todas** as cards de receita/exame/encaminhamento — tanto as vindas de `clinical_record_requests` (já mostra) quanto as dos PDFs arquivados (hoje não mostra).
3. Investigar e corrigir o "flash" de tela ao finalizar consulta (algo aparece por ~1s na tela de agendamento antes do estado voltar ao normal).

## Mudanças

### 1. `src/pages/patient/PatientRecord.tsx`

- Reutilizar o `classifyDoc` (mesma lógica de `PatientExams.tsx`, baseada em `category` + prefixo do nome para `doctor_file:*`).
- Na query `patient-docs-tab`, manter o fetch atual mas adicionar metadados extras (`uploaded_by`) para conseguir achar o médico que gerou.
- Buscar `profiles` (id, full_name, specialty, avatar_url) para todos os `uploaded_by` distintos e montar um `doctorByDocId` map.
- Quebrar `documents` em buckets: `examDocs`, `prescriptionDocs`, `referralDocs`, `certificateDocs`, `otherDocs`.
- Em cada aba (Prescrições / Exames / Encaminhamentos), além das cards atuais geradas de `clinical_record_requests`, renderizar uma seção "Arquivos" com os PDFs arquivados correspondentes, mostrando:
  - nome do arquivo,
  - data,
  - **nome do médico** (via `doctorByDocId`) com avatar pequeno,
  - botão "Abrir PDF" (usa `getSignedFileUrl` que já existe).
- Adicionar aba **Atestados** (hoje não existe no Prontuário) somente quando houver `certificateDocs`, seguindo o mesmo padrão visual.
- Aba **Documentos** passa a mostrar apenas os `otherDocs` (resumo de atendimento, uploads do próprio paciente etc.), evitando duplicidade com as outras abas.
- Atualizar os contadores dos `TabsTrigger` para somar `requests + docs` correspondentes.

### 2. `src/pages/patient/PatientExams.tsx` (ajuste pontual)

- Nas cards de PDF arquivado (`DriveFileCard`), exibir também o nome do médico (mesmo `uploaded_by → profiles` lookup do item 1), pois hoje só mostra nome do arquivo e data.

### 3. Bug do "flash" ao finalizar consulta

Investigar a sequência em `src/pages/Attendance.tsx` (linhas 741–744 e 1223–1232):

```
setFinishedNavigatePending(true) → setShowSummary(true) → user fecha → navigate('/agenda')
```

Hipótese principal: ao fechar o `AttendanceSummaryModal`, o overlay do Radix Dialog desmonta com animação enquanto o `navigate('/agenda')` já dispara render da nova rota — o "papel/sheet que pisca" provavelmente é o overlay do Dialog (ou um `AppointmentDetailDialog` em `/agenda` reabrindo com `selectedAppointment` ainda em estado antigo do `localStorage`/URL).

Plano de correção:
- Adiar o `navigate('/agenda')` para depois da animação de close (`setTimeout(..., 250)`), garantindo unmount limpo do Dialog antes de trocar de rota.
- Em `src/pages/Agenda.tsx`, verificar se `AppointmentDetailDialog` é aberto automaticamente a partir de algum state persistido (URL param, query state ou último appointment selecionado) — se sim, garantir reset no `mount` quando vier do fluxo de finalização (ex.: usar `location.state.fromFinish` e ignorar abertura automática).
- Validar visualmente após a correção (preview) que nenhuma folha aparece momentaneamente.

## Arquivos a editar

- `src/pages/patient/PatientRecord.tsx` — classificação + médico nas abas.
- `src/pages/patient/PatientExams.tsx` — médico nas cards de PDF arquivado.
- `src/pages/Attendance.tsx` — adiar navigate após fechar modal.
- `src/pages/Agenda.tsx` (somente se confirmar reabertura automática de dialog após investigação).

## Não alterado

- Fluxo do médico (botão "Imprimir tudo" da aba Documentos continua intacto).
- `archiveAttendanceFiles.ts` e geração dos PDFs já existentes.
