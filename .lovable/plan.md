## Problema

No checklist "Comece por aqui" do paciente:

1. **Endereço sempre aparece como pendente**, mesmo após o paciente preencher tudo em Configurações.
   - Causa: a query lê `patients.address / zip_code` filtrando por `patient_user_id`. Mas o `save()` em `PatientSettings.tsx` só atualiza a tabela `patients` quando o usuário já tem `patientIds.length > 0` (ou seja, já está vinculado a alguma clínica). Para um paciente "solto" (sem clínica vinculada), o endereço só é gravado em `profiles` e `patient_accounts`, então o checklist nunca detecta.
   - Os campos `profile.address / zip_code` (que são gravados sempre) e/ou `patient_accounts.address / zip_code` são as fontes confiáveis.

2. **"Vincule seu plano de saúde" deve ser opcional**, pois nem todo paciente tem plano — não deveria contar como pendente nem reduzir o percentual de progresso.

## Mudanças

Arquivo único: `src/components/GettingStartedChecklist.tsx`, bloco `persona === 'patient'`.

1. Trocar a fonte do endereço para ler também de `profiles` e `patient_accounts`:
   - Adicionar `address, zip_code` ao `select` do `profiles`.
   - Buscar `patient_accounts` (`address, zip_code, insurance_provider`) por `user_id`.
   - `hasAddress = !!((pr.address && pr.zip_code) || (acc.address && acc.zip_code) || (pa.address && pa.zip_code))`.
   - `hasInsurance` lido da mesma forma (account OR patients).

2. Marcar o item "plano de saúde" como opcional:
   - Adicionar campo `optional?: boolean` na interface `ChecklistItem`.
   - Marcar o item `insurance` do paciente com `optional: true` e exibir um chip discreto "Opcional" ao lado do label.
   - Excluir itens opcionais dos cálculos de `totalDone`, `items.length` usado no denominador, e `pct` — eles continuam visíveis na lista de pendentes, mas não bloqueiam o 100%.

Nenhuma mudança em schema, RLS ou outras telas.
