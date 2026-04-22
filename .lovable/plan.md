

# Fix: Tela branca ao simular role "Paciente"

## Causa raiz

Quando admin real clica "Paciente" no simulador:

1. `RoleSimulator` salva `simulatedRole='patient'` e navega para `/`.
2. `ProtectedRoute` (`src/App.tsx`) lê `isPatient` do `AuthContext`, que vem de `roles.includes('patient')` — o role REAL, não o simulado. Como o admin não tem role `patient`, **não** redireciona para `/paciente`.
3. Em seguida, `canAccess('/')` do `useRoleAccess` usa `effectiveRole='patient'` (que respeita simulação) e retorna `false`, porque `/` só permite admin/dentist/secretary.
4. Resultado: `<Navigate to="/" replace />` em loop → React não renderiza nada → **tela branca**.

O mesmo problema, ao contrário, vai ocorrer se um usuário paciente real tentar simular admin — `PatientProtectedRoute` também olha só o `isPatient` real.

## Correção

Fazer as guards de rota respeitarem o role efetivo (real OU simulado), centralizando a lógica.

### 1. `src/contexts/AuthContext.tsx`
Expor um `effectiveIsPatient` derivado da simulação:
- Se `isSimulating` → `effectiveIsPatient = simulatedRole === 'patient'`
- Senão → `effectiveIsPatient = isPatient` (real)

### 2. `src/App.tsx` — `ProtectedRoute`
Trocar uso de `isPatient` por `effectiveIsPatient`. Assim, ao simular paciente, redireciona corretamente para `/paciente` em vez de cair em loop com `canAccess`.

### 3. `src/App.tsx` — `PatientProtectedRoute`
Também trocar para `effectiveIsPatient`. Permite que admin simulando paciente acesse `/paciente/*`. E quando paciente real simular admin (caso `canSimulate` permita), volta para `/`.

### 4. `src/App.tsx` — `OnboardingRoute` e `WaitingClinicRoute`
Mesma troca, para evitar redirecionamentos errados durante simulação.

### 5. Validação manual
- Admin real → "Visualizar como > Paciente" → vai para `/paciente`, mostra `PatientLayout`, sem tela branca.
- Voltar para "Conta real" ou "Clínica" → volta para `/` normalmente.
- "Médico/Profissional" → continua em `/`, mas com sidebar/menus filtrados pelo `useRoleAccess` (já funciona).
- Em produção (`dental-bridge-suite.lovable.app` e `iaclin.test.ia.br`) → simulador continua oculto (`isDevEnvironment()` false).

## Arquivos alterados

- `src/contexts/AuthContext.tsx` — adicionar `effectiveIsPatient` ao contexto.
- `src/App.tsx` — usar `effectiveIsPatient` em todas as guards (`ProtectedRoute`, `PatientProtectedRoute`, `OnboardingRoute`, `WaitingClinicRoute`).

Nenhuma migration, RLS ou edge function. Mudança puramente de UI/roteamento.

