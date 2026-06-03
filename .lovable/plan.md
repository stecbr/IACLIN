## Problema

A área `/paciente` fica em loop de recarregamento e o fluxo de agendamento não mostra profissionais como antes. Investigando, encontrei a causa raiz comum aos dois sintomas.

### Causa raiz: race condition no guard de rota

Em `src/App.tsx`, o `PatientProtectedRoute` só espera `loading` (sessão restaurada), mas **não espera** `clinicsLoaded` (que sinaliza que `roles` já foram buscadas no `AuthContext`). Sequência do bug:

1. `getSession()` resolve → `loading = false`, mas `roles = []` ainda.
2. `PatientProtectedRoute` avalia `isPatient = false` → redireciona para `/`.
3. `HomeRoute` → `ProtectedRoute` espera `clinicsLoaded`, conclui que o usuário é `patient` → redireciona de volta para `/paciente`.
4. Loop, com o spinner piscando e a página remontando — o que também **reseta o estado** do fluxo de agendamento (specialty/date/selection voltam a zero, dando a impressão de que "não dá mais para agendar como antes").

Os outros guards (`ProtectedRoute`, `OperatorProtectedRoute`, `SuperAdminProtectedRoute`, `OnboardingRoute`) já fazem `loading || (user && !clinicsLoaded)`. Só o `PatientProtectedRoute` ficou de fora.

## Mudanças

### 1. `src/App.tsx` — `PatientProtectedRoute`
- Trocar `if (loading)` por `if (loading || (user && !clinicsLoaded))`, igual aos demais guards. Isso garante que `roles` estejam carregadas antes de decidir `isPatient`, eliminando o redirect-loop.
- Pegar `clinicsLoaded` do `useAuth()`.

### 2. Validação pós-fix
- Abrir `/paciente` logado como paciente → não deve mais piscar/recarregar; `PatientHome` renderiza.
- Abrir `/paciente/agendar` → escolher especialidade → data → confirmar que a lista de profissionais aparece (dados no banco confirmados: há templates ativos para quarta, particular e plano).
- Conferir console/network para garantir que não há mais navegação repetida entre `/` e `/paciente`.

Escopo mínimo, apenas frontend, sem mexer em backend, RLS ou no fluxo de agendamento em si.
