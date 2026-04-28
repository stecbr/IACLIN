## Diagnóstico — onde estão exatamente os bugs

### Bug 3 — Especialidade vira "Dentista" depois de salvar (raiz)

O `SpecialtySelect` armazena o **id** do catálogo (ex.: `clinico-geral`), não o nome. O fluxo de cadastro do médico passa por:

1. **Cadastro autônomo (Auth.tsx)**: usuário escolhe "Médico" → vai pro `Onboarding` (dono de clínica). Aqui `profSubType = 'medico'` e `specialty` é gravado em `raw_user_meta_data`, mas **o trigger `handle_new_user` ignora completamente esse campo** para o tipo `profissional` — só cria `user_roles` (admin). A especialidade nunca é persistida em `clinic_members` (que é criada depois pelo `auto_link_clinic_owner` sem specialty). Resultado: o médico-dono fica com `clinic_members.specialty = NULL`. Quando outras telas exibem o "papel" elas caem no fallback hardcoded `dentist: 'Dentista'` (TeamSection.tsx:18) ou no badge `m.role` ("dentist") capitalizado.

2. **Cadastro via convite (accept-clinic-invite)**: o convite é criado com `role = 'dentist'` por default (clinic_invites.role default), e mesmo quando o `AddMedicoDialog` envia uma especialidade, ela é sempre tratada como `role = 'dentist'`. Daí o badge de função sempre mostra "Dentista" mesmo para um Clínico Geral médico.

3. **Display**: vários pontos exibem o **id cru** em vez de chamar `specialtyLabel()` — ex.: `WaitingRoomCard.tsx`, `ApprovalCard.tsx`, e o sidebar/nav, fazendo "clinico-geral" aparecer como id ou `Dentista` como fallback de role.

### Bug 2 — Tela do Médico carrega componentes da Clínica

Em `Auth.tsx` linha 109, o fluxo de convite força `setProfSubType('dentista')` independentemente da especialidade médica. Combinado com o trigger que só cria role `dentist` para `profissional_member`, todo médico convidado entra como "dentist" → o `AppSidebar` injeta itens odontológicos (Odontograma, Mapa Clínico de dente) e o `IndexRouter` envia para `DentistHome`, que é o painel correto, mas com **categoria de clínica `odonto`** herdada incorretamente quando a clínica é `medico`. Além disso:

- O `AppSidebar` filtra módulos por `clinicCategory` — uma clínica criada via `handle_new_user` é gravada com categoria fixa `'outro'` (migration linha 52), nunca `'medico'`, mesmo quando o dono escolheu Médico no signup. Isso faz o painel mostrar uma mistura genérica (alguns itens odonto + outros).
- `clinic_category` chega do signup (`profSubType === 'medico' ? 'medico' : 'odonto'`) mas é ignorada pelo trigger.

### Bug 1 — Performance da tela do Médico

O culpado principal é o `useAiSync` montado em `AppLayout` (linha 33). Ele dispara para **todo perfil** logado, incluindo médicos:

- 4 snapshots paralelos pesados (`buildConfigSnapshot`, `buildDoctorsBatch`, `buildPatientsBatch`, `buildAvailabilitySlots`) — `buildPatientsBatch` faz 5 queries dependentes e processa todos os pacientes da clínica.
- Polling a cada 30s no `getAiPendingAppointments` que faz fetch HTTP externo.
- Quando `VITE_AI_BACKEND_URL` está definida mas o servidor não responde, cada chamada fica pendente por minutos antes de timeout, mantendo conexões abertas (a clínica admin não sente pq o snapshot já rodou; mas o médico, ao trocar de página, fica esperando).

Secundariamente: `DentistHome` faz 5 queries em série sem `staleTime` configurado no `QueryClient` (App.tsx:45 cria `new QueryClient()` sem defaults), então cada navegação refaz tudo.

### Bug 4 — Validação/persistência

- Senha mínima 6 caracteres — ok.
- Email/CRM/nome — ok no front.
- **CRM/specialty do dono nunca chegam ao banco** (vide bug 3.1).
- Redirecionamento pós-cadastro: o trigger inicia o usuário sem clínica (no caso `profissional_member` antes do invite) → manda para `/aguardando-clinica`. Após `accept-clinic-invite`, o `currentClinicId` no contexto não é refetchado automaticamente — o usuário precisa recarregar a página.

---

## Plano de correção (ordem de impacto)

### 1. Fix de especialidade (mais crítico)

