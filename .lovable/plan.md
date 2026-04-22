

# Plano: Cadastro de Médico via Convite + Código da Clínica

Substituir o fluxo atual ("clínica cria conta com senha temporária") por um modelo onde o **médico tem autonomia** para criar a própria conta, mas só fica vinculado se a clínica autorizou — via **convite por e-mail** OU **código da clínica**. Suporta médico em **múltiplas clínicas**, e gestão por **dono ou qualquer admin**.

## 1. Como funciona (visão do usuário)

**Lado da clínica** — em `/clinica/medicos`, o botão "Adicionar médico" abre um modal com 2 abas:

- **Convite por e-mail**: digita nome + e-mail + (opcional) CRO/especialidade → sistema gera token único e envia link (`/auth?invite=TOKEN`). O médico clica, define a senha, conta criada e já vinculada.
- **Código da clínica**: cada clínica tem um código permanente (ex: `CLIN-A4B2`) visível no painel. A clínica copia e compartilha por WhatsApp/qualquer canal. O médico vai em `/auth`, escolhe "Sou Profissional", informa o código no signup, conta criada e já vinculada.

Nas duas vias o vínculo é **automático e imediato** — sem fila de aprovação manual.

**Lado do médico** — uma seção "Minhas clínicas" no perfil mostra todas as clínicas que ele atende, com botão para entrar em cada uma. Se ele recebe um novo convite enquanto já tem conta, basta clicar no link logado e o vínculo é adicionado (não cria conta nova).

**Lista de convites pendentes** — a clínica vê na tela `/clinica/medicos` quais convites ainda não foram aceitos, com opção de reenviar ou revogar.

## 2. Mudanças no banco

Migração nova:

- **`clinic_members.invite_code`** (texto, único por clínica) — código permanente exibido no painel. Gerado via trigger ao criar `clinics`.
  - Na verdade fica em `clinics.invite_code` (uma por clínica, não por membro).
- Nova tabela **`clinic_invites`**:
  ```
  id uuid pk
  clinic_id uuid
  email text
  full_name text
  specialty text nullable
  registration_number text nullable
  role app_role default 'dentist'
  token text unique             -- usado no link /auth?invite=TOKEN
  invited_by uuid               -- quem mandou
  status text                   -- 'pending' | 'accepted' | 'revoked'
  expires_at timestamptz        -- 7 dias
  created_at, accepted_at
  ```
  RLS: members da clínica leem/criam/revogam; qualquer authenticated lê quando consulta pelo `token` (necessário para aceitar).
- Trocar policy `Owners can insert clinic members` para também aceitar `has_role(uid,'admin') AND user_belongs_to_clinic(uid, clinic_id)`.
- **Garantir `UNIQUE(clinic_id, user_id)`** em `clinic_members` (já implícito pelo `ON CONFLICT` em `auto_link_clinic_owner`, mas confirmar).
- Ajustar `AuthContext` para permitir múltiplas memberships (hoje usa `.limit(1).maybeSingle()`).

## 3. Edge functions

- **`create-clinic-invite`** (nova): valida que caller é admin/owner da clínica, cria registro em `clinic_invites` com token aleatório, envia e-mail com link `https://app/auth?invite=TOKEN` usando o sistema de e-mail transacional do Lovable Cloud.
- **`accept-clinic-invite`** (nova): recebe `token`, valida (não expirado, não aceito), insere em `clinic_members`, marca convite como `accepted`. Roda com service role para ignorar RLS na hora do INSERT.
- **`join-clinic-by-code`** (nova): recebe `code`, busca a clínica, insere em `clinic_members` com role `dentist`. Service role.
- **Manter `invite-member`** apenas para retrocompatibilidade (ou remover — recomendo remover já que o fluxo muda).

## 4. UI — telas a editar/criar

**Editar:**
- `src/pages/Auth.tsx` — quando vier `?invite=TOKEN` na URL, pré-preencher e-mail/nome do convite (consulta pública por token), e ao concluir signup chamar `accept-clinic-invite`. No signup de "Profissional", adicionar campo opcional **"Código da clínica"** que dispara `join-clinic-by-code` no fim.
- `src/components/clinica/AddMedicoDialog.tsx` — refatorar para 2 abas (Convite / Código). Aba código mostra o código atual + botão copiar.
- `src/pages/clinica/ClinicaMedicos.tsx` — adicionar seção "Convites pendentes" abaixo da tabela, com ações reenviar/revogar.
- `src/contexts/AuthContext.tsx` — passar a carregar **lista** de memberships, expor `clinics: ClinicMembership[]` + `currentClinicId` (com seletor persistido em localStorage).

**Criar:**
- `src/components/clinica/ClinicInviteCodeCard.tsx` — card no topo da tela de médicos mostrando o código + botão copiar.
- `src/components/ClinicSwitcher.tsx` — dropdown na sidebar para o médico alternar entre clínicas.
- `src/pages/InviteAccept.tsx` (opcional) — tela dedicada para usuário **já logado** aceitar um convite recebido.

## 5. Fluxo técnico resumido

```text
CONVITE POR E-MAIL
clínica → AddMedicoDialog → create-clinic-invite
       → e-mail com link /auth?invite=TOKEN
       → médico clica → Auth lê token, mostra signup pré-preenchido
       → signup OK → accept-clinic-invite(token) → vincula

CÓDIGO DA CLÍNICA
clínica → copia CLIN-XXXX do card
       → médico recebe → /auth signup como Profissional
       → digita código → signup OK → join-clinic-by-code(code) → vincula

MÉDICO JÁ EXISTENTE recebendo convite
logado → clica link → InviteAccept → accept-clinic-invite → nova membership
```

## 6. Pontos de atenção

- **Signup de profissional hoje cria role `admin`** automaticamente (`assign_default_role`). Precisa ajustar: se houver `?invite=` ou código no signup, NÃO criar clínica nem dar role admin — apenas role `dentist` e a membership da clínica convidante.
- **Múltiplas clínicas**: toda query que hoje faz `currentClinicId` continua válida, mas precisa de UI para trocar de clínica. Sem isso, o médico fica preso na primeira.
- **E-mail transacional**: requer domínio configurado em Lovable Cloud. Se ainda não houver, mostro o setup quando começarmos.
- **Segurança do código**: códigos curtos (8 chars) + rate limit no `join-clinic-by-code` para evitar brute force. Permitir regeneração do código pelo dono.
- **Convites expirados**: 7 dias por padrão, com botão "reenviar" que gera novo token.

