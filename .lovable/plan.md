… # Plano: Caixa de Ferramentas — Ondas 2 e 3

Continuação do que já foi entregue na Onda 1 (Anestésico, Timer, Retorno). Agora finalizamos as 6 ferramentas restantes + o overlay flutuante dentro do atendimento.

## 🗄️ Migração de banco (única, pequena)

Uma migração só, agrupando tudo:

1. **Nova tabela `prescription_templates`**
   - `id uuid PK`, `clinic_id uuid not null`, `dentist_id uuid` (nullable — null = template da clínica, preenchido = template pessoal)
   - `name text not null`, `category text` (ex: "pos_extracao", "antibiotico", "analgesico")
   - `content jsonb not null` — array de itens `{ medication, dosage, frequency, duration, instructions }`
   - `is_default boolean default false` — marca os templates pré-instalados
   - `created_at`, `updated_at`
   - **RLS**: `user_belongs_to_clinic` para SELECT/INSERT/UPDATE, admin para DELETE
   - Trigger `update_updated_at_column`

2. **`profiles`**: adicionar `signature_url text` (nullable) — URL da assinatura digital escaneada no bucket `clinic-assets`.

3. **`clinical_records`**: adicionar `procedure_duration_seconds integer` (nullable) — preenchido pelo Timer ao parar.

4. **Seed opcional** (pode ficar para depois): inserir 4 templates default (`is_default=true`, `dentist_id=null`) para cada clínica via função, ou simplesmente entregar como **constantes em `src/lib/prescriptionTemplates.ts`** que aparecem mesmo quando a tabela está vazia. Vou pelo segundo caminho — mais simples e funciona offline.

## 📦 Onda 2 — Documentos clínicos

### 2.1 `src/lib/prescriptionTemplates.ts`
Constantes com os 4 modelos prontos:
- **Pós-extração**: Dipirona 500mg + Ibuprofeno 600mg (3 dias)
- **Profilaxia antibiótica** (endocardite): Amoxicilina 2g 1h antes
- **Pulpite aguda SOS**: Nimesulida 100mg + Dipirona 1g
- **Pós-cirúrgico de implante**: Amoxicilina 500mg 7 dias + Dipirona + Bochecho clorexidina 0,12%

Cada item já com posologia, frequência, duração e instruções padrão. Usuário pode editar antes de gerar.

### 2.2 `src/lib/generatePrescriptionPdf.ts` e `src/lib/generateCertificatePdf.ts`
Reaproveitar a estrutura de `generateBudgetPdf.ts` (jsPDF + cabeçalho da clínica). Diferenças:
- **Receita**: cabeçalho "RECEITUÁRIO" + dados do paciente + lista numerada de medicamentos + "Uso oral/tópico" + bloco de assinatura com `signature_url` (se existir) + nome/CRO do dentista + data/local.
- **Atestado**: cabeçalho "ATESTADO" + texto livre baseado no template + CID-10 opcional + assinatura.

Retornam `Blob` para upload no `patient-files` e download direto.

### 2.3 `PrescriptionPad.tsx`
Fluxo:
1. Seleciona template (cards) ou começa em branco
2. Autocomplete de paciente (`patients` via `clinic_id`)
3. Editor de itens (medicamento, posologia, frequência, duração, instruções) — adiciona/remove linhas
4. Preview do PDF embutido
5. Ações: **Salvar como meu template** (grava em `prescription_templates` com `dentist_id = auth.uid()`), **Gerar PDF** (faz upload em `patient-files/<patient_id>/prescriptions/`, registra em `documents` com `category='prescription'`), **Enviar WhatsApp** (abre `wa.me/<phone>?text=Sua receita: <signed-url>`)

### 2.4 `CertificateGenerator.tsx`
Mais simples que receituário. Dois modos:
- **Comparecimento**: "esteve em atendimento odontológico de [hh:mm] às [hh:mm] em [data]" — preenche automático puxando do último `appointment` do paciente no dia
- **Afastamento**: "necessita afastamento por [X] dias a partir de [data]" + dropdown CID-10 opcional (lista curta odonto: K02, K04, K05, K07, K08, K12, S02.5)

Mesmas ações: salvar em `documents` (`category='medical_certificate'`) + WhatsApp.

### 2.5 `ClinicalCamera.tsx`
- `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`
- Preview ao vivo + botão grande de captura
- Após capturar: campos de tag (região/dente, observação curta)
- Upload em `patient-files/<patient_id>/clinical_photos/<timestamp>.jpg`
- Registra em `documents` com `category='clinical_photo'` e metadata no nome
- Galeria de fotos anteriores do paciente embaixo, com toggle "comparar antes/depois" (lado a lado)
- Fallback para input `<input type="file" accept="image/*" capture="environment">` em navegadores sem getUserMedia

## 🛠️ Onda 3 — Recursos avançados + Overlay

