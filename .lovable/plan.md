## Problema 1 — Secretária não consegue logar

A função `invite-member` cria o usuário com `email_confirm: true` via Admin API, então a conta deveria existir. As causas mais prováveis do "não existe":

1. **Senha fraca** (Supabase devolve erro como "Invalid login credentials" ou similar quando há validação HIBP / mínimo de caracteres). O formulário pede `min 6` mas não valida no servidor antes de chamar `createUser`.
2. O `createUser` falhou silenciosamente para o usuário (mensagem ficou só no toast técnico) e a Maria nunca foi realmente criada no Auth — só apareceu na listagem porque o `profiles` foi gravado em outra tentativa anterior. Hoje o front mostra "adicionado com sucesso" mesmo quando há condição de corrida.
3. O e-mail digitado tem espaço/maiúsculas — `signInWithPassword` é case-sensitive em alguns providers de Auth, e não fazemos `email.trim().toLowerCase()` nem na criação nem no login.

### Correções

**Backend (`supabase/functions/invite-member/index.ts`):**
- Normalizar `email = email.trim().toLowerCase()`.
- Antes de criar, checar com `adminClient.auth.admin.listUsers` se já existe um usuário com esse e-mail → devolver erro claro "E-mail já cadastrado".
- Validar `password.length >= 6` no servidor.
- Em caso de falha no `createUser`, devolver a mensagem real do Supabase (ex.: "Password should be at least 6 characters", "User already registered").

**Frontend (`Auth.tsx`):**
- No `handleSubmit` do login, fazer `email.trim().toLowerCase()` antes de `signInWithPassword`.
- Traduzir "Invalid login credentials" para uma mensagem mais clara em PT-BR ("E-mail ou senha incorretos").

**Frontend (`TeamSection.tsx` dialog de adicionar):**
- Após adicionar com sucesso, mostrar um toast informativo: "Peça que **{nome}** acesse /auth e use o e-mail e a senha que você definiu".

## Problema 2 — Toggle de acesso (ativar/desativar membro)

Hoje só existe o botão de **Permissões** (ícone escudo) e **Remover** (lixeira). O usuário quer um **switch rápido** na linha para bloquear/liberar o acesso da Maria sem precisar remover.

### Implementação

**Migration:**
```sql
ALTER TABLE public.clinic_members
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
```

**Backend:**
- `useRoleAccess` / `AuthContext` passam a considerar `is_active = false` como "sem acesso à clínica" (redireciona para tela de "Seu acesso foi suspenso pelo administrador").
- `useStaffPermissions` retorna todas as permissões como `false` quando `is_active = false`.

**UI (`TeamSection.tsx`):**
- Nova coluna **"Ativo"** na tabela, com um `<Switch>` ao lado do nome (visível apenas para o dono, e nunca para si mesmo).
- Ao alternar: `update clinic_members set is_active = ? where id = ?` + toast "Acesso liberado/suspenso".
- Linha do membro inativo fica com `opacity-60` e badge cinza "Suspenso".

**Bloqueio em tempo de login:**
- Em `AuthContext`, ao carregar `currentClinicId`, se o `clinic_members` do usuário estiver `is_active = false`, mostrar tela bloqueando navegação com mensagem "Seu acesso a esta clínica foi suspenso. Fale com o administrador." e botão de Sair.

## Arquivos alterados

- `supabase/migrations/<novo>.sql` (adiciona `is_active`)
- `supabase/functions/invite-member/index.ts` (normalização + validação + checagem de duplicado)
- `src/pages/Auth.tsx` (normalização e-mail + mensagem PT-BR)
- `src/components/settings/TeamSection.tsx` (coluna Ativo com Switch)
- `src/contexts/AuthContext.tsx` (carregar `is_active` do membro corrente)
- `src/hooks/useRoleAccess.ts` e `src/hooks/useStaffPermissions.ts` (respeitar `is_active`)
- `src/components/AppLayout.tsx` ou novo `src/components/SuspendedAccessScreen.tsx` (tela de bloqueio)
