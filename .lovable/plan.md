## Objetivo
Quando o convite de funcionário falhar porque o e-mail já existe (HTTP 409 do edge function `invite-member`), mostrar um **modal claro** ao usuário em vez de deixar o erro estourar como runtime error / tela em branco.

## Causa
Em `src/components/settings/TeamSection.tsx` (`handleAdd`), o retorno de `supabase.functions.invoke('invite-member', …)` para status não-2xx vem como `FunctionsHttpError`, cujo `error.message` é genérico ("Edge function returned a non-2xx status code"). O corpo JSON com a mensagem real (`{ error: "Este e-mail já está cadastrado…" }`) fica em `error.context.response` e não é lido — por isso o toast traduzido nunca dispara e o erro aparece como runtime error.

## Mudanças (apenas frontend)
Arquivo: `src/components/settings/TeamSection.tsx`

1. Adicionar estado `errorDialog` (`{ open, title, message }`) e renderizar um `<AlertDialog>` (shadcn) no final do componente para exibir o erro.
2. Em `handleAdd`, no `catch`:
   - Tentar extrair o body real do erro: `await err?.context?.response?.clone().json()` (com try/catch) e usar `body.error` quando existir.
   - Aplicar a mesma tradução PT-BR já existente (e-mail duplicado, senha curta).
   - Para o caso de **e-mail já cadastrado** → abrir o `AlertDialog` com título "E-mail já cadastrado" e a mensagem amigável (em vez de toast).
   - Para os demais erros, manter `toast.error(friendly)` como hoje.
3. Nenhuma alteração na edge function, no banco, ou em outros fluxos.

## Fora de escopo
- Não alterar `supabase/functions/invite-member/index.ts`.
- Não mexer em outros convites (médico/operadora) — o relato é específico do botão "Adicionar funcionário".
