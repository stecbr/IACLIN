## Problema

O botão flutuante e a barra "Em consulta" dependem de uma query que busca no banco `appointments` com `status='in_progress'` para o `dentist_id = user.id`. Hoje isso falha em vários cenários:

1. O `UPDATE` que marca `status='in_progress'` na entrada do `/atendimento/:id` pode não ser executado/persistido (vimos no banco que o último appointment testado continua `status='scheduled'`, `service_started_at=null`).
2. Se o usuário logado não for o `dentist_id` do appointment (ex.: secretária testando, troca de papel via DevRoleSwitcher), a query nunca encontra nada.
3. Mesmo quando o servidor atualiza, há latência de até 5s (refetch interval) antes do FAB aparecer.

Resultado: o médico sai da tela `/atendimento/...` e nada aparece.

## Solução

Trocar a estratégia "fonte única no servidor" por **estado local persistente + sincronização com servidor em segundo plano**. Assim o FAB é instantâneo, sobrevive a refresh, e funciona independente de quem está logado.

### 1. Novo store local: `consultation-session`

Criar `src/lib/consultationSession.ts` com helpers:
- `startSession({ appointmentId, patientId, patientName, startedAt })` — grava em `localStorage` (chave `active-consultation`) um JSON com esses campos + `pausedAt`/`accumulatedPausedMs`.
- `endSession(appointmentId)` — limpa se for o ativo.
- `getSession()` / `subscribeSession(cb)` — leitura + listener via evento `storage` e um `CustomEvent('consultation-session-change')` para mudanças no mesmo tab.
- `pauseSession()` / `resumeSession()` — atualizam o JSON e disparam o evento.

### 2. Reescrever `useActiveConsultation`

- Ler primeiro de `getSession()` (sincrono, instantâneo).
- Se não houver sessão local mas o usuário tiver um appointment `in_progress` no servidor (query atual), hidratar o local com os dados do servidor (pega de volta após refresh em outra aba).
- Recalcular `elapsedSeconds` a cada 1s a partir de `startedAt` + pausa acumulada.
- Inscrever-se no `subscribeSession` para reagir imediatamente quando outra parte do app inicia/encerra.

### 3. `Attendance.tsx` — iniciar sessão imediatamente

No mesmo `useEffect` que marca `in_progress`:
- Antes do `await`, já chamar `startSession({ appointmentId, patientId, patientName, startedAt: now })`. Isso garante que **antes mesmo da query do servidor responder**, o FAB já apareça quando navegar para outra página.
- Disparar o `UPDATE` no servidor em paralelo (best-effort). Se falhar, manter sessão local e mostrar toast.
- Ao salvar/concluir o atendimento (`handleSave` com status final), chamar `endSession(appointmentId)` e limpar a pausa.

### 4. `ConsultationTimer.tsx`

Passar a usar `getSession()`/`subscribeSession()` em vez do prop `serviceStartedAt`. Os botões Pausar/Retomar chamam `pauseSession()`/`resumeSession()`. Assim o tempo na tela do atendimento e o tempo no FAB ficam sempre sincronizados.

### 5. `ActiveConsultationBar` e `FloatingConsultationButton`

Sem mudanças de UI, apenas passam a depender do hook reescrito. Como `getSession()` é síncrono, o FAB aparece no primeiro render após sair de `/atendimento/...`.

### 6. Persistência da duração no histórico

Continua igual: ao concluir, calcula `elapsed` a partir da sessão local (`startedAt` + pausas), grava em `clinical_records.procedure_duration_seconds`, depois `endSession`.

### 7. Recuperação ao reabrir

Se o médico fechar o navegador com sessão ativa:
- `localStorage` mantém os dados.
- Ao reabrir qualquer rota, o hook lê a sessão e o FAB aparece.
- Se ele clicar no FAB e voltar para `/atendimento/:id`, o `Attendance.tsx` detecta sessão existente e **não** sobrescreve o `startedAt` (mantém o tempo correto).

## Arquivos

Novos:
- `src/lib/consultationSession.ts`

Editados:
- `src/hooks/useActiveConsultation.ts` — reescrito para ler do localStorage + hidratar do servidor.
- `src/components/attendance/ConsultationTimer.tsx` — usa store em vez de prop.
- `src/pages/Attendance.tsx` — chama `startSession` imediatamente; `endSession` ao concluir.
- (opcional) `src/components/ActiveConsultationBar.tsx` e `FloatingConsultationButton.tsx` — sem mudança lógica, só conferir que renderizam quando o hook retorna sessão local mesmo sem servidor confirmado.

## Fora de escopo

- Não há mudanças de schema do banco.
- Não detectamos auto-pausa por inatividade — pausa continua manual.
- Múltiplas consultas simultâneas do mesmo médico não são suportadas (uma sessão local por vez); ao abrir um novo `/atendimento/...` enquanto outro está ativo, a sessão antiga é encerrada (com toast de aviso).
