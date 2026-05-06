# Modal de vínculo com clínica no cadastro de profissionais

## Objetivo
Após o profissional (médico/dentista) preencher nome, e-mail, senha, especialidade e CRM/CRO no cadastro, exibir um modal perguntando se ele faz parte de alguma clínica **antes** de finalizar o acesso à plataforma.

- **SIM** → exibe campo para o código de convite da clínica (`CLIN-XXXXXXXX`) com aviso "Solicite o código de convite à clínica". Se válido, vincula e entra.
- **NÃO** → o profissional entra como dono do próprio consultório (acesso completo, mesmas funcionalidades de uma clínica).

## Fluxo atual (contexto)
Hoje em `src/pages/Auth.tsx`, ao clicar em "Criar conta" como Profissional sem `inviteToken` na URL, o sistema apenas cria o usuário e o redireciona para `/aguardando-clinica`, onde ele escolhe entre criar consultório próprio ou inserir código. A nova proposta antecipa essa decisão para um modal logo após o submit do cadastro, tornando o onboarding mais direto e elimina a tela intermediária para esses casos.

## Mudanças

### 1. `src/pages/Auth.tsx`
- Adicionar estado `clinicChoiceOpen`, `clinicChoice` (`'yes' | 'no' | null`), `inviteCode`, `validatingCode`, `pendingSignup` (boolean).
- No `handleSubmit`, quando `userType === 'profissional'` **e não houver `inviteToken` na URL** e estivermos em modo signup:
  - Validar todos os campos como já feito.
  - Em vez de chamar `supabase.auth.signUp` direto, abrir o modal de escolha.
- Criar nova função `finalizeProfessionalSignup(joinCode?: string)` que:
  1. Executa `supabase.auth.signUp(...)` com os mesmos `data` atuais.
  2. Se `joinCode` for fornecido: invoca `join-clinic-by-code` após signup.
  3. Caso contrário: invoca `create-own-clinic` para que o profissional já entre direto no painel sem passar por `/aguardando-clinica`.
  4. Em ambos os casos, redireciona para `/` ao concluir.
- Tratamento de duplicidade de e-mail (identities vazio) continua igual e fecha o modal voltando ao login.

### 2. Novo componente `src/components/auth/ClinicChoiceDialog.tsx`
Modal usando `Dialog` (shadcn) com fade-in/out (regra do projeto), contendo:
- Título: "Você faz parte de alguma clínica?"
- Dois botões grandes: **Sim, tenho código** / **Não, quero meu próprio consultório**.
- Quando "Sim" selecionado, expande área com:
  - `Input` para código (mascarado uppercase, max 13 chars, formato `CLIN-XXXXXXXX`).
  - Texto auxiliar: "Solicite o código de convite para a sua clínica."
  - Botão "Validar e entrar" → chama edge function `validate-clinic-code` para feedback imediato (já existe). Se válida, exibe nome da clínica e libera o botão "Confirmar e criar conta".
- Quando "Não" selecionado:
  - Texto: "Tudo certo. Você terá acesso completo ao seu próprio consultório, com agenda, prontuário, financeiro e equipe."
  - Botão "Criar meu consultório".
- Estados de loading e erro inline.
- Props: `open`, `onOpenChange`, `onConfirm(code?: string)`, `submitting`.

### 3. Sem mudanças de banco
`validate-clinic-code`, `join-clinic-by-code` e `create-own-clinic` já existem e cobrem o fluxo. `/aguardando-clinica` permanece como fallback caso o usuário feche o modal/erro inesperado (segurança).

## Detalhes técnicos
- O modal é exibido apenas no signup profissional sem `inviteToken`. Convites por link continuam funcionando como hoje.
- Validação de código no modal usa o regex existente `/^CLIN-[A-Z2-9]{8}$/` e a edge function `validate-clinic-code` para confirmar antes de criar a conta.
- Se a sessão não vier imediatamente após `signUp` (caso confirmação de e-mail esteja ativa), guardamos a escolha em estado e exibimos toast "Confirme seu e-mail para finalizar"; no primeiro login o `WaitingClinic` já cobre. Para o fluxo padrão (auto-confirm desativado por padrão? — checar `supabase/config.toml` se necessário), assumimos sessão imediata.
- Animações: fade-in/out exclusivamente, conforme regra de memória do projeto.

## Arquivos
- Editado: `src/pages/Auth.tsx`
- Criado: `src/components/auth/ClinicChoiceDialog.tsx`
