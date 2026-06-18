# Padronização visual das abas do atendimento

Hoje, as abas **Visão Geral**, **Sinais Vitais**, **Solicitações** e **Odontograma** já renderizam um `Card` branco com borda suave (padrão do sistema). Já **Avaliação**, **Diagnóstico**, **Conduta**, **Procedimentos**, **Evolução** e **Documentos** aparecem "soltos" dentro da coluna, sem o mesmo card de contorno — quebrando o padrão visto nos prints.

## O que será feito

Em `src/pages/Attendance.tsx`, dentro de `renderSection()`, envolver as 6 seções inconsistentes em um wrapper `Card` idêntico ao usado nas outras (`border-border/50 shadow-card`) **sem alterar o conteúdo interno dos componentes**:

- `assessment` → envolver `<AssessmentForm/>` em `Card` com header "Avaliação clínica".
- `diagnosis` → envolver `<HypothesesEditor/>` em `Card` com header "Diagnóstico".
- `conduct` → envolver `<FollowUpBlock/>` em `Card` com header "Conduta e retorno".
- `procedures` → manter o Card já existente, apenas alinhar título/spacing ao padrão dos demais (`CardTitle` em `text-base font-semibold`, em vez de `text-sm muted`).
- `notes` (Evolução) → ajustar os dois Cards existentes para o mesmo padrão de title.
- `documents` → envolver `<DocumentsTab/>` em `Card` com header "Documentos".

Também alinhar todos os títulos de seção (incluindo Visão Geral / Sinais Vitais / Solicitações se necessário) para o mesmo estilo: `CardHeader` com `CardTitle` "text-base font-semibold text-foreground" + descrição opcional em `text-xs text-muted-foreground`, de modo que todas as abas tenham a **mesma moldura, mesmo espaçamento e mesma tipografia** de cabeçalho.

## Fora do escopo

- Não alterar lógica de formulários, validações, salvamento, RLS, edge functions, gravação, odontograma interno, prontuário lateral, timer ou botões superiores.
- Não mexer em `specialtyProfile` nem adicionar/remover abas.
- Não trocar ícones do menu lateral.

## Resultado esperado

Ao navegar entre **Visão Geral → Avaliação → Sinais Vitais → Diagnóstico → Conduta → Solicitações → Procedimentos → Evolução → Odontograma → Documentos**, todas as abas terão o mesmo "cartão" de fundo, mesma borda, mesmo padding e mesmo título — mantendo a estética Apple/iOS minimalista do sistema.
