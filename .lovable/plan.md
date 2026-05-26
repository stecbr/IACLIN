## Receituário no estilo Hapvida (download em PDF)

Hoje a tela **Meus Documentos → Receitas** mostra as receitas como cards informativos, mas o paciente não consegue baixar um receituário formal com nome do médico, CRM e todos os remédios da mesma consulta. A proposta é tornar cada card (e cada medicamento dentro dele) um botão que abre o PDF do receituário — o mesmo gerador já usado pelo médico (`generatePrescriptionPdf`).

### O que muda (apenas frontend)

**1. `src/pages/patient/PatientExams.tsx`**
- Ampliar a query `patient-rx-from-records` para também trazer:
  - `clinic_id` do `clinical_records`
  - dados do dentista (`registration_number`, `specialty`, `signature_url`) via `profiles`
  - dados da clínica (`name`, `cnpj`, `phone`, `address`, `city`, `state`, `logo_url`) via `clinics`
  - dados do paciente (`full_name`, `cpf`, `date_of_birth`) via `patients` (usando `patientIds` já disponíveis no hook)
- Anexar esses metadados a cada `PrescriptionFromRecord`.

**2. `PrescriptionCard` (mesmo arquivo)**
- Substituir o botão único "Compartilhar no WhatsApp" por um **bloco de ações**:
  - Botão primário **"Baixar receituário"** (ícone `Download`) — destaque visual no estilo do print enviado (botão azul/ícone de download no canto superior direito do card).
  - Botão secundário "Compartilhar no WhatsApp" (mantido).
- Tornar cada item da lista de medicamentos **clicável**: ao clicar em qualquer remédio da consulta, abre o mesmo PDF do receituário completo daquela consulta (mesma ação do botão principal). Adicionar `hover` sutil e cursor pointer para indicar.
- Cabeçalho do card passa a exibir explicitamente **"Dr(a). {nome} · {CRM/CRO} {número}"** quando disponível, igual ao padrão Hapvida.

**3. Mapeamento payload → `PrescriptionItem`**
- O payload salvo em `clinical_record_requests` usa campos `medication`, `concentration`, `dosage`, `duration`, `route`, `type`. O gerador espera `medication`, `dosage`, `frequency`, `duration`, `instructions`.
- Criar um helper local `mapToPrescriptionItem()` que:
  - concatena `medication + concentration` em `medication`
  - usa `dosage` como `frequency` (ex.: "1 cápsula a cada 8 horas")
  - mantém `duration`
  - move `route` (oral/tópico) para `instructions`
- Chamar `generatePrescriptionPdf({ items, patient, dentist, clinic })` com os dados já buscados.

### Fora do escopo
- Nenhuma mudança de banco, RLS ou edge function.
- Nenhuma mudança no fluxo do médico (`RequestsEditor.tsx`) — só consumo no lado do paciente.
- Documentos em `prescriptionDocs` (PDFs já salvos no storage) continuam funcionando como hoje (download direto).

### Resultado esperado
Igual ao app do Hapvida: o paciente abre **Meus Documentos → Receitas**, vê a consulta do dia com a lista de remédios, e ao clicar em qualquer medicamento (ou no botão de download) recebe um único receituário em PDF com todos os medicamentos prescritos naquela consulta, identificando o médico e seu CRM.
