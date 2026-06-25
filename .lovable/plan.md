## Correções de RBAC e Sidebar (Secretária)

### 1. Esconder "Iniciar atendimento" para não‑dentistas/medicos

- Em `src/pages/PatientDetail.tsx`, `src/components/waiting-room/WaitingRoomCard.tsx` e `src/components/agenda/AppointmentDetailDialog.tsx`: usar `useRoleAccess()` → `effectiveRole` e renderizar o botão **somente** quando `effectiveRole === 'dentist'`. Admin (modo gestor), secretária e auxiliar não veem o botão.

### 2. Nova permissão "Abrir prontuário" e respeito real às toggles

- `src/components/settings/StaffPermissionsDialog.tsx`:
  - Adicionar chave `abrirProntuario: boolean` em `StaffPermissions`.
  - Default `true` para secretary, `false` para auxiliary.
  - Novo item no `PERMISSION_ITEMS` ("Abrir prontuário" / ícone `FolderHeart`).
  - Em `normalizeStaffPermissions`, preencher `abrirProntuario` quando ausente.
  - No `handleSave`, **invalidar** as queries `['staff-permissions']` e `['role-access']` para que a sidebar reaja em tempo real.
- `src/hooks/useRoleAccess.ts`: incluir `/prontuarios` no mapa de permissões staff → `abrirProntuario`.
- `src/components/AppSidebar.tsx`: envolver cada renderização de `prontuarioItem` num gate `(!isStaff || staffPerms?.abrirProntuario !== false) && prontuarioItem`.

### 3. Limpar duplicidade na sidebar para staff/dentista

No bloco "non‑admin" (`AppSidebar.tsx` linhas ~667–740) hoje existem **duas** seções "Gestão da Clínica" (linhas 695 e 720) e `prontuarioItem` é renderizado **duas vezes**.

Reestruturar para uma única seção "Gestão da Clínica" quando houver clínica ativa:

- Remover por completo o bloco `!isDentist && effectiveRole !== 'patient'` (linha 719) — "Visão Geral" e "Médicos" já não devem aparecer para secretária/auxiliar (são telas de admin). Continuam existindo no caminho admin (linha 596).
- Manter apenas o bloco da linha 694 contendo `finalClinicNav` + `prontuarioItem` (já com gate de permissão da etapa 2).
- Garantir que `prontuarioItem` apareça uma única vez em todo o componente.

### 4. Reatividade das permissões em tempo real

- Após salvar permissões em `StaffPermissionsDialog`, invalidar `['staff-permissions', userId, clinicId]` via `queryClient.invalidateQueries` (atualmente o hook tem `staleTime: 60_000` e não recarrega).
- Disparar `window.dispatchEvent(new Event(VIEW_MODE_EVENT))` opcionalmente para forçar re-render do `useRoleAccess`.

### 5. Validação manual

Após as mudanças, simular como secretária alternando cada toggle no painel do gestor e confirmar:

- "Abrir prontuário" off → some o item da sidebar e a rota `/prontuarios` redireciona.
- "Aprovações" on → aparece em "Atendimento do Dia"/"Gestão" com o badge `pendingCount`.
- Demais toggles (agenda, sala de espera, pacientes, convênios, financeiro, IA Gestor, Secretária IA, chamados) refletem em tempo real sem reload.
- Em `/patients/:id` o botão azul "Iniciar atendimento" não aparece para secretária nem para admin no modo gestor.

### Arquivos tocados

- `src/components/AppSidebar.tsx`
- `src/components/settings/StaffPermissionsDialog.tsx`
- `src/hooks/useRoleAccess.ts`
- `src/hooks/useStaffPermissions.ts` (se necessário expor `abrirProntuario` no fallback)
- `src/pages/PatientDetail.tsx`
- `src/components/waiting-room/WaitingRoomCard.tsx`
- `src/components/agenda/AppointmentDetailDialog.tsx`