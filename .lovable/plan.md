## Objetivo

Permitir que um médico/dentista **sem vínculo com clínica** atenda sozinho — tratando-o como uma "clínica de uma pessoa só" (consultório próprio), onde ele é proprietário e atende pacientes da mesma forma que uma clínica completa.

## Estado atual

- `/aguardando-clinica` (`WaitingClinic.tsx`) já oferece o botão **"Criar meu consultório agora"**, que chama a edge function `create-own-clinic`.
- A edge function já cria a `clinic`, vincula o usuário como `owner` + `admin` em `clinic_members`, e seta `category` baseada no metadata do cadastro.
- O `ProtectedRoute` só envia para `/aguardando-clinica` quem **não tem `admin`** entre as roles globais.

**Problemas observados:**
1. Profissional cadastrado pelo fluxo `profissional_member` (convite) tem role `dentist`, não `admin`. Se o convite não for aceito, ele cai em `/aguardando-clinica` mas não há reforço visual de que "criar consultório próprio" é a rota recomendada — fica como **botão primário desbalanceado** com a opção de código.
2. Após criar consultório, o usuário continua tendo apenas role `dentist` se foi cadastrado como member; a edge `create-own-clinic` adiciona `admin`, mas o front não reflete isso até reload (já existe `window.location.assign('/')` — ok).
3. O dashboard dele (`DentistRouter` / `DentistHome`) é apropriado, mas algumas KPIs/atalhos assumem secretária/financeiro centralizado. Para solo, faz sentido mostrar uma faixa "Modo consultório individual" e habilitar todos os módulos (Financeiro, Agenda, Pacientes, Prontuário) já que ele é o admin da própria clínica.
4. Não há indicação visual nem onboarding pós-criação que comunique "você está atendendo no seu próprio consultório".

## Mudanças propostas

### 1. `WaitingClinic.tsx` — repriorizar e clarificar
- Reordenar UI: a opção **"Começar a atender no meu próprio consultório"** vira o caminho principal (card destacado com ícone, descrição "Você é seu próprio admin — agenda, prontuário e financeiro liberados").
- "Tenho um código de clínica" vira opção secundária (link/collapse).
- Texto explicativo: "Você pode atender sozinho agora e depois convidar uma secretária ou se vincular a uma clínica."

### 2. `create-own-clinic` (edge) — pequeno ajuste
- Garantir que o nome da clínica use a especialidade quando disponível (ex.: "Consultório Dr. João — Cardiologia") em vez de só o nome.
- Sem mudança de schema.

### 3. `Onboarding.tsx` — já existe; verificar que pula passos não aplicáveis
- Para solo (1 profissional, sem secretária), mostrar passo único de "Configurar horários de atendimento" e seguir.
- Reaproveita componente atual; só ajustar copy quando `clinics.length === 1 && isClinicOwner && team count === 1`.

### 4. `Index.tsx` (Dashboard) — banner solo
- Quando `isClinicOwner && clinics.length === 1 && team size (clinic_members) === 1`, exibir banner discreto: "Modo consultório individual — você atende e gerencia tudo. [Convidar secretária]".
- Link "Convidar secretária" abre o convite existente em `Settings → Equipe`.

### 5. `useRoleAccess` — confirmar acesso total
- Verificar que owner solo (role `admin` + `dentist`) tem acesso a Financeiro, Agenda, Pacientes, Atendimento, Configurações. Já deve estar ok pelo `admin`. Sem mudança esperada.

### 6. Settings → Clinic info
- Renomear o cabeçalho da seção quando solo: "Meu consultório" em vez de "Minha clínica" (cosmético, condicional).

## Detalhes técnicos

- Detecção de "modo solo" no front:
  ```ts
  const isSolo = isClinicOwner
    && clinics.length === 1
    && teamCount === 1; // já queryable em SettingsPage
  ```
  Reaproveitar com um hook `useSoloMode()` em `src/hooks/useSoloMode.ts` que faz `count` em `clinic_members` para o `currentClinicId`.

- Fluxo do dentist cadastrado via `profissional` (próprio dono): `handle_new_user` já cria a clínica. Ele nunca passa por `WaitingClinic`. **Esse caminho já funciona.**
- Fluxo do `profissional_member` que não acaba sendo convidado: passa por `WaitingClinic` → "criar próprio consultório" → vira admin solo. **Esse é o foco do ajuste.**

## Arquivos

- **Edit**: `src/pages/WaitingClinic.tsx` — UI repriorizada
- **Edit**: `supabase/functions/create-own-clinic/index.ts` — nome com especialidade
- **Create**: `src/hooks/useSoloMode.ts` — detector de modo solo
- **Edit**: `src/pages/Index.tsx` (`AdminHome` + `DentistRouter`) — banner solo
- **Edit**: `src/pages/dentist/DentistHome.tsx` — banner solo
- **Edit**: `src/pages/SettingsPage.tsx` — copy condicional "Meu consultório"

## Sem mudanças de schema
Nenhuma migration necessária. Tudo já está suportado pela estrutura `clinics` + `clinic_members` + `user_roles`.
