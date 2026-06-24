## Por que ainda não funcionou

Mesmo trocando o `throw` por fluxo linear, o overlay vermelho continua aparecendo porque o **próprio `supabase-js`** chama `console.error("Edge Function returned a non-2xx status code")` **dentro da lib**, antes do nosso código rodar. O overlay de runtime do preview do Lovable escuta `console.error` e abre a tela vermelha — não há como suprimir isso pelo cliente quando a edge function responde com status `409` / `4xx`.

A única forma confiável de eliminar o overlay é **não retornar status de erro** da edge function nesse caso esperado.

## Plano de correção (padrão fallback)

### 1. Edge function `supabase/functions/invite-member/index.ts`

Trocar a resposta de erro de "e-mail duplicado" (e dos outros erros de validação que o usuário pode acionar) de `4xx` para **`200`** com payload estruturado:

```json
{ "ok": false, "error": "Este e-mail já está cadastrado...", "code": "email_exists" }
```

Casos a converter para `200 + ok:false`:
- E-mail já cadastrado (hoje 409) → `code: "email_exists"`
- Senha curta (hoje 400) → `code: "weak_password"`
- Campos faltando (hoje 400) → `code: "missing_fields"`
- `role` inválido (hoje 400) → `code: "invalid_role"`
- Erro do `createUser` do auth admin (hoje 400) → `code: "create_failed"`

Mantém `4xx`/`5xx` apenas para erros realmente inesperados / não autorizados:
- `401 Unauthorized` (sem token / token inválido) — não é fluxo de UI.
- `403` (não é dono da clínica) — pode também virar `200 + ok:false, code:"forbidden"` para consistência. (Vou converter também, pra zerar o overlay.)
- `500` no `catch` final permanece (bug inesperado).

Sucesso continua `200` com `{ ok: true, user_id }`.

### 2. Cliente `src/components/settings/TeamSection.tsx`

Em `handleAdd`, após `supabase.functions.invoke(...)`:

```ts
const { data, error } = await supabase.functions.invoke('invite-member', { body: {...} });

if (error) {
  // agora só cai aqui em 401/500 reais — mostra toast genérico
  toast.error('Não foi possível adicionar o funcionário. Tente novamente.');
  setSaving(false);
  return;
}

if (data && data.ok === false) {
  const code = data.code as string | undefined;
  const msg  = data.error as string | undefined;
  if (code === 'email_exists') {
    setErrorDialog({ open: true, title: 'E-mail já cadastrado', message: msg ?? '...' });
  } else if (code === 'weak_password') {
    toast.error('A senha precisa ter ao menos 6 caracteres.');
  } else {
    toast.error(msg ?? 'Erro ao adicionar funcionário.');
  }
  setSaving(false);
  return;
}

// sucesso
```

Como o status passa a ser `200`, o `supabase-js` **não loga mais nada** no `console.error` e o overlay vermelho do preview não dispara. O `AlertDialog` aparece corretamente, tanto no preview quanto no app publicado.

## Arquivos alterados

1. `supabase/functions/invite-member/index.ts` — todos os erros de validação viram `200 + { ok:false, code, error }`.
2. `src/components/settings/TeamSection.tsx` — `handleAdd` passa a ler `data.ok === false` em vez de depender de `error`.

## Fora de escopo

- Nenhuma mudança em banco, RLS, outros componentes ou outras edge functions.