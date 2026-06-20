## Plano

1. **Trocar a conversão para PDF por uma estratégia mais confiável**
   - Substituir o uso atual do `html2pdf/html2canvas`, que está gerando PDF em branco, por uma geração via `print()` em iframe oculto usando o diálogo nativo de PDF do navegador.
   - Preservar o HTML completo (`html/head/body`, `@page`, CSS e layout A4), exatamente como o médico vê ao exportar/imprimir.

2. **Arquivar o “Resumo de Atendimento.pdf” no mesmo padrão visual do exportar/imprimir**
   - Manter o mesmo HTML gerado por `buildAttendanceHtml`/`generateAttendancePdf`.
   - Ao finalizar a consulta, salvar automaticamente esse PDF na pasta `Consulta dd/mm/aaaa às HH:mm` em `Pacientes > Arquivos`.
   - Garantir que o PDF salvo não fique em branco antes de inserir o registro em `documents`.

3. **Arquivar “Documentos Médicos.pdf” com o mesmo padrão visual dos documentos individuais**
   - Reusar os modelos existentes de receituário, solicitação de exames, encaminhamento e atestado.
   - Combinar em um único PDF com uma página por documento, mantendo o layout A4 e o estilo dos modelos impressos.
   - Salvar automaticamente junto ao resumo na mesma pasta da consulta.

4. **Corrigir visibilidade para o paciente**
   - Ajustar a busca da área do paciente para incluir os PDFs gerados da consulta quando for apropriado.
   - Fazer aparecer em:
     - `patients/Arquivos` dentro da pasta da consulta;
     - `/paciente/exames` nas abas correspondentes (exames, receitas, encaminhamentos, atestados);
     - `/paciente/prontuario` como documentos/solicitações vinculados ao atendimento.

5. **Evitar duplicidade e rascunho antigo**
   - Antes de salvar arquivos automáticos da mesma consulta, substituir/atualizar os PDFs automáticos já existentes em vez de criar múltiplas cópias.
   - Manter o rascunho dos documentos vinculado ao agendamento, para não pré-preencher outro atendimento indevidamente.

## Arquivos previstos

- `src/lib/htmlToPdfBlob.ts`
- `src/lib/archiveAttendanceFiles.ts`
- `src/components/attendance/DocumentsTab.tsx`
- `src/hooks/usePatientData.ts`
- `src/pages/patient/PatientExams.tsx`
- `src/pages/patient/PatientRecord.tsx`

## Resultado esperado

Ao finalizar uma consulta, a pasta da consulta terá PDFs reais, com o mesmo visual de exportar/imprimir, sem páginas em branco; e o paciente conseguirá ver os documentos nas telas de arquivos, exames e prontuário.