## Causa

A página de marketplace e a landing são acessadas sem login. A tabela `profiles` tem RLS apenas para `authenticated`, então `full_name` e `avatar_url` voltam vazios para o visitante anônimo → o card cai no fallback "Profissional" com avatar "P".

## Mudanças

### 1. Backend (já aplicado via migration)
Função `public.get_marketplace_doctor_profiles(uuid[])` SECURITY DEFINER que devolve apenas `id`, `full_name`, `avatar_url` dos usuários que são `dentist`/`admin`. Não expõe telefone. EXECUTE liberado para `anon` e `authenticated`.

### 2. `src/pages/Marketplace.tsx` e `src/components/landing/MarketplaceSection.tsx`
Trocar
```
supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds)
```
por
```
supabase.rpc("get_marketplace_doctor_profiles", { _user_ids: userIds })
```
E trocar fallback `?? "Profissional"` por `?? ""`.

### 3. `src/components/marketplace/DoctorCard.tsx`
Reorganizar o cabeçalho:
- **Nome real** como título (h3). Se vazio, mostrar "Sem nome".
- Logo abaixo, em destaque: **badge da especialidade** (cores `primary`) + **nome da clínica** em peso médio.
- Cidade/estado/telefone descem para info secundária menor.
- Avatar continua usando `avatarUrl` (agora populado).

### Arquivos
- `src/pages/Marketplace.tsx`
- `src/components/landing/MarketplaceSection.tsx`
- `src/components/marketplace/DoctorCard.tsx`
