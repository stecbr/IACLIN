## Diagnóstico

Confirmei pelo código (`src/pages/Auth.tsx` linhas 213-232 e 256-286) e pelo banco de dados:

**No cadastro (`/auth`)**, o profissional **já informa** especialidade e CRM/CRO/CRP. Esses campos são enviados ao `supabase.auth.signUp` dentro de `options.data` (`raw_user_meta_data`) — ou seja, ficam guardados em `auth.users` desde o signup.

**O bug está na edge function `join-clinic-by-code`**: quando o profissional entra com o código da clínica, a função insere em `clinic_members` passando `specialty` e `registration_number` somente se o front enviar (e o front não envia). Ela **ignora** os metadados do `auth.users` que já foram preenchidos no signup. Resultado: `null` em ambos os campos.

Foi exatamente isso que aconteceu com o Marcio Batista, Dr. Freitas, Luan, Gabriela, Joel etc. Todos cadastraram com especialidade no signup, mas ao usar o código da clínica esses dados foram descartados.

## Solução (somente backend, sem alterar UI)

### 1. Corrigir `supabase/functions/join-clinic-by-code/index.ts`

Buscar `raw_user_meta_data` do usuário autenticado (via `admin.auth.admin.getUserById(user.id)`) e usar `specialty` / `registration_number` de lá como fallback quando o body não os envia. Lógica:

```
finalSpecialty = body.specialty || user.user_metadata.specialty
finalReg       = body.registration_number || user.user_metadata.registration_number
```

Assim, qualquer médico/dentista que já preencheu no cadastro entra na clínica com os dados corretos automaticamente, sem precisar mudar o front.

### 2. Backfill dos médicos já cadastrados

Atualizar via SQL os `clinic_members` existentes que têm `specialty` ou `registration_number` nulo, copiando os valores de `auth.users.raw_user_meta_data` do respectivo usuário. Isso corrige Marcio Batista, Dr. Freitas, Luan, Gabriela e qualquer outro afetado, sem precisar recadastrar.

### 3. Reverter a edição inline de Especialidade/CRM em `/clinica/medicos`

Hoje a página `ClinicaMedicos.tsx` permite o admin editar a Especialidade clicando no lápis (linhas 91-110 e 175-204 do arquivo). Conforme sua regra ("CRM/CRO são dados do cadastro do médico, não pode ser editado"), vou:

- **Remover** o ícone de lápis e o input inline da coluna **Especialidade**
- A coluna **CRM/CRO** já é só leitura — fica como está
- A função `syncOneDoctor` continua sendo chamada apenas em fluxos legítimos (não mais no edit manual)

Resultado: a tabela passa a ser estritamente informativa, refletindo fielmente o que o profissional cadastrou.

## Arquivos alterados

- `supabase/functions/join-clinic-by-code/index.ts` — fallback para metadados do `auth.users`
- `src/pages/clinica/ClinicaMedicos.tsx` — remover edição inline de especialidade
- Migração SQL — backfill dos `clinic_members` afetados a partir de `auth.users.raw_user_meta_data`

## Sem alterações em

- `src/pages/WaitingClinic.tsx` (você pediu para não tocar)
- `src/pages/Auth.tsx` (já coleta corretamente)
- `supabase/functions/accept-clinic-invite/index.ts` (já funciona com fallback do convite)
- Schema do banco

## Resultado esperado

- Próximos médicos que entrarem por código vão ter especialidade e CRM/CRO automaticamente preenchidos a partir do que digitaram no signup.
- Marcio Batista e os demais já cadastrados terão os dados restaurados pelo backfill.
- Admin não consegue mais editar especialidade/CRM pela tela — esses dados ficam imutáveis e fiéis ao cadastro do profissional.