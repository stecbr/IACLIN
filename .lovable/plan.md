

# Plano: Estender horário da agenda para 00:00 – 23:59

## O que muda

A grade da agenda hoje vai de **07:00 às 19:00** (13 linhas). Vou estender para **00:00 às 23:00** (24 linhas), cobrindo o dia inteiro até 23:59.

## Arquivos editados

1. **`src/pages/Agenda.tsx`** (linha 24)
   - Trocar `const HOURS = Array.from({ length: 13 }, (_, i) => i + 7);`
   - Por `const HOURS = Array.from({ length: 24 }, (_, i) => i);`

2. **`src/components/agenda/AgendaCompareView.tsx`** (linha 7)
   - Mesma alteração para a visão de comparação entre médicos.

## Detalhes de UX

- A grade fica naturalmente rolável (já tem `overflow-y-auto` com `max-h-[calc(100vh-320px)]`), então as 24 linhas não quebram o layout.
- Ao abrir a agenda, o scroll inicial continua no topo (00:00). Posso adicionar um auto-scroll para o horário comercial (~07:00) ou para a hora atual ao montar o componente, se você quiser — mas por padrão já fica funcional.

## O que NÃO muda

- Lógica de criação/exibição de agendamentos (continua usando `getHours()`).
- Filtros, drag, e outras funcionalidades.
- Disponibilidade do profissional em `Availability.tsx` (controle separado).

