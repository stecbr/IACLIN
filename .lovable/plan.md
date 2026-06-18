# Redesign da tela de Atendimento

Trazer a tela `/atendimento/:id` para o mesmo padrão visual e de navegação do `SettingsPage` (sidebar à esquerda + conteúdo à direita), mantendo o timer e os botões de ação fixos no topo e adicionando um modo "prontuário ao lado".

## Layout proposto

```text
┌───────────────────────────────────────────────────────────────────┐
│ ← Voltar    [Histórico] [Gravar] [Salvar] [Finalizar]             │  topo (igual hoje)
├───────────────────────────────────────────────────────────────────┤
│ ⏱ Timer da consulta (igual hoje)                                  │
├───────────────────────────────────────────────────────────────────┤
│ 👤 Paciente · data · convênio          [Ver prontuário ao lado ▸] │  header do paciente
├───────────────────────────────────────────────────────────────────┤
│ Nav lateral        │  Conteúdo da seção          │  (Prontuário)  │
│ ─────────────────  │  ─────────────────────────  │  painel lateral│
│ ◉ Visão Geral      │                             │  abre/fecha    │
│ ○ Avaliação        │                             │  com resumo +  │
│ ○ Sinais Vitais    │                             │  link "abrir   │
│ ○ Diagnóstico      │                             │  completo"     │
│ ○ Conduta          │                             │                │
│ ○ Solicitações     │                             │                │
│ ○ Procedimentos    │                             │                │
│ ○ Evolução         │                             │                │
│ ○ Odontograma*     │                             │                │
│ ○ Documentos       │                             │                │
└───────────────────────────────────────────────────────────────────┘
* Odontograma só aparece para famílias com `showToothProcedures`
  (regra atual de `specialtyProfile`).
```

A largura máxima atual (`max-w-4xl`) sobe para algo próximo de `max-w-7xl` para acomodar nav + conteúdo + painel lateral sem perder respiro.

## Mudanças

1. **`src/pages/Attendance.tsx`**
   - Remover `Tabs/TabsList/TabsTrigger/TabsContent`.
   - Adicionar `activeSection` (state) inicializado com a primeira chave de `tabKeys` (já vem por especialidade).
   - Renderizar nav lateral no mesmo estilo de `SettingsPage` (`flex md:flex-col gap-1 md:w-56`, `bg-primary/10 text-primary` ativo, ícones do `lucide-react` por seção).
   - Mapa de ícones por chave de aba (ex.: Visão Geral → `LayoutDashboard`, Avaliação → `ClipboardList`, Sinais Vitais → `Activity`, Diagnóstico → `Stethoscope`, Conduta → `FileText`, Solicitações → `FlaskConical`, Procedimentos → `ListChecks`, Evolução → `NotebookPen`, Odontograma → ícone dental já usado, Documentos → `Folder`). Usa os labels existentes em `ATTENDANCE_TAB_LABELS` e respeita ordem de `specialtyProfile.attendanceTabs`.
   - Trocar os `<TabsContent>` por um `switch (activeSection)` que renderiza o mesmo conteúdo de cada aba (sem mudar nenhum form/lógica).
   - O contador atual `(N)` em Solicitações/Procedimentos vira um `Badge` discreto no item de nav.
   - O `forceMount` que existia em `documents` deixa de ser necessário (não há mais Tabs); o `DocumentsTab` continua montando ao entrar na seção. Se houver estado interno que precisa persistir entre seções, mantenho-o montado sempre, apenas escondido via `hidden` (igual ao padrão atual).

2. **Painel lateral "Prontuário ao lado"**
   - Botão no header do paciente: `Ver prontuário ao lado` (substitui o atual link "Ver prontuário completo", que continua disponível como "Abrir em nova aba" dentro do painel).
   - Quando aberto, o grid vira `nav | conteúdo | painel` (`lg:grid-cols-[14rem_minmax(0,1fr)_22rem]`). Em telas menores que `lg`, o painel abre como `Sheet` lateral (shadcn) para não quebrar layout.
   - Conteúdo do painel: reutiliza o `PatientOverviewTab` existente (mesmo componente da aba Visão Geral) + atalho "Abrir prontuário completo" (target `_blank`, igual hoje).
   - Estado `showChartSide` persistido em `sessionStorage` (`attendance_chart_side_${appointmentId}`) para manter a escolha enquanto o médico navega entre seções.

3. **Timer e botões de ação**
   - Permanecem exatamente onde estão (acima do header do paciente). Nenhuma mudança de lógica em `ConsultationTimer`, gravação, salvar, finalizar.
   - `HistoryDrawer` continua disponível como hoje (não é o mesmo que o painel lateral de prontuário — ele mostra atendimentos passados; mantenho).

4. **Responsivo / mobile**
   - Igual ao `SettingsPage`: em `< md` a nav vira uma faixa horizontal scrollável no topo do bloco; o conteúdo ocupa toda a largura; o painel lateral só aparece em `lg+` (em telas menores, abre como `Sheet`).

## Fora do escopo

- Nenhuma mudança em forms, validações, RLS, edge functions, prontuário completo, odontograma, gravação ou fluxo de finalizar/pagamento.
- Sem mexer em `specialtyProfile` (ordem e visibilidade das seções continuam vindo de lá).
- Sem trocar libs (continua `framer-motion` se necessário, sem novas dependências).

## Validação

- Abrir `/atendimento/:id` como dentista (odonto) → ver Odontograma na nav.
- Abrir como médico (família `medical`) → Odontograma não aparece, Procedimentos não aparece (regra atual mantida).
- Clicar em cada item da nav → conteúdo troca, timer e botões seguem no topo.
- Ativar "Ver prontuário ao lado" em `lg+` → painel à direita; em telas menores → abre como Sheet.
- Salvar/Finalizar continuam funcionando (sem regressão no draft em sessionStorage).
