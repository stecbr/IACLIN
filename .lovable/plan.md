
## Diagnóstico

Verifiquei no banco a conta da Jesus (`jesuss@gmail.com`, role `secretary`, clínica `200c1de3…`):

```
permissions = { dashboard:true, agenda:true, salaEspera:true, aprovacoes:true,
                pacientes:true, convenios:true, financeiro:true, iaGestor:false,
                secretariaIa:false, chamados:true, settings:true }
```

`aprovacoes` está corretamente como `true` no banco e a sidebar (`AppSidebar.tsx` linha 248/700) respeita `staffPerms?.aprovacoes !== false`. Ou seja, a permissão **foi salva**, mas a sessão logada da Jesus **não vê em tempo real** porque:

1. `useStaffPermissions` usa `staleTime: 60_000` e não faz `refetchOnWindowFocus`/realtime.
2. Quando o **admin (Lucas)** salva o toggle em outro navegador, a invalidação do `QueryClient` só afeta o navegador de Lucas — a aba da Jesus continua com a cópia antiga em cache até reload completo.
3. Além disso, a chave `abrirProntuario` não existe ainda no registro de Jesus (só foi adicionada em código), então o fallback é o default — ok, mas confirma que o normalize está funcionando.

Também faltam validações para "Convênios" e "Pacientes" que não têm gate por permissão na rota (`useRoleAccess`) — só na sidebar.

## Mudanças

### 1. Ampliar o modal de Permissões
`src/components/settings/StaffPermissionsDialog.tsx`
- `DialogContent`: trocar `sm:max-w-md` por `sm:max-w-2xl max-h-[85vh] overflow-y-auto`.
- Renderizar `PERMISSION_ITEMS` em grid de 2 colunas em telas ≥ `sm` (`grid sm:grid-cols-2 gap-2`) para reduzir scroll.

### 2. Reatividade em tempo real (principal correção)
`src/hooks/useStaffPermissions.ts`
- Reduzir `staleTime` para `0` e adicionar `refetchOnWindowFocus: true`.
- Adicionar `useEffect` com canal Supabase Realtime escutando `clinic_members` filtrado por `user_id=eq.${user.id}` e `clinic_id=eq.${currentClinicId}` que chama `queryClient.invalidateQueries(['staff-permissions', user.id, currentClinicId])` em qualquer `UPDATE`.
- Resultado: assim que o admin salva o toggle, a sidebar da secretária re-renderiza sem reload.

### 3. Gates de rota faltantes
`src/hooks/useRoleAccess.ts`
- Já cobre `/clinica/aprovacoes`, `/clinica/convenios`, `/patients`, `/financial`, etc. Adicionar também `/orcamentos` se necessário e confirmar `/sala-de-espera` ✓ (já presente).
- Adicionar redirect: hoje `canAccess` retorna `false`, mas falta um `Navigate` em rotas que não checam. Garantir que cada rota em `App.tsx` use o guard (verificar e adicionar onde estiver faltando).

### 4. Validação manual via Playwright
Após as mudanças, escrever um script que:
1. Faz login como Lucas (admin), abre `/clinica/medicos` → toggle "Aprovações" off → salva.
2. Em paralelo, abre `/clinica/medicos` como Jesus (sessão separada via storageState) e verifica que o item "Aprovações" sumiu da sidebar em < 5s sem reload manual.
3. Repete o ciclo para cada permissão (dashboard, agenda, salaEspera, aprovacoes, pacientes, abrirProntuario, convenios, financeiro, iaGestor, secretariaIa, chamados) e confirma que tanto a sidebar quanto a rota direta (`/clinica/aprovacoes`, `/patients`, etc.) respeitam o estado.
4. Botão "Iniciar atendimento" oculto para secretária em `/patients/:id` e no `AppointmentDetailDialog`.

> Observação: senhas de Jesus/Lucas serão necessárias para o teste E2E. Se não estiverem disponíveis, validarei via consulta SQL (confirmando que `permissions` reflete o toggle) + inspeção do código de filtragem.

## Arquivos tocados

- `src/components/settings/StaffPermissionsDialog.tsx` (largura + grid 2 colunas)
- `src/hooks/useStaffPermissions.ts` (realtime + staleTime 0)
- `src/hooks/useRoleAccess.ts` (gates de rota — apenas confirmar e completar)
- (teste) `/tmp/browser/perms/test.py`