### 3.1 `VoiceDictation.tsx`
- Botão grande microfone (estado: idle/listening/processing)
- `window.SpeechRecognition || window.webkitSpeechRecognition`, `lang='pt-BR'`, `continuous=true`, `interimResults=true`
- Transcrição em tempo real numa `<textarea>` editável
- 2 destinos:
  - **Copiar para clipboard** (sempre disponível)
  - **Anexar ao prontuário em andamento** — só ativa se houver `clinical_record` com `status='in_progress'` do dentista logado (busca via query). Acrescenta no campo `notes`.
- Aviso amigável se navegador não suportar (Safari iOS antigo)

### 3.2 `ToothAtlas.tsx` (Odonto only)
- Reutiliza componente `ToothMap.tsx` existente em modo "atlas" (sem persistência)
- Click num dente → drawer lateral com:
  - Notação FDI/Universal
  - Tipo (incisivo/canino/pré-molar/molar)
  - Nº médio de raízes e canais
  - Procedimentos comuns (lista curta)
  - "Mostrar para o paciente" — modo fullscreen com texto grande
- Dados estáticos em `src/lib/toothAtlasData.ts`
- Aparece no `ToolsHome` apenas se `clinic.category === 'odonto'`

### 3.3 `QuickReference.tsx`
4 abas internas:
- **Conversor**: mL ↔ tubetes (1 tubete = 1.8mL)
- **Anticoagulantes**: tabela tempo de hemostasia (Varfarina, Rivaroxabana, Apixabana, AAS, Clopidogrel)
- **ASA**: classificação I-VI com descrição
- **EVA**: escala visual 0-10 colorida, modo "mostrar ao paciente" fullscreen

Tudo estático em `src/lib/clinicalReferenceData.ts`. Zero dependência externa.

### 3.4 `ToolsOverlay.tsx` — botão flutuante no atendimento
**O ganho de UX mais importante.**

- Componente posicionado `fixed bottom-20 right-4 z-40` em `Attendance.tsx`
- FAB redondo com ícone `Wrench`/`Briefcase`
- Ao clicar: expande em **leque/grid** com 4 atalhos: Anestésico, Timer, Ditado, Receituário
- Cada atalho abre o componente correspondente em `Sheet` lateral (mobile-first), **sem sair da tela do prontuário**
- Contexto pré-carregado: paciente atual já selecionado nas ferramentas (passa `patientId` via prop)
- Anestésico já puxa peso/alergias da `anamneses` do paciente em atendimento
- Ditado já direciona para o `clinical_record` aberto

## 🧭 Integração no resto do app

### `ToolsHome.tsx` (atualização)
- Trocar os cards "em breve" pelos componentes prontos
- Manter o `Dialog` que já existe para abrir cada ferramenta
- Ocultar "Atlas de Dentes" se a categoria da clínica não for `odonto`

### `Attendance.tsx`
- Adicionar `<ToolsOverlay patientId={...} clinicalRecordId={...} />` no fim do JSX
- Quando o Timer é parado dentro do overlay, fazer `UPDATE clinical_records SET procedure_duration_seconds = X` no record atual

### `PatientDocuments.tsx` (já existe)
- Adicionar ícones diferenciados para as novas categorias: `prescription` 💊, `medical_certificate` 📋, `clinical_photo` 📸
- Filtro por categoria no topo

## 📁 Arquivos

**Novos:**
- `src/components/dentist/tools/PrescriptionPad.tsx`
- `src/components/dentist/tools/CertificateGenerator.tsx`
- `src/components/dentist/tools/ClinicalCamera.tsx`
- `src/components/dentist/tools/VoiceDictation.tsx`
- `src/components/dentist/tools/ToothAtlas.tsx`
- `src/components/dentist/tools/QuickReference.tsx`
- `src/components/dentist/tools/ToolsOverlay.tsx`
- `src/lib/prescriptionTemplates.ts`
- `src/lib/generatePrescriptionPdf.ts`
- `src/lib/generateCertificatePdf.ts`
- `src/lib/toothAtlasData.ts`
- `src/lib/clinicalReferenceData.ts`
- Migração SQL: `prescription_templates` + `profiles.signature_url` + `clinical_records.procedure_duration_seconds`

**Editados:**
- `src/pages/dentist/ToolsHome.tsx` — destrava os 6 cards restantes, esconde Atlas para não-odonto
- `src/pages/Attendance.tsx` — monta o `ToolsOverlay` + persiste duração do timer
- `src/pages/Profile.tsx` — campo de upload de assinatura digital (`signature_url`)
- `src/components/patients/PatientDocuments.tsx` — ícones e filtro por categoria

## ✋ Fora de escopo (continua adiado)

- IA sugerindo prescrição
- Atlas para outras especialidades
- Reconhecimento de voz com IA paga (Whisper) — fica só Web Speech nativo
- Assinatura digital com certificado ICP-Brasil

## ✅ Resultado

Com isso fechamos as 9 ferramentas + overlay. O dentista entra em atendimento, e tudo que ele precisa (calculadora, timer, microfone, receita, foto) está a 1 toque do prontuário aberto, com paciente já carregado.

---

**Tudo certo para iniciar tão logo você aprovar.** 