# Bug: ficar "preso" na tela IA Gestor

## Causa

Em `src/pages/IaGestor.tsx` (linha 661) o container raiz usa:

```tsx
<div className="flex h-[calc(100vh-12rem)] md:h-[calc(100vh-8rem)] -m-4 md:-m-6 rounded-none overflow-hidden border-t border-border bg-background">
```

Os negativos `-m-4 md:-m-6` puxam o container para FORA do `<main>` do `AppLayout` — incluindo para a ESQUERDA (em cima do `AppSidebar` no desktop) e para BAIXO (em cima do `MobileBottomNav` no mobile). Como o container ainda tem `overflow-hidden` e ocupa quase toda a altura da viewport, ele acaba cobrindo links de navegação da sidebar/bottom nav, impedindo cliques — exatamente o "fico preso" que você descreveu.

Esse padrão de `-m-*` + `100vh - Xrem` é frágil: qualquer mudança de altura do header / `ActiveConsultationBar` / bottom nav desalinha tudo.

## Solução

Reescrever apenas o container raiz da página IaGestor para ocupar a área disponível do `<main>` sem usar margens negativas nem cálculos baseados em `100vh`:

1. Remover `-m-4 md:-m-6` e `h-[calc(100vh-Xrem)]`.
2. Fazer o `<main>` do `AppLayout` se comportar como flex container quando a rota for full-height (ou, mais simples e isolado: deixar IaGestor com `h-full min-h-0 flex` e garantir que o wrapper interno em `AppLayout` (motion.div) tenha `h-full`).
3. Aproveitar para ajustar `<main>` em `AppLayout.tsx` adicionando `flex flex-col min-h-0` ao container pai do `<main>` para que `h-full` se propague — sem afetar outras páginas (elas continuam com altura natural, scroll do main).

### Mudanças concretas

**`src/components/AppLayout.tsx`**
- No wrapper interno (coluna direita que contém header + main), garantir `flex flex-col h-screen min-h-0` (já é flex-col; só assegurar altura).
- No `<main>`, manter `flex-1 overflow-hidden` quando necessário, ou trocar `overflow` para que IaGestor controle seu próprio scroll. Para não quebrar outras páginas, manter `<main>` com `overflow-y-auto` e fazer IaGestor caber dentro dele via `h-full`.

**`src/pages/IaGestor.tsx`** (linha 661)
- Substituir o container raiz por:
  ```tsx
  <div className="flex h-full min-h-[600px] rounded-lg overflow-hidden border border-border bg-background">
  ```
  (ou usar `h-[calc(100vh-9rem)]` mas SEM `-m-*` — limita-se à área de conteúdo).
- Remover negative margins. Assim a página fica contida dentro do padding do `<main>` e não cobre sidebar nem bottom nav.

### Verificação

- Abrir `/ia-gestor`, confirmar que é possível clicar em qualquer item da sidebar do app e do bottom nav mobile.
- Confirmar que o chat e a sidebar interna do IA Gestor continuam visíveis e com scroll independente.
- Testar em 994×656 (viewport atual do usuário) e em mobile.

## Arquivos afetados

- `src/pages/IaGestor.tsx` — container raiz (1 linha).
- `src/components/AppLayout.tsx` — possivelmente ajustar `<main>` para propagar altura (opcional, só se necessário).
