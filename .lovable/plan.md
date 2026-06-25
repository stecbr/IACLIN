## Problema

Você ativou `Aprovações` para o Jesus e confirmei no banco que a permissão `aprovacoes: true` está salva no `clinic_members` dele. Mesmo assim a aba não aparece na sidebar dele.

Possíveis causas a investigar:

1. **Sessão do Jesus não recebeu o evento Realtime** (ele logou antes da publicação Realtime ser ativada ou o canal não está disparando a invalidation).
2. **`useStaffPermissions` está retornando o fallback estático** em vez do valor real do banco — o fallback de `secretary` já tem `aprovacoes: true`, então o problema só seria visível se algum outro gate estiver filtrando o item.
3. **Filtro extra na sidebar**: o item `/clinica/aprovacoes` está em `clinicNav` e só aparece para secretária no bloco "Gestão da Clínica" (linha 695). Pode haver um gate adicional escondendo-o (ex.: `clinicCategory` indefinido, `effectiveRole` caindo para `dentist` por causa do `viewMode`).
4. **`currentClinicId` da sessão do Jesus** pode estar apontando para outra clínica (caso ele tenha múltiplos vínculos), e a consulta de permissões busca de uma linha sem `aprovacoes:true`.

## Investigação (sem alterar código)

1. Rodar Playwright autenticado como `jesuss@gmail.com` no preview, restaurar a sessão Supabase, abrir `/` e capturar screenshot da sidebar inteira.
2. Coletar do `localStorage`/console do navegador: `clinicRole`, `currentClinicId`, `staffPerms` (via `window.__iaclinDebug` ou inspeção do React Query devtools/log).
3. Tentar navegar direto para `/clinica/aprovacoes` — se a página abrir, o problema é só rendering da sidebar; se redirecionar, é gate de `canAccess`.
4. Conferir no banco se Jesus tem mais de uma linha em `clinic_members` (uma por clínica) e qual está ativa.

## Correções prováveis

Dependendo do achado:

- **Se for múltiplas memberships**: garantir que `useStaffPermissions` filtre por `currentClinicId` exato (já filtra) e que o `currentClinicId` salvo no localStorage do Jesus aponte para a clínica certa; resetar via `switchClinic`.
- **Se for gate de `clinicCategory`**: o item `Aprovações` já usa `ALL_CATEGORIES`, então não deve ser. Caso `clinicCategory` esteja chegando como `undefined`, forçar `'outro'` como default já cobre.
- **Se for Realtime não disparando para a sessão dele**: forçar `refetchOnWindowFocus` + `refetchInterval` curto (ex.: 30s) no `useStaffPermissions` como fallback ao Realtime, garantindo convergência mesmo se o canal cair.
- **Se a sessão do Jesus precisar de hard refresh**: adicionar um listener no app que faz `queryClient.invalidateQueries(['staff-permissions'])` ao voltar para o foco da janela (já está em `refetchOnWindowFocus: true`, mas confirmar que `staleTime: 0` está respeitado).

## Entrega

- Diagnóstico exato apontando qual das hipóteses acima é a real.
- Patch mínimo na causa raiz (sem refatorar o resto do RBAC).
- Screenshot da sidebar do Jesus já com "Aprovações" visível, validando.

Sem mudanças no escopo de permissões — apenas garantir que a permissão `aprovacoes` que você já marcou seja efetivamente refletida na UI do secretário.