## Problema

O erro `cannot add 'postgres_changes' callbacks after subscribe()` continua aparecendo no login, vindo do canal `clinic_member_perms_*` em `src/hooks/useStaffPermissions.ts`. Junto vem `WebSocket is closed before the connection is established`, e a página trava porque o erro é lançado **durante a renderização inicial** (no useEffect do hook que roda em toda página autenticada).

A correção anterior (sufixo `Math.random()` no nome do canal) não resolveu porque o problema raiz é outro: o `useEffect` está disparando antes da sessão do Supabase estar pronta, e em alguns casos o canal é reaproveitado/atrapalhado pelo ciclo do StrictMode + reconexão do WebSocket, fazendo o SDK tentar reanexar `.on()` num canal que já passou por `.subscribe()`.

## Plano

1. **Blindar o `useEffect` do `useStaffPermissions`** com `useRef` para garantir que o setup do canal aconteça **uma única vez por par (user, clinic)**, mesmo no double-invoke do StrictMode, e que o cleanup só remova o canal que ele próprio criou.

2. **Esperar a sessão estar pronta** antes de criar o canal: só chamar `supabase.channel(...).on(...).subscribe()` quando houver `user.id` E `currentClinicId` E o cliente Supabase já tiver sessão hidratada (checagem rápida via `supabase.auth.getSession()` antes do subscribe — sem await dentro de listener).

3. **Tornar o Realtime opcional/silencioso**: se a criação do canal falhar (ex.: WebSocket fechado), capturar o erro, logar em `console.warn` e seguir apenas com o `refetchInterval: 30000` que já existe. Isso garante que a página **nunca trave** por causa do canal de permissões.

4. **Não mexer em nada além de `src/hooks/useStaffPermissions.ts`** — o resto do app (login, AuthContext, outras subscriptions) já está funcionando.

### Detalhes técnicos

```ts
const setupRef = useRef<{ key: string; channel: any } | null>(null);

useEffect(() => {
  if (!isStaff || !user?.id || !currentClinicId) return;
  const key = `${user.id}:${currentClinicId}`;
  if (setupRef.current?.key === key) return; // já montado para esse par

  let cancelled = false;
  let channel: any = null;

  (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session) return;

      channel = supabase
        .channel(`clinic_member_perms_${key}_${Date.now()}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'clinic_members', filter: `user_id=eq.${user.id}` },
          () => queryClient.invalidateQueries({ queryKey: ['staff-permissions', user.id, currentClinicId] }))
        .subscribe();

      setupRef.current = { key, channel };
    } catch (err) {
      console.warn('[useStaffPermissions] realtime indisponível, usando polling', err);
    }
  })();

  return () => {
    cancelled = true;
    if (channel) supabase.removeChannel(channel);
    if (setupRef.current?.channel === channel) setupRef.current = null;
  };
}, [isStaff, user?.id, currentClinicId, queryClient]);
```

O `refetchInterval: 30000` já existente continua sendo o fallback caso o Realtime não suba.

## Resultado esperado

- Login não trava mais; nenhum erro fatal no console.
- Permissões da secretária continuam sincronizando (via Realtime quando disponível, via polling de 30s sempre).