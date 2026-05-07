## Timer de consulta + indicador "em consulta" global

Hoje, ao abrir `/atendimento/:id`, marcamos `appointments.status = 'in_progress'` e `presence_status = 'in_service'`, mas não há cronômetro visível, nem registro do tempo total no histórico, nem indicador quando o médico sai da tela. Vamos resolver os três pontos.

### O que muda para o usuário

1. **Cronômetro na tela de atendimento**: ao entrar em `/atendimento/:id`, um cronômetro grande (HH:MM:SS) começa a contar automaticamente, com botões Pausar/Retomar. Continua correndo mesmo se o médico recarregar a página (persistência via `service_started_at` que já existe no banco).
2. **Barra global "Em consulta"**: enquanto houver um atendimento ativo, aparece uma barrinha discreta no topo do app (logo abaixo do header) em qualquer rota: "Em consulta com {Nome do paciente} · 00:12:34 · Voltar". Cor de destaque sutil (primary), animação fade.
3. **Botão flutuante de retorno**: bolinha redonda flutuante (canto inferior-direito, acima do bottom nav mobile) com ícone de estetoscópio + tempo decorrido, que leva de volta para `/atendimento/:id`. Aparece em todas as rotas exceto na própria tela de atendimento.
4. **Tempo salvo no histórico**: ao finalizar o atendimento (botão Salvar/Concluir já existente), o tempo total é gravado em `clinical_records.procedure_duration_seconds` (coluna já existe). Aparece formatado como "Duração: 42min" no Histórico do paciente (timeline) e nos cartões de prontuário.

### Como funciona tecnicamente

**Estado global do atendimento ativo** — novo hook `useActiveConsultation`:
- Faz query nos `appointments` do user logado com `presence_status = 'in_service'` e `status = 'in_progress'`, ordenado pelo mais recente.
- Retorna `{ appointment, patientName, startedAt, elapsedSeconds, isPaused }`.
- Recalcula `elapsedSeconds` a cada segundo via `setInterval` enquanto não pausado.
- Pausa armazenada em `localStorage` (chave `consultation-pause-{appointmentId}`) com `{ pausedAt, accumulatedPausedMs }` — não precisa migration.

**Início do timer**: o `useEffect` em `Attendance.tsx` que já marca `in_service` passa a também gravar `service_started_at = now()` quando ainda for null. Já existe trigger `sync_appointment_presence_status` que faz isso, mas vamos garantir explicitamente para o caso de já estar `in_service`.

**Componente `ConsultationTimer`** (novo, em `src/components/attendance/ConsultationTimer.tsx`):
- Mostra HH:MM:SS grande, botões Pausar/Retomar.
- Inserido no topo de `Attendance.tsx`, ao lado do título.

**Componente `ActiveConsultationBar`** (novo, em `src/components/ActiveConsultationBar.tsx`):
- Barra fina sticky no topo. Usa `useActiveConsultation` + `useLocation`.
- Não renderiza se rota atual é `/atendimento/...` (já tem o timer principal).
- Renderiza dentro de `AppLayout` logo após o `<header>`.

**Componente `FloatingConsultationButton`** (novo, em `src/components/FloatingConsultationButton.tsx`):
- Botão circular `fixed bottom-24 right-4 md:bottom-6`, z-50, gradient primary, com ícone Stethoscope e tempo abaixo em fonte mono pequena.
- Pulso sutil (Framer Motion).
- Some na rota `/atendimento/...`.
- Adicionado em `AppLayout`.

**Persistência ao salvar** — em `Attendance.tsx`, `handleSave` (e no fluxo de "Concluir atendimento"):
- Calcula `elapsed = (now - service_started_at) - pausedMs`.
- Adiciona `procedure_duration_seconds: elapsed` ao `recordPayload` ao fazer upsert em `clinical_records`.
- Limpa o `localStorage` da pausa ao concluir.

**Exibição no histórico**:
- `src/components/patients/PatientTimeline.tsx` (e/ou `PatientTimelineMulti.tsx`): onde renderiza um item de prontuário, se `procedure_duration_seconds` existir, exibe "⏱ 42min" abaixo do título.
- `HistoryDrawer.tsx` no atendimento: idem.

**Sem mudanças de banco**: todas as colunas necessárias já existem (`service_started_at`, `procedure_duration_seconds`, `presence_status`).

### Arquivos

Novos:
- `src/hooks/useActiveConsultation.ts`
- `src/components/attendance/ConsultationTimer.tsx`
- `src/components/ActiveConsultationBar.tsx`
- `src/components/FloatingConsultationButton.tsx`
- `src/lib/formatDuration.ts` (helper segundos → "1h 23min" / "00:12:34")

Editados:
- `src/components/AppLayout.tsx` — monta `ActiveConsultationBar` + `FloatingConsultationButton`.
- `src/pages/Attendance.tsx` — monta `ConsultationTimer`, garante `service_started_at`, salva `procedure_duration_seconds` no save.
- `src/components/patients/PatientTimeline.tsx` e `PatientTimelineMulti.tsx` — exibe duração.
- `src/components/attendance/HistoryDrawer.tsx` — exibe duração nos itens.

### Fora de escopo
- Não criamos página separada de relatório de tempo por médico (pode ser v2 — fácil agora que `procedure_duration_seconds` é populado consistentemente).
- Não pausamos automaticamente quando o médico fecha a aba: o cronômetro derivado de `service_started_at` continua "rodando" no servidor; pausa é manual.