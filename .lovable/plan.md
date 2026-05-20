## Objetivo
Dar ao médico um ponto de entrada visível para digitar o código de 6 dígitos que recebeu de outro profissional. Hoje a tela `/prontuario/compartilhado` existe, mas só é acessível por link direto.

## Mudança
Arquivo: `src/pages/OpenChart.tsx`

- No header da página (ao lado do título "Prontuários" / campo de busca), adicionar um botão secundário:
  - Ícone: `KeyRound` (lucide) + label "Abrir prontuário compartilhado"
  - Em telas pequenas: ícone + label curto ("Resgatar código") ou só ícone com tooltip
  - Ação: `navigate('/prontuario/compartilhado')`
- Manter o estilo minimalista existente (variant `outline`, mesmo tamanho do botão de novo paciente, se houver)

## Fora do escopo
- Modal embutido (decisão: navegar para a página existente)
- Mudanças no fluxo de resgate em si (`PatientChartRedeem.tsx` continua igual)
- Adicionar atalho no Command Palette ou no menu lateral (pode entrar em iteração futura)

## Verificação
- Botão aparece no topo de `/prontuarios`
- Clique leva para `/prontuario/compartilhado` com a tela atual de digitar código
- Funciona em mobile (não quebra layout do header)
