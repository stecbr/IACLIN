## Problema

Os PDFs arquivados ao finalizar a consulta usam `category = 'doctor_file:<folderId>'` para aparecerem na pasta da consulta em `patients/Arquivos`. Em `/paciente/exames`, o classificador olha só `category` e não reconhece esse valor, então tudo cai em **Outros**. Além disso, hoje os documentos médicos vão num único `Documentos Médicos.pdf` combinado — não dá pra separar por tipo.

## Plano (sem alterar o fluxo do médico/dentista)

1. **Manter o botão "Imprimir/Exportar" da aba Documentos exatamente como está**
   - Continua gerando UM único `Documentos Médicos.pdf` combinado (exames + receita + encaminhamento + atestado), num clique só, como o médico prefere.
   - `DocumentsTab.tsx` **não muda**.

2. **No arquivamento automático ao finalizar a consulta, salvar também versões separadas por tipo (apenas para o paciente ver classificado)**
   - Em `src/lib/archiveAttendanceFiles.ts`, além do `Documentos Médicos.pdf` combinado já existente, gerar e arquivar na mesma pasta da consulta um PDF por tipo, quando o rascunho tiver conteúdo:
     - `Solicitação de Exames.pdf`
     - `Receituário.pdf`
     - `Encaminhamento — <Especialidade>.pdf`
     - `Atestado.pdf`
   - Reusa os HTMLs individuais (`buildExamRequestHtml`, `buildPrescriptionHtml`, `buildReferralHtml`, `buildCertificateHtml`) — mesmo visual de exportar/imprimir.
   - Continuam com `category = 'doctor_file:<folderId>'` (pasta da consulta preservada no `patients/Arquivos`).

3. **Classificar por nome do arquivo em `/paciente/exames`**
   - Em `src/pages/patient/PatientExams.tsx`, quando `category` começar com `doctor_file:`, decidir a aba pelo prefixo do nome:
     - "Solicitação de Exames" → **Exames**
     - "Receituário" → **Receitas**
     - "Encaminhamento" → **Encaminhamentos**
     - "Atestado" → **Atestados**
     - "Resumo de Atendimento" / "Documentos Médicos" → **Outros**
   - Sem mudanças no `PatientRecord.tsx` (já mostra tudo na aba Documentos).

4. **Evitar duplicidade**
   - `uploadPdfToFolder` já apaga arquivo com mesmo nome da mesma consulta antes de subir — então re-finalizar não duplica.

## Arquivos a editar

- `src/lib/archiveAttendanceFiles.ts` — adicionar geração dos PDFs separados por tipo (somar ao combinado, sem remover).
- `src/pages/patient/PatientExams.tsx` — classificação por nome para `doctor_file:*`.

## Não alterado

- `src/components/attendance/DocumentsTab.tsx` (botão Imprimir do médico segue igual).
- Geração do `Documentos Médicos.pdf` combinado segue existindo.

## Resultado

Médico continua imprimindo tudo num clique. Paciente passa a ver cada documento na aba correta de `/paciente/exames`, e a pasta da consulta em `patients/Arquivos` mostra tanto o combinado quanto os individuais.
