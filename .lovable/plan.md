## Problema

Ao tentar cadastrar um e-mail já existente, o modal de erro amigável ("E-mail já cadastrado") não aparece — em vez disso aparece o overlay vermelho de erro de runtime do ambiente de preview do Lovable ("The app encountered an error / Edge Function returned a non-2xx status code").

## Causa raiz

No `handleAdd` de `src/components/settings/TeamSection.tsx` fazemos:

```ts
const { data, error } = await supabase.functions.invoke(...)
if (error) throw error;
```

O `supabase-js` (ao receber um status non-2xx como 409) constrói um `FunctionsHttpError` e **loga ele no `console.error` automaticamente, dentro da própria lib**, antes mesmo do nosso `catch` rodar. O overlay de erro do preview do Lovable escuta `console.error`/erros não tratados e abre a tela vermelha — mesmo que nosso `catch` depois mostre o `AlertDialog`, o overlay fica por cima e o usuário só vê o erro feio.

Além disso, o `throw error` dentro do `try` também é capturado pelo overlay em alguns casos.

## Plano de correção (apenas frontend, 1 arquivo)

Editar `src/components/settings/TeamSection.tsx` → função `handleAdd`:

1. **Não usar mais `throw`.** Tratar `error` como dado, em fluxo linear, para o overlay não capturar nada.
2. **Ler o corpo real da resposta** (`error.context.response.clone().json()`) ainda dentro do bloco normal (não em `catch`), pegando `body.error` quando existir.
3. **Tratar todos os casos amigavelmente**:
   - E-mail duplicado (`409` ou mensagem contendo "já está cadastrado" / "already been registered" / "email_exists") → abrir `AlertDialog` com título "E-mail já cadastrado".
   - Senha curta → `toast.error("A senha precisa ter ao menos 6 caracteres.")`.
   - Outros → `toast.error(msg)` com fallback genérico em PT-BR.
4. **Manter o `AlertDialog` já adicionado** no JSX (sem mudanças).
5. **Não alterar** a edge function, banco, nem outros fluxos.

### Detalhe técnico (pseudo-código)

```text
const { data, error } = await supabase.functions.invoke('invite-member', { body });

let backendMsg: string | null = null;
if (error) {
  try {
    const resp = (error as any)?.context?.response;
    if (resp?.clone) backendMsg = (await resp.clone().json())?.error ?? null;
  } catch {}
  const msg = backendMsg ?? error.message ?? 'Erro ao adicionar funcionário.';
  const emailDup = /já está cadastrado|already been registered|email_exists/i.test(msg);
  if (emailDup) {
    setErrorDialog({ open: true, title: 'E-mail já cadastrado', message: '...' });
  } else if (/at least 6|6 caracteres/i.test(msg)) {
    toast.error('A senha precisa ter ao menos 6 caracteres.');
  } else {
    toast.error(msg);
  }
  return; // sem throw → overlay não dispara
}

if (data?.error) { /* mesmo tratamento */ return; }

// sucesso
toast.success(...);
```

## Observação importante para o usuário

O overlay vermelho "The app encountered an error" **só aparece no ambiente de edição/preview do Lovable**. Mesmo antes desta correção, no app publicado o usuário final não veria essa tela vermelha — veria o `AlertDialog` que eu já tinha adicionado. Esta correção garante que **nem no preview** o overlay apareça mais, deixando a experiência consistente nos dois ambientes.

## Fora de escopo

- Não vou mexer na edge function `invite-member` (ela já retorna 409 + JSON correto).
- Não vou tocar em RLS, banco ou outros formulários.