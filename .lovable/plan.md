# Separar Pessoal × Clínica para Admin profissional

## Contexto

Hoje `Pessoal` (Minha Agenda + Disponibilidade) só aparece para `dentist`. Um admin que também atende não tem essa separação. Conforme você confirmou:

- Admin profissional **sempre** atende dentro da clínica em que é admin (não existe "agendamento solto sem clínica").
- A **Disponibilidade pessoal** é fonte única — define os dias/horários liberados para todas as clínicas vinculadas.
- Secretária não tem `Pessoal` (não atende).

## Mudanças

### 1. Sidebar (`src/components/AppSidebar.tsx`)

Bloco **Pessoal** passa a aparecer para `admin` e `dentist`:

- `Dashboard` — admin, dentist, secretary (igual hoje)
- `Minha Agenda` → rota `/minha-agenda` — admin, dentist
- `Disponibilidade` → `/disponibilidade` — admin, dentist
- `Meu Perfil` → `/perfil` — igual hoje

Bloco **Operação** (admin/secretary) continua apontando para `/agenda` (visão da clínica inteira). Removo o item duplicado "Disponibilidade" daí — passa a ser só pessoal (fonte única).

### 2. Nova rota `/minha-agenda`

Reaproveita a página `Agenda.tsx` em modo "só meus atendimentos":

- Adiciono prop/flag `forceMineOnly` ao componente Agenda (ou leio `useLocation`/`useMatch`).
- Quando ativo: força `query.eq('dentist_id', user.id)` e esconde o `AgendaDoctorFilter`.
- Continua respeitando `currentClinicId` (mostra meus atendimentos na clínica ativa).

Registro a rota em `App.tsx` reusando o mesmo componente.

### 3. Permissões (`src/hooks/useRoleAccess.ts`)

- Adiciono `/minha-agenda` com `['admin', 'dentist']`.
- `/disponibilidade` já permite admin — ok.

### 4. Disponibilidade pessoal como fonte única

A página `/disponibilidade` (Availability.tsx) já grava em `professional_schedule_template` / `professional_availability` por `user_id`. Não muda comportamento — só reforço que o `clinic_id` aceito é `null` ou qualquer clínica vinculada (já permitido pelo schema atual). Os módulos de agendamento de outras clínicas e marketplace já consultam essa tabela por `user_id` global.

Não há migração de banco necessária neste passo — o schema já suporta o modelo.

## Arquivos editados

- `src/components/AppSidebar.tsx` — mover/duplicar itens de personal, ajustar `allowedRoles`.
- `src/hooks/useRoleAccess.ts` — adicionar `/minha-agenda`.
- `src/pages/Agenda.tsx` — detectar rota `/minha-agenda` e forçar filtro próprio.
- `src/App.tsx` — registrar rota `/minha-agenda`.

## Fora de escopo

- Não vou mexer em RLS nem criar tabelas.
- Não toco no fluxo de `Operação` (Sala de Espera, Agenda compartilhada).
- Cobrança/visão de outras clínicas vinculadas consumindo a disponibilidade é separada — já funciona via `professional_availability`.
