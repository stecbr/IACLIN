## Problema

A página `/superadmin` chama três funções RPC (`admin_get_stats`, `admin_get_clinics`, `admin_get_doctors`) via `src/hooks/usePlatformAdminData.ts`, mas elas **não existem** no banco. Por isso aparece o erro `Could not find the function public.admin_get_doctors` e todos os contadores ficam em zero, mesmo havendo 41 membros de clínica cadastrados.

O painel já está corretamente protegido no frontend (sidebar, layout, rotas) e o e-mail `iaclin@gmail.com` é a única identidade autorizada.

## Solução

Criar uma migration única adicionando as três funções `SECURITY DEFINER` no schema `public`, todas com a mesma trava de segurança:

```sql
IF (auth.jwt() ->> 'email') <> 'iaclin@gmail.com' THEN
  RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
END IF;
```

Assim só o super admin executa, mesmo que o RLS seja contornado pelo `SECURITY DEFINER`.

### `admin_get_stats() returns jsonb`
Retorna agregados — nenhum dado pessoal:
- `total_clinics`  → `SELECT count(*) FROM clinics`
- `total_doctors`  → `SELECT count(DISTINCT user_id) FROM clinic_members WHERE role IN ('admin','dentist')`
- `total_patients` → `SELECT count(*) FROM user_roles WHERE role = 'patient'`

### `admin_get_clinics() returns setof jsonb`
Lista clínicas com dados **operacionais** (sem pacientes/prontuários):
`id, name, category, city, state, email, phone, created_at, member_count` (join com `clinic_members`).
Ordenado por `created_at desc`.

### `admin_get_doctors() returns setof jsonb`
Lista membros profissionais com:
`user_id, full_name` (de `profiles`), `specialty, registration_number, role, is_owner, clinic_id, clinic_name` (de `clinics`), `created_at`.
Filtrado por `role IN ('admin','dentist')`, ordenado por `created_at desc`.
**Não retorna** CPF, e-mail, telefone pessoal nem qualquer dado de paciente.

### Permissões
```sql
GRANT EXECUTE ON FUNCTION public.admin_get_stats()   TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_clinics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_doctors() TO authenticated;
```

A verificação de e-mail dentro de cada função impede que qualquer outro usuário autenticado obtenha dados.

## Arquivos
- **Novo:** `supabase/migrations/<timestamp>_superadmin_rpc.sql`

Nenhum arquivo de frontend precisa mudar — o hook `usePlatformAdminData.ts` já está pronto para consumir essas RPCs e mapear o resultado para as páginas Visão Geral, Clínicas e Médicos.

## Privacidade
Nenhuma das funções retorna nome de paciente, CPF, prontuário, valores financeiros ou conteúdo de consultas — apenas metadados de clínicas e profissionais, conforme a nota já exibida no painel.
