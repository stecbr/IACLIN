

# Plano: Corrigir cadastro travado e visão real do médico

Dois bugs separados, dois consertos.

## Bug 1 — "Database error saving new user"

**Causa**: a migração mais recente que criou `assign_default_role` (para dar `dentist` a quem entra via convite/código) **nunca foi anexada como trigger** em `auth.users`. Resultado:

- O trigger único que roda no signup ainda é o velho `handle_new_user`, que só sabe lidar com `user_type = 'cliente'` (paciente) e `'clinica'` (clínica). Para `'profissional'` e `'profissional_member'` ele não atribui papel nenhum.
- Além disso, `auto_link_clinic_owner` e `set_clinic_invite_code` existem como funções mas **não têm trigger** ligado em `clinics`. Então quando uma clínica nova é criada via signup, ninguém vira membro automaticamente e o `invite_code` não é gerado.
- Por fim, recadastros com o mesmo e-mail batem em PK violation no `INSERT INTO profiles`, o que o Supabase devolve como "Database error saving new user".

**Correção** — nova migração:

1. Adicionar `INSERT ... ON CONFLICT (id) DO NOTHING` em `handle_new_user` na inserção de `profiles` (idempotente).
2. Adicionar branch `profissional_member` dentro de `handle_new_user` (atribui papel `dentist` direto, sem criar clínica). Isso unifica a lógica num único trigger e mata o `assign_default_role` órfão.
3. Adicionar branch `profissional` (sem invite/código): atribuir papel `admin` (médico autônomo, comportamento atual).
4. **Anexar** `auto_link_clinic_owner` como trigger `AFTER INSERT ON public.clinics`.
5. **Anexar** `set_clinic_invite_code` já está anexado pela migração de invites — ok, manter.
6. Backfill: rodar `auto_link_clinic_owner`-equivalente para clínicas existentes que não têm membership do owner (já constatado: 9 clínicas têm `owner` mas todas já têm membership; o backfill é defensivo).
7. Remover a função `assign_default_role` (dead code).

Também adicionar policy de **INSERT** em `user_roles` (hoje só tem SELECT) para o caso do trigger, embora `SECURITY DEFINER` ignore RLS — é cintos-e-suspensórios.

## Bug 2 — Sidebar do médico ainda mostra itens de admin

**Causa real (verificada no banco)**: o usuário do print (`lucasferreiraceara@gmail.com`) tem **`clinic_role = admin` e `is_owner = true`** — ou seja, ele é o dono da clínica, não médico. O sidebar está correto **para esse usuário**. O print mostra a visão de admin porque a conta logada É admin.

A conta de teste de médico real é `felipesiqueira@gmail.com` (`clinic_role = dentist`). Mas ela também tem uma linha `admin` em `user_roles` (legado). O `useRoleAccess` já usa `clinicRole` (correto), então a visão dela já vem como dentist.

**Mesmo assim**, vou endurecer o front pra não depender de qual conta está logada:

1. **Remover roles legadas duplicadas**: na nova migração, dedupar `user_roles` para usuários que são `dentist` numa clínica e têm `admin` global espúrio (manter só `dentist` quando `clinic_members.role = 'dentist'`).
2. **`useRoleAccess`**: trocar o fallback `clinicRole ?? 'admin'` por `clinicRole ?? (isClinicOwner ? 'admin' : 'dentist')` — assim, se algum dia faltar `clinicRole`, a UI degrada pra dentist (mais restritivo) e não pra admin.
3. **`AppSidebar`**: hoje os itens `Financeiro`, `Secretária IA`, `Odontograma` etc. não têm `allowedRoles` no array e dependem 100% do `routePermissions` central. Vou anotar cada item com `allowedRoles` explícito (defesa em profundidade) — assim mesmo que a rota mude no futuro, o item da sidebar respeita.
4. Garantir que o bloco "Gestão da Clínica" (Visão Geral / Médicos / Faturamento) não apareça para `dentist` — hoje a guarda é `isClinicOwner && !isDentist`, mas se um médico for `is_owner` por engano (caso do `lucasferreira@gmail.com` que é admin+owner mas roda como `clinicRole='admin'`), o bloco aparece corretamente. Trocar a guarda para **`!isDentist && !isPatient` apenas**, sem depender de owner — isso libera para qualquer admin/secretary com permissão (já filtrado por `routePermissions`).

## Como verificar depois

1. Logar como `felipesiqueira@gmail.com` (médico) → sidebar deve mostrar apenas: Dashboard, Agenda, Disponibilidade, Pacientes, Odontograma, Orçamentos, Meu Perfil. Sem Financeiro, Secretária IA, Visão Geral, Médicos, Faturamento, Configurações.
2. Criar uma conta nova como Profissional → Dentista (sem código): deve completar sem "Database error saving new user", e cair como `admin` de uma conta solo.
3. Criar conta nova com código de clínica: deve completar e já entrar com `clinicRole = dentist` e ver a sidebar enxuta.

## Arquivos tocados

- `supabase/migrations/<nova>.sql` — corrige `handle_new_user`, anexa `auto_link_clinic_owner`, dropa `assign_default_role`, dedupa `user_roles`.
- `src/hooks/useRoleAccess.ts` — fallback mais seguro.
- `src/components/AppSidebar.tsx` — anotar `allowedRoles` por item, ajustar guarda do bloco "Gestão da Clínica".

## O que NÃO muda

- Edge functions de invite/código continuam iguais.
- Tabelas e RLS de `clinic_members`/`clinic_invites` continuam iguais.
- Visão de admin e secretária permanece intacta.

