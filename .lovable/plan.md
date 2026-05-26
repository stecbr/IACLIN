## Objetivo

1. Remover a nomenclatura "VIP" (médicos não usam).
2. Tornar o preenchimento de receita pelo médico muito mais rápido e intuitivo dentro do atendimento.
3. Separar visualmente "Exames" e "Receitas" para o paciente, sem criar nova rota.

---

## 1. Remover "VIP"

**Arquivo:** `src/components/patients/PatientPersonalizeMenu.tsx` (linha 84)

- Trocar `placeholder="Ex: VIP, Retorno"` por `placeholder="Ex: Retorno, Acompanhamento"`.
- Verificar mais ocorrências no projeto (somente essa foi encontrada).

---

## 2. Receita do médico — Modelos rápidos + autocomplete no atendimento

**Arquivo principal:** `src/components/attendance/RequestsEditor.tsx` (seção "Prescrições / Receita")

Hoje o médico vê 4 inputs soltos (medicação, concentração, posologia, duração, via, tipo) por item — sem modelos, sem sugestões, sem agrupamento visual.

**Melhorias na seção `prescription`:**

- **Barra de modelos rápidos** acima da lista: chips clicáveis ("Pós-extração", "Profilaxia antibiótica", "Pulpite aguda", "Pós-implante") reaproveitando `DEFAULT_PRESCRIPTION_TEMPLATES` de `src/lib/prescriptionTemplates.ts`. Clicar adiciona todos os itens do modelo de uma vez.
- **Autocomplete de medicamento**: input com sugestões (combobox shadcn) a partir de uma lista curada de medicamentos comuns (criar `src/lib/medicationSuggestions.ts` com ~40 itens com concentração padrão: Dipirona 500mg, Ibuprofeno 600mg, Amoxicilina 500mg, Nimesulida 100mg, Paracetamol 750mg, Clorexidina 0,12%, etc.). Ao selecionar, preenche `medication` + `concentration` automaticamente.
- **Botão "Duplicar"** ao lado do "Remover" em cada item.
- **Labels mais claros e agrupamento visual**: cada receita vira um "card" numerado, com linha 1 (medicamento + concentração), linha 2 (posologia + duração), linha 3 (via + tipo). Hoje já está em grid mas sem hierarquia.
- **Preview rápido**: pequeno texto cinza sob o item resumindo "Dipirona 500mg — 1 cp 8/8h por 3 dias, via oral", para o médico bater o olho e validar.

Sem alterar tipo `RequestItem`/payload — só UX no editor.

---

## 3. Paciente — Abas "Exames | Receitas | Documentos" em "Meus Exames"

**Arquivo:** `src/pages/patient/PatientExams.tsx`

- Renomear título da página para "Meus Documentos" (mantém rota `/paciente/exames`).
- Adicionar `<Tabs>` com 3 abas: **Exames**, **Receitas**, **Outros documentos**.
- **Aba Exames**: documentos com `category` em `['image','exam','lab_exam','imaging_exam']`.
- **Aba Receitas**: documentos com `category = 'prescription'` **+** entradas extraídas de `clinical_records.requests` onde `kind = 'prescription'` (mesma lógica usada em `PatientTimelineMulti.tsx:77`). Card de receita mostra: medicamento(s) + posologia, nome do médico, data, badge "Receita", botão **Baixar PDF** (quando houver `file_url`) e botão **Compartilhar no WhatsApp** (gera texto com a lista de medicamentos via `whatsappLink` de `clinicalDocsHelpers`).
- **Aba Outros documentos**: o restante.
- Empty states por aba.

**Hook:** estender `usePatientData` (ou query local na página) para também trazer `clinical_records` do paciente com `requests` contendo prescriptions, juntando com `documents` ao montar a aba Receitas.

---

## Detalhes técnicos

- Combobox: usar `Command` + `Popover` do shadcn (já em uso no projeto).
- Nada de migrations — toda a lógica é frontend, lendo tabelas existentes (`documents`, `clinical_records`).
- Modais/dialogs: nenhum novo (todos os modais existentes continuam com fade-in/out conforme regra Core).
- Mobile: as abas usam `Tabs` shadcn responsivo; cards de receita empilham em 1 coluna.

---

## Arquivos tocados

- `src/components/patients/PatientPersonalizeMenu.tsx` — placeholder
- `src/components/attendance/RequestsEditor.tsx` — modelos + autocomplete + duplicar + preview
- `src/lib/medicationSuggestions.ts` — **novo** (lista de medicamentos)
- `src/pages/patient/PatientExams.tsx` — abas + visualização de receitas
- (opcional) `src/hooks/usePatientData.ts` — incluir `requests` das clinical_records se ainda não trouxer

Fora de escopo: nova rota, novo modal de receita, mudanças no PDF/PrescriptionPad existente, mudanças no backend.
