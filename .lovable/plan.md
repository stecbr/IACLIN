## Causa raiz

Ao finalizar o atendimento, `Attendance.tsx` dispara em background `archiveAttendanceFiles(...)`, que gera vários PDFs (resumo, receituário, exames, encaminhamentos) via `htmlToPdfBlob`. Cada chamada injeta um `<iframe>` no DOM com:

```ts
iframe.style.position = 'fixed';
iframe.style.left = '0';
iframe.style.top = '0';
iframe.style.width = '794px';
iframe.style.height = '1123px';
iframe.style.zIndex = '-1';
```

`z-index: -1` deixa o iframe atrás do conteúdo, mas no instante em que a rota muda para `/agenda` o root da nova página ainda não pintou um fundo opaco por cima dele — então o iframe (logo centralizado, cabeçalho preto-e-branco do PDF) aparece piscando até `iframe.remove()` rodar no `finally`.

O `setTimeout(220ms)` antes do `navigate('/agenda')` no `AttendanceSummaryModal` não resolve, porque os PDFs continuam sendo gerados depois que o modal fecha.

## Correção

Posicionar o iframe fora da viewport em `src/lib/htmlToPdfBlob.ts`, de forma que ele nunca seja visível mesmo durante transições de rota. `html2canvas` clona o elemento em um sandbox próprio para capturar, então o posicionamento real na tela não afeta o PDF gerado.

Mudar:

```ts
iframe.style.position = 'fixed';
iframe.style.left = '0';
iframe.style.top = '0';
// ...
iframe.style.zIndex = '-1';
```

para:

```ts
iframe.style.position = 'fixed';
iframe.style.left = '-10000px';
iframe.style.top = '0';
// ...
iframe.style.zIndex = '-1';
iframe.style.opacity = '0';
```

Isso elimina o flash de logo/cabeçalho do PDF durante a transição Atendimento → Agenda, sem alterar o conteúdo do PDF nem o fluxo de finalização. Nenhuma outra mudança é necessária (o `setTimeout` no modal pode continuar para a animação do Dialog).

## Arquivos alterados

- `src/lib/htmlToPdfBlob.ts` — ajuste do posicionamento/opacidade do iframe de renderização.
