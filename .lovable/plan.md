## Três problemas, três correções

### 1. PDF "Resumo de Atendimento" sai em branco

**Causa:** `htmlToPdfBlob` injeta um documento completo (`<!DOCTYPE><html><head><body>`) dentro de um `<div>` via `innerHTML`. O navegador descarta as tags `html/head/body`, então as regras CSS `body { padding: 40px; ... }` e o background nunca se aplicam — html2canvas captura uma área praticamente vazia.

**Fix em `src/lib/htmlToPdfBlob.ts`:** renderizar o HTML dentro de um `<iframe>` oculto (com `srcdoc`), esperar o load, e passar `iframe.contentDocument.body` para o html2pdf. Assim o documento inteiro (estilos, body, layout) é interpretado corretamente. Limpar o iframe ao final.

### 2. Pasta "Consulta …" e "Resumo de Atendimento.pdf" aparecem para o PACIENTE (em "Outros")

**Causa:** `archiveAttendanceFiles` insere os documentos do médico em `documents` com o `patient_id` correto. O `usePatientData` carrega todos os documentos por `patient_id` sem filtrar a categoria, então os arquivos privados do médico vazam para a aba "Meus Exames" do paciente.

**Fix em `src/hooks/usePatientData.ts`:** ao buscar `documents`, excluir as categorias internas do médico (`doctor_folder` e qualquer `doctor_file:%`) com `.not('category','eq','doctor_folder').not('category','ilike','doctor_file:%')`. Esses arquivos continuam visíveis na aba Arquivos do prontuário (PatientFiles), só não vazam para o paciente.

### 3. Receitas / Exames / Encaminhamentos / Atestados não aparecem na conta do paciente

**Causa:** as políticas RLS de `clinical_records` e `clinical_record_requests` só permitem SELECT para **membros da clínica**. A conta do paciente (`patient_accounts.user_id`) não é membro, então `PatientExams.tsx` recebe array vazio nessas queries.

**Fix via migration:** adicionar policies de SELECT que permitam o paciente-conta ler os próprios registros:

- `clinical_records`: SELECT autorizado quando `EXISTS (SELECT 1 FROM patients p WHERE p.id = clinical_records.patient_id AND p.patient_user_id = auth.uid())`.
- `clinical_record_requests`: SELECT autorizado quando o `clinical_record_id` referido pertence a um `clinical_records` com o mesmo vínculo acima.

Sem alterar as policies existentes de INSERT/UPDATE/DELETE — o paciente só lê.

## Fora do escopo

- Não mexer no fluxo de finalização, no `AttendanceSummaryModal`, nem nos PDFs avulsos (continuam usando `window.print`).
- Não regenerar PDFs antigos.
- Não alterar `PatientFiles.tsx` (a pasta do médico continua aparecendo lá, para o médico).

## Resumo técnico

| Arquivo | Mudança |
|---|---|
| `src/lib/htmlToPdfBlob.ts` | renderizar em iframe oculto via `srcdoc` e gerar PDF a partir do `body` do iframe |
| `src/hooks/usePatientData.ts` | filtrar `doctor_folder` e `doctor_file:%` do select de `documents` |
| nova migration | policies de SELECT em `clinical_records` e `clinical_record_requests` para `patient_user_id = auth.uid()` |
