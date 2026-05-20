## Objetivo
1. Na tela de resgatar código (`/prontuario/compartilhado`), adicionar botão "Voltar" para o médico que abriu por engano poder sair.
2. Após digitar o código, em vez de abrir um PDF para impressão/salvamento, mostrar o prontuário em uma **visualização inline** dentro da própria página, sem opção de salvar/imprimir/baixar.

## Mudanças

### 1. `src/pages/PatientChartRedeem.tsx`
- Adicionar botão "Voltar" no topo (ícone `ArrowLeft` + label), antes do card, que executa `navigate(-1)` (fallback para `/prontuarios`).
- Após resposta da edge function `redeem-patient-chart`, **não** chamar `openFullChartPdf`. Em vez disso, guardar o resultado em estado e renderizar o conteúdo numa view de leitura.
- Criar um componente local `<SharedChartViewer data={...} onClose={...} />` (mesmo arquivo, ou novo `src/components/patients/SharedChartViewer.tsx`) que renderiza o mesmo HTML hoje gerado pelo `generateFullChartPdf`, mas dentro do React/Tailwind, sem ações de imprimir/baixar.
- Restrições anti-salvamento (best-effort, deixar claro que é frontend):
  - `user-select: none` e `pointer-events` controlados no container
  - `onContextMenu={(e) => e.preventDefault()}` para desabilitar menu de contexto
  - `@media print { body { display: none } }` aplicado enquanto a view está aberta
  - **Não** incluir botão de imprimir, baixar PDF ou copiar
- Aviso visível no topo: "Acesso somente leitura. Não é permitido salvar nem imprimir."
- Botão "Fechar" volta ao estado de input do código (limpa `data` e `code`).

### 2. `src/lib/generateFullChartPdf.ts`
- Extrair a função que monta o **HTML do prontuário** (linhas ~111-220) numa função exportada `renderFullChartHtml(data: FullChartData): Promise<string>` para reaproveitar no novo viewer. `openFullChartPdf` continua existindo (usada em `PatientDetail.tsx`) e passa a chamar `renderFullChartHtml`.
- Alternativa mais simples: criar `renderFullChartSections(data)` retornando JSX/strings prontas para o viewer React. Vou optar pela **mesma string HTML** sendo injetada via `dangerouslySetInnerHTML` num container estilizado (mais rápido e mantém paridade visual com o PDF).

## Fora do escopo
- Bloqueio real de print screen / DevTools (impossível no frontend; só comunicar via UX).
- Marca d'água com nome do médico que resgatou (pode ser iteração futura).
- Mudar a edge function `redeem-patient-chart` (continua retornando o mesmo JSON).
- Mexer no fluxo do `PatientDetail.tsx` (PDF do dono do prontuário continua igual).

## Verificação
- `/prontuario/compartilhado` mostra botão "Voltar" e volta para a tela anterior.
- Ao digitar código válido, **não** abre nova aba/PDF; o prontuário aparece inline na mesma página.
- Sem botões de imprimir/baixar/copiar; menu de contexto desabilitado; `Ctrl+P` resulta em página em branco.
- Botão "Fechar" retorna à tela de digitar código.