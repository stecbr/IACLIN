## Diagnóstico

Validei no banco:
- **Jesus** (secretário, clínica `200c1de3…`): `is_active=true`, `role='secretary'`, `permissions.aprovacoes=true`.
- **Lucas** (owner, mesma clínica): `role='admin'`, `permissions=NULL`.

Revisando `src/components/AppSidebar.tsx`:

1. `operationNav` (linha 105) define **"Aprovações"** com `allowedRoles: ['secretary', 'auxiliary']` — **admin não está listado**. Para o admin a entrada é "puxada" via `byUrl('/clinica/aprovacoes')` do `clinicNav` dentro do bloco `isAdmin && currentClinicId`. Se o admin estiver no **Modo Consulta** (`effectiveRole='dentist'`), ele cai no branch `else` e a regra de dentist não inclui `/clinica/aprovacoes` em lugar nenhum → desaparece.
2. Para o secretário, o filtro depende de `useStaffPermissions`. O hook só retorna permissões quando a query resolve; antes disso, `permissions=null` → fallback `STAFF_PERMISSION_DEFAULTS.secretary` (que tem `aprovacoes:true`). OK em teoria, mas o usuário relatou ausência mesmo após F5 — vamos blindar.
3. `useRoleAccess.canAccess('/clinica/aprovacoes')` exige `staffPerms[key] !== false`. Para Jesus, `aprovacoes=true`, então passa. OK.

Provavelmente o admin (Lucas) está em **Modo Consulta** quando abre, e o secretário (Jesus) sofre de uma condição de corrida onde, no primeiro render após login, `useStaffPermissions` ainda devolve `null` e o item some até a query completar — ou o filtro encadeado em `operationNav` exclui antes do staffPerms popular.

## Plano

1. **`src/components/AppSidebar.tsx`**
   - Em `operationNav`, mudar `allowedRoles` de Aprovações para `['admin', 'secretary', 'auxiliary']` para que admin também veja a entrada na seção "Atendimento do Dia" em **ambos** os branches (admin e else).
   - No filtro de `filteredOperationNav` para Aprovações, trocar a regra de
     ```
     !isStaff || (staffPerms?.aprovacoes !== false)
     ```
     para uma versão que **só esconde quando explicitamente `false`** mesmo se `staffPerms` ainda for `null` (evita "sumir" durante o load):
     ```
     !(isStaff && staffPerms && staffPerms.aprovacoes === false)
     ```
     Mesma blindagem para `agenda`, `salaEspera`.
   - No branch admin, manter `attendanceExtra` apenas com `/pacientes-do-dia` (Aprovações virá pelo próprio `filteredOperationNav` agora) e **dedupe** caso já apareça.

2. **`src/hooks/useStaffPermissions.ts`**
   - Enquanto a query inicial não resolve, retornar diretamente o fallback (não `null`) para staff, garantindo que a sidebar nunca veja `permissions=null` para um secretário com `clinicRole='secretary'`. Já é o comportamento de fallback no return, então confirmar e adicionar `placeholderData` igual ao fallback no `useQuery` para forçar entrega imediata.

3. **`src/hooks/useRoleAccess.ts`**
   - Em `canAccess`, garantir que `staffPerms[key] === false` é a única condição de bloqueio (já é); adicionar fallback para nunca bloquear `/clinica/aprovacoes` quando `staffPerms` ainda não chegou.

4. **Validação com Playwright (após implementar)**
   - Login como Jesus (`jesuss@gmail.com`) → confirmar via screenshot que "Aprovações" aparece em "Atendimento do Dia" e que `/clinica/aprovacoes` carrega.
   - Login como Lucas (`lucasferreiraceara@gmail.com`) em manager e consult mode → confirmar que aparece nos dois modos.
   - Capturar console para garantir que não há erro de RLS ao buscar `appointment_requests`.

Detalhes técnicos:
- A migração para `operationNav` permite o admin ver Aprovações mesmo em consult mode sem precisar reorganizar todo o branch.
- O fix do `placeholderData` evita o "flash" sem o item.
- A senha de Jesus/Lucas não é necessária — vou usar a sessão Supabase injetada do owner para validar o admin; para Jesus, sinalizo no relatório que precisa de F5 dele para confirmar.