# Plano

## 1. Orçamento — procedimento com texto livre

Hoje o campo "Procedimento" é um `Select` que só aceita itens do catálogo (`procedures`). Vou transformá-lo em um **combobox** (estilo busca) onde o usuário pode:
- escolher um item existente da lista, **ou**
- digitar um nome livre que não está no catálogo e usar exatamente o que digitou.

### Banco
Migration em `treatment_plan_items`:
- Tornar `procedure_id` **nullable**.
- Adicionar coluna `custom_procedure_name text` (nullable).
- Validação por trigger: pelo menos um dos dois (`procedure_id` ou `custom_procedure_name`) precisa estar preenchido.

### Frontend
- `src/components/budgets/BudgetFormDialog.tsx`:
  - Trocar o `Select` de procedimento por um `Popover + Command` (padrão shadcn combobox) com `CommandInput` filtrando o catálogo e um item final "Usar '<texto digitado>'" quando não houver match exato.
  - Estado do item passa a guardar `procedure_id?: string | null` **e** `custom_procedure_name?: string`.
  - Insert envia ambos os campos; auto-preenchimento de preço só ocorre quando seleciona do catálogo.
- `src/components/budgets/BudgetDetailDialog.tsx` e `BudgetCard.tsx`:
  - Exibir `custom_procedure_name` quando `procedure_id` for nulo (fallback para nome do procedimento do catálogo).

## 2. Gravação de consulta persistente entre telas

Hoje `useAudioRecorder` vive dentro de `RecordConsultationButton`. Ao navegar, o componente desmonta, o `useEffect cleanup` para o stream e a gravação morre. Vou **elevar a gravação para um contexto global**, deixando-a ativa até o usuário clicar no botão vermelho de finalizar.

### Arquivos
- **Novo** `src/contexts/RecordingContext.tsx`:
  - Provider único montado em `src/App.tsx` (acima das rotas).
  - Detém uma instância única de `useAudioRecorder` + metadados da sessão atual (`appointmentId`, `patientId`, `clinicalRecordId`, `clinicId`, `setters` opcionais).
  - Expõe: `state`, `start(meta)`, `pause`, `resume`, `finish()` (que devolve o blob), `isRecording`, `currentAppointmentId`.
- **Novo** `src/components/attendance/recording/GlobalRecordingBar.tsx`:
  - Lê do contexto; renderiza `RecordingFloatingBar` sempre que houver gravação ativa, **independente da rota**.
  - Cuida do fluxo de finalização (upload + edge function `transcribe-consultation` + dialog de resultados). Esse fluxo, hoje dentro do botão, é movido para cá para sobreviver à navegação.
- Refatorar `src/components/attendance/recording/RecordConsultationButton.tsx`:
  - Vira um botão "magro": apenas dispara `start` no contexto (com checagem de consentimento) ou `finish` quando a gravação atual pertence a este atendimento.
  - Não renderiza mais a `RecordingFloatingBar` nem o `ProcessingOverlay`/`RecordingResultsDialog` — esses ficam no provider global.
- `src/App.tsx`: envolver as rotas com `<RecordingProvider>` e montar `<GlobalRecordingBar />` no topo do layout.

### Garantias
- `useAudioRecorder` continua igual; só muda o **local** onde ele vive (uma vez, no provider) — o `cleanup` do `useEffect` não dispara mais ao navegar porque o provider permanece montado.
- Confirmação de saída do app (beforeunload) opcional quando houver gravação ativa, para evitar perder áudio ao fechar a aba.
- A gravação só termina ao clicar no botão vermelho (Finalizar) na barra flutuante.

## Fora de escopo
- Mudanças no schema de `procedures` ou no catálogo.
- Mudanças visuais na barra de gravação (mantém o design atual).
- Sincronizar a gravação entre abas do navegador.