- **Migração SQL** — atualizar `handle_new_user`:
  - Para `user_type = 'profissional'` (médico/dentista dono), criar `clinic_members` com `specialty` e `registration_number` lidos do `raw_user_meta_data` no momento certo (depois da clinic do `auto_link_clinic_owner`, ou ajustar `auto_link_clinic_owner` para ler do `auth.users.raw_user_meta_data` do owner).
  - Para `user_type = 'clinica'`, ler `clinic_category` do meta e gravar em `clinics.category` (não fixar `'outro'`).
- **Migração SQL** — `clinic_invites.role` default → ler do payload já passa o role na edge function `create-clinic-invite`; revisar para enviar `'dentist'` apenas quando categoria for `odonto`, senão `'dentist'` continua valendo no enum (não há `medico`), mas isso é só label — a UI deve mostrar a **especialidade**, não o role.
- **TeamSection.tsx** — remover map hardcoded `dentist: 'Dentista'`; usar `specialtyLabel(member.specialty)` quando houver.
- **ClinicaMedicos.tsx** — substituir `<Badge>{m.role}</Badge>` por badge baseado em `is_owner`/contexto, e mover a especialidade para coluna principal (já existe).
- **WaitingRoomCard.tsx, ApprovalCard.tsx** — passar `dentist_specialty` por `specialtyLabel()`.

### 2. Fix de mistura Clínica/Médico

- **Auth.tsx** — remover `setProfSubType('dentista')` forçado no fluxo de convite (linha 109); ler do `clinic_invites.specialty` ou da categoria da clínica.
- **handle_new_user** (mesma migração acima) — gravar `clinics.category` com a categoria escolhida no signup.
- **AppSidebar.tsx** — confirmar que `categories` filtram corretamente itens odonto quando categoria for `medico`. Já está implementado, só vai funcionar uma vez que a categoria seja gravada certa.
- **Pós-aceite de convite** — em `Auth.tsx` linha 156, após `accept-clinic-invite` chamar `window.location.reload()` ou refetch do AuthContext, para o `currentClinicId` ser populado imediatamente.

### 3. Fix de performance do painel Médico

- **AppLayout.tsx** — só montar `useAiSync` quando `effectiveRole === 'admin'` (médicos não precisam disparar snapshot da clínica inteira nem polling de novos appointments — isso é responsabilidade do admin/secretária).
- **App.tsx** — configurar `QueryClient` com defaults: `staleTime: 60_000`, `refetchOnWindowFocus: false` para evitar refetches a cada tab focus.
- **useAiSync.ts** — adicionar timeout de 5s nas chamadas `aiBackend.*` para que falhas de rede não fiquem pendentes infinitamente; envolver `tick()` em `AbortController` no cleanup.
- **DentistHome.tsx** — paralelizar as queries via `useQueries` (ou simplesmente confiar em `staleTime` global) — mudança opcional, ganho marginal vs. as duas anteriores.

### 4. Validações finais

- Tornar `CRM/CRO` obrigatório no `Auth.tsx` para `userType === 'profissional'` (hoje é opcional).
- Após signup bem-sucedido com `session`, se for `userType === 'profissional'` (dono), redirecionar para `/onboarding` em vez de deixar o `ProtectedRoute` decidir (evita o flash da tela de "aguardando clínica").

---

## Detalhes técnicos para implementação

**Arquivos a editar:**
- `supabase/migrations/<nova>.sql` — atualizar `handle_new_user` (gravar `clinic_category` em `clinics.category`) + atualizar `auto_link_clinic_owner` (gravar `specialty`/`registration_number` lidos do meta do owner).
- `src/pages/Auth.tsx` — remover hardcode de `dentista` no fluxo de invite; reload pós-accept; CRM obrigatório.
- `src/components/AppLayout.tsx` — gate do `useAiSync` por role.
- `src/App.tsx` — defaults do `QueryClient`.
- `src/hooks/useAiSync.ts` — timeout/abort nas chamadas externas.
- `src/components/settings/TeamSection.tsx` — remover label hardcoded.
- `src/pages/clinica/ClinicaMedicos.tsx` — badge de role neutro.
- `src/components/waiting-room/WaitingRoomCard.tsx`, `src/components/clinica/ApprovalCard.tsx` — usar `specialtyLabel()`.

**Sem mudanças de layout** — só correções de dados, lógica condicional e display de strings.

---

Quer que eu já inclua a parte do **role/specialty do dono ao criar a clínica** (passo 1 da migração SQL — exige `auto_link_clinic_owner` ler do `auth.users.raw_user_meta_data->>'specialty'`) ou prefere dividir essa migração em uma etapa separada para revisar antes?