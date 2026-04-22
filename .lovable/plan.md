

# Plano: Simulador de Roles (dev/preview only)

Permite trocar entre **Clínica (admin)** / **Médico/Profissional (dentist)** / **Paciente (patient)** sem deslogar. Só aparece para admins reais e em ambientes não-produção. Puramente UI — RLS continua usando o JWT real.

## Arquivos novos

### `src/lib/isDevEnvironment.ts`
```ts
const PROD_LOVABLE_HOSTS = ['dental-bridge-suite.lovable.app'];
export const isDevEnvironment = () => {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  if (PROD_LOVABLE_HOSTS.includes(h)) return false;
  if (h === 'iaclin.test.ia.br') return false;
  return h === 'localhost' || h === '127.0.0.1'
    || h.endsWith('.lovable.app') || h.includes('lovable.dev');
};
```

### `src/components/RoleSimulator.tsx`
- Constante exportada `SIMULATABLE_ROLES` com 3 entradas (admin/Clínica, dentist/Médico/Profissional, patient/Paciente). Fácil adicionar `secretary` depois.
- Retorna `null` se `loading` ou `!canSimulate`.
- `DropdownMenu` shadcn com trigger `UserCog`:
  - Desktop: ícone + texto "Visualizar como" (ou "Simulando: <label>" quando ativo, com `variant` warning).
  - Mobile (<sm): só ícone.
- Items: "Conta real" (disabled se !isSimulating), separator, depois `SIMULATABLE_ROLES.map(...)` com check no item ativo.
- Após `setSimulatedRole`, chama `navigate('/', { replace: true })`.

### `src/components/SimulationBanner.tsx`
- Retorna `null` se `!isSimulating`.
- `<div>` sticky `top-0 z-[60] h-7 bg-yellow-500/90 text-black` com texto:
  "⚠ Modo simulação ativo — visualizando como **<label>**. RLS do banco continua usando sua conta real."
- Botão "Sair da simulação" à direita chamando `setSimulatedRole(null)`.

## Arquivos editados

### `src/contexts/AuthContext.tsx`
- Importar `isDevEnvironment`.
- Estado `simulatedRole` inicializado em mount via `sessionStorage.getItem('iaclin.simulatedRole')`.
- Wrapper `setSimulatedRole(role)`: atualiza estado + grava/remove de sessionStorage.
- `signOut`: limpa estado + sessionStorage antes de chamar `supabase.auth.signOut()`.
- Adicionar ao `value`:
  - `simulatedRole`
  - `setSimulatedRole`
  - `isSimulating: simulatedRole !== null`
  - `canSimulate: roles.includes('admin') && isDevEnvironment()`
- Atualizar `AuthContextType` com esses 4 campos.

### `src/hooks/useRoleAccess.ts`
- Pegar `simulatedRole`, `isSimulating` do `useAuth`.
- ```ts
  const realEffectiveRole: AppRole = isPatient ? 'patient' : (clinicRole ?? 'admin');
  const effectiveRole: AppRole = (isSimulating && simulatedRole) ? simulatedRole : realEffectiveRole;
  ```

### `src/components/AppLayout.tsx`
- `<SimulationBanner />` como **primeiro filho** do `SidebarProvider`'s wrapper div (acima do header, fora do flex principal — como bloco no topo).
- `<RoleSimulator />` no header, **antes** de `<CommandPalette />` e do toggle de tema.
- Como o banner é sticky `top-0` com altura `h-7`, o header já é `sticky top-0`; ajustar header para `top-7` quando `isSimulating` (ler do `useAuth`) — ou deixar o banner como bloco normal (não-sticky) no topo do flex coluna, evitando sobreposição. **Vou usar bloco normal não-sticky** para não brigar com o header sticky.

## O que NÃO muda

- Sem alterações em RLS, migrations, edge functions.
- `switchClinic`, `ClinicSwitcher`, `ProtectedRoute`, `PatientProtectedRoute` intactos — herdam comportamento via `useRoleAccess`.
- Queries do Supabase continuam com o usuário real.

## Validação

1. Admin no `*.lovable.app` (preview) → seletor visível, 3 opções.
2. Trocar para Paciente → sidebar muda, redireciona pra `/`, banner amarelo no topo.
3. Trocar para Médico → bloco "Gestão da Clínica" some, "Meu Perfil" aparece.
4. "Sair da simulação" → tudo volta.
5. Em `dental-bridge-suite.lovable.app` e `iaclin.test.ia.br` → seletor não renderiza.
6. Reload mantém simulação (sessionStorage); fechar aba reseta; logout limpa.

