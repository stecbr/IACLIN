## Problema observado

Nos logs do Auth aparece:
```
POST /admin/users → 422 email_exists
"A user with this email address has already been registered"
```

Ou seja, **o e-mail que o dono digitou já existe no Auth** (pode ter sido criado numa tentativa anterior, ou é o próprio e-mail do dono / de outro paciente). Hoje a função `invite-member`:

1. Faz `adminClient.auth.admin.listUsers({ page: 1, perPage: 200 })` e procura o e-mail — se a base passar de 200 usuários, o duplicado **não é detectado** e o `createUser` falha com 422 sem mensagem clara no front.
2. Quando o `createUser` devolve erro, a mensagem real do Supabase (`"A user with this email address has already been registered"`) chega no toast, mas em inglês e sem orientar o dono ("use outro e-mail" / "esse e-mail já é de outro usuário do sistema").

## Plano

### 1. Detectar e-mail duplicado de forma confiável (`supabase/functions/invite-member/index.ts`)

- Trocar o `listUsers({ perPage: 200 })` por uma checagem paginada **ou** pela query direta no schema `auth.users` via service role:
  ```ts
  const { data: existing } = await adminClient
    .from('auth.users' as any)            // via service role
    .select('id, email')
    .eq('email', email)
    .maybeSingle();
  ```
  (alternativa: paginar `listUsers` até achar ou acabar).
- Se já existir, devolver 409 com mensagem PT-BR clara:
  > "Este e-mail já está cadastrado na plataforma. Use outro e-mail para o funcionário, ou peça que ele entre pela tela de login com a senha atual."
- Em qualquer outro erro do `createUser`, traduzir a mensagem (ex.: "Password should be at least 6 characters" → "A senha precisa ter ao menos 6 caracteres.").

### 2. Mostrar o erro de forma amigável no diálogo de adicionar (`TeamSection.tsx`)

- Hoje o toast mostra a mensagem técnica. Passar a exibir a mensagem traduzida vinda da função e, em caso de "e-mail já cadastrado", manter o diálogo aberto com o campo de e-mail destacado em vermelho para o dono corrigir.

### 3. Ampliar a tela de permissões por funcionário (`StaffPermissionsDialog.tsx`)

Hoje o diálogo tem 5 itens (Agenda, Pacientes, Financeiro, IA, Chamados). O usuário quer poder marcar/desmarcar tela por tela. Vou expandir para esta lista, mantendo o mesmo padrão visual (switch + ícone + descrição curta):

| Permissão                | Rotas controladas                              |
| ------------------------ | ---------------------------------------------- |
| Dashboard                | `/`                                            |
| Agenda                   | `/agenda`                                      |
| Sala de espera           | `/sala-de-espera`                              |
| Aprovações               | `/clinica/aprovacoes`                          |
| Pacientes                | `/patients`                                    |
| Convênios                | `/clinica/convenios`                           |
| Financeiro               | `/financial`                                   |
| IA Gestor                | `/ia-gestor`                                   |
| Secretária IA            | `/secretaria-ia` (só dono pode liberar)        |
| Chamados / Suporte       | `/chamados`                                    |
| Configurações da clínica | `/settings`                                    |

- `STAFF_PERMISSION_DEFAULTS` ganha defaults por papel:
  - **secretary**: tudo `true` exceto `secretariaIa` e `settings`.
  - **auxiliary**: só `dashboard`, `agenda`, `salaEspera`, `pacientes`, `chamados` por padrão.
- O diálogo abre clicando na **linha inteira do funcionário** na tabela (não apenas no ícone de escudo) — mais intuitivo, como o usuário pediu.

### 4. Aplicar as permissões no roteamento (`useRoleAccess.ts` + `useStaffPermissions.ts`)

Hoje `useRoleAccess` libera todas as rotas que o papel `secretary`/`auxiliary` tem. Quando o usuário é staff:

- `canAccess(path)` consulta primeiro `useStaffPermissions.permissions`.
- Se o switch da rota estiver `false`, devolve `false` → o item some do menu (via `filterNavItems`) e o acesso direto pela URL cai numa tela de "Acesso não liberado pelo administrador".
- Se o staff estiver suspenso (`is_active = false`), continua bloqueado pelo `SuspendedAccessScreen` já existente.

### 5. Esconder do menu lateral o que não foi liberado (`AppSidebar.tsx`)

Já usa `filterNavItems` — basta garantir que ele passe pelo novo `canAccess` que respeita permissões granulares.

## Arquivos alterados

- `supabase/functions/invite-member/index.ts` — detecção robusta de e-mail duplicado + mensagens PT-BR.
- `src/components/settings/StaffPermissionsDialog.tsx` — nova lista de permissões (11 itens) e defaults por papel.
- `src/components/settings/TeamSection.tsx` — linha do funcionário inteira abre o diálogo; toast de erro mais claro.
- `src/hooks/useStaffPermissions.ts` — expor o novo shape de permissões.
- `src/hooks/useRoleAccess.ts` — `canAccess` respeita o mapa permissão→rota para staff.
- `src/components/AppLayout.tsx` (ou novo `NoPermissionScreen.tsx`) — tela "Acesso não liberado" quando o staff abre uma URL desligada.

Sem mudanças no banco — a coluna `permissions JSONB` em `clinic_members` já existe e cabe o novo shape.
