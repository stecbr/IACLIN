## Causa do erro

O código de "Minhas configurações" do paciente (`PatientSettings.tsx`) tenta gravar `gender`, `rg` e `profession` na tabela `patient_accounts`, mas essas colunas não existem no banco. Por isso o PostgREST retorna `Could not find the 'gender' column of 'patient_accounts' in the schema cache` quando o paciente clica em Salvar (inclusive ao trocar a foto, porque o salvamento é um único upsert com todos os campos).

Hoje `patient_accounts` tem apenas: `id, user_id, cpf, full_name, phone, date_of_birth, insurance_provider, insurance_number, created_at, updated_at`.

## Correção

Migration única adicionando as colunas faltantes usadas pela tela:

```sql
ALTER TABLE public.patient_accounts
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS profession text;
```

Sem mudança de RLS (políticas existentes já cobrem todas as colunas da linha do próprio usuário) e sem mudanças no front — o `PatientAccount` em `usePatientData.ts` já declara esses campos.

## Fora de escopo

- Foto do paciente: `photo_url` é salvo em `patients` (não em `patient_accounts`), então não precisa de alteração.
- Outros campos do formulário (endereço, contato de emergência, etc.) já vão para `patients`, que possui as colunas.
