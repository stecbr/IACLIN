## Problema

A página `/superadmin/operadoras` (`SuperAdminOperators.tsx`) chama `supabase.rpc('admin_get_operators')`, mas essa função **não existe** no banco — apenas `admin_get_stats`, `admin_get_clinics` e `admin_get_doctors` foram criadas. Por isso a lista aparece vazia / com erro.

## Solução

Criar uma migration adicionando a função `admin_get_operators()` no schema `public`, seguindo o mesmo padrão `SECURITY DEFINER` das outras RPCs do super admin (trava por e-mail `iaclin@gmail.com`).

### `admin_get_operators() returns setof jsonb`

Retorna todas as operadoras de `insurance_operators` (sem filtrar por `is_active`, para o super admin enxergar inclusive as inativas), com os campos que a página já consome:

`id, name, legal_name, cnpj, ans_code, type, contact_email, contact_phone, responsible_name, logo_url, brand_color, is_active, created_at`

Ordenado por `created_at desc`.

Trava de acesso idêntica às outras:

```sql
IF (auth.jwt() ->> 'email') <> 'iaclin@gmail.com' THEN
  RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
END IF;
```

### Permissões
```sql
GRANT EXECUTE ON FUNCTION public.admin_get_operators() TO authenticated;
```

## Arquivos
- **Novo:** `supabase/migrations/<timestamp>_admin_get_operators.sql`

Nenhuma mudança de frontend — `SuperAdminOperators.tsx` já está pronto para consumir a RPC.

## Privacidade
Operadoras são entidades jurídicas (CNPJ, ANS, contato comercial) — não há dado pessoal de paciente envolvido.
