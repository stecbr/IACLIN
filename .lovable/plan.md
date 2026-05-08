## Problema

Quando um pedido é aprovado em **Aprovações**, o agendamento é criado mas **não aparece imediatamente** em "Pacientes do Dia" (admin/clínica). A página depende apenas do realtime do Supabase para atualizar, e a aprovação não invalida o cache da nova aba.

Confirmado nos logs:
- A aprovação cria o registro em `appointments` corretamente (`clinic_id` certo, `status='scheduled'`).
- A consulta de `patients-of-day` rodou **antes** da aprovação retornando os dados antigos e nunca foi disparada novamente após o INSERT.
- O fluxo de `ClinicaAprovacoes.tsx` só invalida `['appointment-requests']`.

## Correções

### 1. `src/pages/clinica/ClinicaAprovacoes.tsx`
Após `approve` (e também em `reject`/cancelamento), invalidar as queries que alimentam a nova aba e o badge:
- `['patients-of-day']` (qualquer clinic_id / filtro)
- `['today-apt-count']`
- `['pending-requests-count']`

Usar `qc.invalidateQueries({ queryKey: ['patients-of-day'] })` (prefix match).

### 2. `src/pages/PatientsOfDay.tsx`
Tornar a query mais resiliente quando o usuário volta para a aba:
- `refetchOnWindowFocus: true`
- `refetchOnMount: 'always'`
- `staleTime: 0`
- `refetchInterval: 30_000` como fallback caso o realtime não dispare.

Manter o canal realtime atual (`pod-${clinic_id}`) — apenas reforçar com polling/foco.

### 3. `src/components/AppSidebar.tsx`
Aplicar o mesmo `refetchOnWindowFocus: true` na query `today-apt-count` para o badge ficar consistente com a página.

## Resultado esperado

Ao aprovar um pedido na tela de Aprovações:
1. O cache de "Pacientes do Dia" é invalidado imediatamente (sem depender de realtime).
2. O usuário ao entrar na aba sempre vê dados atualizados (mount + foco + polling).
3. Badge da sidebar fica em sincronia.

Nenhuma mudança de schema, RLS ou edge function.