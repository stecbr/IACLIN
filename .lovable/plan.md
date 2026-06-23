## 1. Remover "Confirmar Senha" do cadastro

**Arquivo:** `src/pages/Auth.tsx`

- Remover o bloco do campo `Confirmar Senha` (linhas ~911-916) e a validação `password !== confirmPassword` no fluxo de clínica (linhas ~312-316).
- Remover o estado `confirmPassword` / `setConfirmPassword` (linha ~89).
- O formulário de operadora já não exibia o campo, mas removendo a fonte garante que não apareça em nenhum tipo de cadastro (paciente, profissional, clínica, operadora).

## 2. Corrigir "Comece por aqui" não atualizar após salvar

**Causa raiz:** o `useQuery(['getting-started', ...])` em `GettingStartedChecklist.tsx` tem `staleTime: 30s` e nenhum gatilho de invalidação após o paciente salvar perfil/foto/endereço, então os contadores ficam em 0% até o cache expirar. Além disso, as queries só leem alguns campos de `profiles`, mas o `PatientSettings.save()` grava em `profiles`, `patient_accounts` e `patients` — se uma dessas leituras falhar por RLS, o item fica como "não feito".

**Mudanças:**

- `src/pages/patient/PatientSettings.tsx` — no fim de `save()` (após `refetch()`), invalidar a query:
  ```ts
  queryClient.invalidateQueries({ queryKey: ['getting-started'] });
  ```
  (importar `useQueryClient` do `@tanstack/react-query`).

- `src/components/GettingStartedChecklist.tsx` (persona `patient`):
  - Reduzir `staleTime` para `0` e adicionar `refetchOnWindowFocus: true` para refletir mudanças rapidamente.
  - Ampliar a detecção combinando `profiles + patient_accounts + patients`:
    - `profileComplete`: `(pr.full_name || acc.full_name) && (pr.phone || acc.phone || pa.phone)`
    - `hasPhoto`: `pr.avatar_url || acc.photo_url || pa.photo_url`
    - `hasAddress`: mantém OR atual entre as três tabelas
    - `hasInsurance`: mantém (opcional)
    - `hasAppointment`: mantém

Assim, qualquer um dos três caminhos de gravação já marca o item como concluído.

## Verificação

- Abrir `/auth` em modo cadastro (operadora, clínica, paciente, profissional) e confirmar que não existe mais o campo "Confirmar Senha".
- Como paciente, em `/paciente/configuracoes`, salvar nome/telefone/foto/endereço e confirmar que o card "Comece por aqui" sobe para 100% sem precisar recarregar a página.
