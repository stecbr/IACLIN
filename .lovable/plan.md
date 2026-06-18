## Problemas identificados

### Bug 1 — RG / Profissão (e outros) somem após o cadastro de paciente
A tela `/auth` envia `rg`, `profession`, `date_of_birth` e `gender` em `raw_user_meta_data`, mas o trigger `handle_new_user` (banco) **só** persiste `cpf, full_name, phone, insurance_provider, insurance_number` na tabela `patient_accounts`. Os demais campos são descartados no momento do cadastro — por isso, ao abrir Configurações, o RG (e gênero/data de nascimento, se preenchidos no signup) aparecem em branco.

### Bug 2 — Endereço/observações/contato de emergência não persistem
Em `PatientSettings.tsx → save()`:
- `patient_accounts` só recebe um subconjunto pequeno (nome, telefone, nascimento, gênero, rg, profissão, convênio).
- `profiles` recebe apenas `address, city, state, zip_code`.
- Todo o resto (`address_complement`, `neighborhood`, `landline`, `notes`, `sms_reminders`, `emergency_contact_*`, `guardian_*`, `insurance_holder*`, `is_foreign`, `photo_url`) só é gravado em `patients` — **e somente quando já existe linha vinculada (`patientIds.length > 0`)**.
- Um paciente recém-cadastrado ainda não está vinculado a nenhuma clínica → `patientIds` está vazio → toast diz "salvou", mas nada além de nome/telefone realmente foi para o banco. Ao recarregar, tudo volta em branco.

## Correções

### 1. Migration — expandir `patient_accounts` e corrigir o trigger
Tornar `patient_accounts` o registro canônico dos dados pessoais do paciente (independente de vínculo com clínica):

- Adicionar colunas à `patient_accounts`:
  `landline, notes, photo_url, sms_reminders (bool default true), is_foreign (bool default false), zip_code, address, address_number, address_complement, neighborhood, city, state, emergency_contact_name, emergency_contact_phone, guardian_name, guardian_cpf, guardian_date_of_birth, insurance_holder, insurance_holder_cpf`.
- Atualizar `handle_new_user`: ao criar `patient_accounts`, gravar também `date_of_birth`, `gender`, `rg`, `profession` vindos do `raw_user_meta_data`.
- Manter os GRANTs/políticas existentes (a tabela já tem 3 policies — nada novo a abrir).

### 2. `src/pages/patient/PatientSettings.tsx → save()`
- Estender `accPatch` para incluir todos os novos campos acima.
- Continuar atualizando `profiles` (avatar/endereço básico, para o restante do app que lê de `profiles`).
- Continuar propagando para `patients` quando `patientIds.length > 0` (mantém os prontuários das clínicas sincronizados).
- Resultado: mesmo sem nenhuma clínica vinculada, todos os dados persistem em `patient_accounts` e voltam corretamente ao recarregar.

### 3. `src/hooks/usePatientData.ts` (e tipo `PatientAccount`)
- Adicionar os novos campos ao tipo `PatientAccount` para que o `useEffect` de hidratação em `PatientSettings` leia de `account` (não só do `patientRecord`).
- Ajustar o `useEffect` para preferir `account.*` nos campos recém-adicionados.

## Fora do escopo (não vou mexer)
- Identidade visual da Aparência, paletas, IA Gestor, etc. — fica como está.
- Não vou criar/alterar lógica de vínculo clínica↔paciente.

## Resumo técnico
Arquivos alterados:
- `supabase/migrations/<nova>.sql` — `ALTER TABLE patient_accounts ADD COLUMN ...` + `CREATE OR REPLACE FUNCTION handle_new_user`.
- `src/pages/patient/PatientSettings.tsx` — `save()` grava tudo em `patient_accounts`.
- `src/hooks/usePatientData.ts` — tipo `PatientAccount` ampliado.

Posso seguir?