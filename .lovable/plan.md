

# Plano: Signup do Profissional só com código de clínica

Médico (profissional) **não pode mais ser autônomo**. Sempre precisa de vínculo: ou via **código de clínica** ou via **link de convite**. Sem código/convite válido → não cria conta.

## O que muda no signup

Quando o usuário escolhe "Profissional" no passo 1, o passo 2 fica com este formulário único (sem toggle, sem campos de empresa):

1. **Nome completo**
2. **E-mail** + **Senha**
3. **Especialidade** (opcional)
4. **Registro/CRO** (opcional)
5. **Código da clínica** — *obrigatório*, formato `CLIN-XXXXXXXX`

Se chegou via `?invite=TOKEN`, o campo "Código" some, e os dados de e-mail/nome vêm pré-preenchidos pelo convite (lógica já existe).

## Fluxo passo a passo

1. Front valida o código com regex `^CLIN-[A-Z2-9]{8}$` antes de qualquer chamada.
2. Front chama um novo endpoint `validate-clinic-code` (edge function pública, sem auth) só pra verificar se o código existe **antes** de criar a conta. Se não existir, mostra erro inline e **não cria conta**.
3. Se válido, chama `supabase.auth.signUp` com `user_type: 'profissional_member'` + metadata (`specialty`, `registration_number`).
4. Trigger `handle_new_user` cria `profile` + role `dentist` (já está pronto na migração nova).
5. Após o signUp resolver com sucesso e a sessão estabelecida, front chama `join-clinic-by-code` para vincular o usuário como membro da clínica (já existe).
6. Se `join-clinic-by-code` falhar nesse ponto (caso raro, ex: clínica deletada entre validação e signup), mostra erro e oferece botão "tentar com outro código" — a conta já existe, mas o usuário fica num estado de "sem clínica" que cai numa nova tela `/aguardando-clinica`.

## Tela "/aguardando-clinica" (novo fallback)

Para o caso raro acima, e para qualquer profissional que entre no app sem `currentClinicId`:

- Tela única com input de código + botão "Vincular".
- Chama `join-clinic-by-code` com o código.
- Sucesso → redireciona pra `/`.
- Botão secundário "Sair" pra trocar de conta.

Substitui o redirect atual pra `/onboarding` quando o user é `dentist` sem clínica (admin continua indo pro onboarding normal porque pode criar a clínica dele — **mas no caso de profissional, ele nunca vira admin**, então isso não acontece).

## Edge function nova

**`supabase/functions/validate-clinic-code/index.ts`** (pública, sem JWT):

- Body: `{ code: string }`
- Faz `select id, name from clinics where invite_code = ?`
- Retorna `{ valid: true, clinic_name }` ou `{ valid: false, error }`
- Rate limit simples por IP (in-memory map, 10 tentativas/min) pra não virar oráculo de códigos.

Configurar `verify_jwt = false` no `supabase/config.toml` pra essa função.

## Mudanças no código

**`src/pages/Auth.tsx`**:
- No passo 1, manter as 3 opções (Cliente / Clínica / Profissional).
- No passo 2 quando `userType === 'profissional'`: form novo só com os 5 campos acima. Remover `legal_name`, `trade_name`, `cnpj`, `corporate_email`, `responsible_name`, `responsible_cpf`.
- Botão "Criar conta" desabilitado até `clinicCode` passar no regex.
- Onclick: chama `validate-clinic-code` → se ok, `supabase.auth.signUp({ user_type: 'profissional_member', specialty, registration_number })` → após sessão, `supabase.functions.invoke('join-clinic-by-code', { body: { code, specialty, registration_number } })`.
- Caso `?invite=TOKEN`: esconde input de código, dispara `accept-clinic-invite(token)` em vez de `join-clinic-by-code`.

**`src/App.tsx`**:
- Novo route `/aguardando-clinica` (componente `WaitingClinic`).
- Em `ProtectedRoute`: se user logado, não é patient, e `clinics.length === 0`, redirecionar pra `/aguardando-clinica` em vez de `/onboarding` quando o usuário **não tem role admin** (ou seja: profissional órfão). Admin sem clínica continua indo pro `/onboarding`.

**`src/pages/WaitingClinic.tsx`** (novo): tela simples descrita acima.

**`supabase/config.toml`**: adicionar bloco
```toml
[functions.validate-clinic-code]
verify_jwt = false
```

**Trigger `handle_new_user`**: já está correto — `profissional_member` vira `dentist`. Sem mudança.

**Branch `profissional` (sem código) no `handle_new_user`**: pode ficar como está (defensivo) ou ser removida. Vou deixar — não fará mal e protege contra signups antigos pendentes.

## O que sai da UI

- ❌ Toggle "Tenho código / Sou autônomo".
- ❌ Campos de empresa (CNPJ, razão social, responsável) no fluxo de Profissional.
- ❌ Redirect de profissional pra `/onboarding`.

## Validações e UX

- Erro de código inválido → toast vermelho + borda vermelha no input + texto "Código não encontrado. Peça à clínica para gerar um novo".
- Caps automático no input do código (já vai pra UPPERCASE no onChange).
- Máscara visual `CLIN-XXXXXXXX` com placeholder claro.
- Loading state no botão durante validação + signup (sequencial).

## O que NÃO muda

- Fluxo de paciente e clínica (PJ): inalterados.
- `accept-clinic-invite` e `join-clinic-by-code`: inalteradas.
- RLS, schema, outras edge functions: inalteradas.
- Caso o usuário queira virar autônomo no futuro, a clínica que ele administra precisará ser criada via fluxo "Clínica" no signup — não pelo fluxo "Profissional".

