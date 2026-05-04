# Teste E2E Final — Sprint 1

Objetivo: validar, sem intervenção manual, todo o fluxo de agendamento paciente↔clínica antes de fechar a Sprint 1.

## Estratégia

Como o fluxo cruza UI do paciente, UI da clínica e regras de negócio no Edge Function `request-appointment` + triggers SQL, a validação será feita em duas camadas combinadas:

1. **Camada de regras** (rápida, determinística): chamadas diretas ao edge function `request-appointment` via `supabase--curl_edge_functions` + leituras com `supabase--read_query` para confirmar estado das tabelas após cada passo.
2. **Camada de UI** (smoke): navegação no preview com browser tools para confirmar que o grid de horários, notificações e telas de aprovação refletem o estado correto.

Os testes usam um paciente e uma clínica reais já existentes no banco (identificados por consulta antes de começar). Nenhum dado é deletado — apenas marcado como `cancelled` ao final, exatamente como em produção.

## Cenários a validar

```text
1. Solicitação            paciente cria request    -> appointment_requests.status = pending
2. Recusa                 clínica recusa           -> request.status = rejected
                                                    grid libera o slot
3. Conflito mesmo dia     paciente tenta de novo   -> 409 patient_overlap (após aprovação no passo 4)
4. Aprovação              clínica aprova           -> appointment criado, request.status = approved
5. Cancel pelo paciente   paciente cancela request -> trigger cancela appointment automaticamente
6. Cancel pela clínica    clínica cancela appt     -> trigger cancela request automaticamente
7. Liberação de slot      após cada cancel/recusa  -> horário some das ocupações no grid
```

## Passos do agente (em build mode)

### Setup
- `read_query`: localizar 1 clínica ativa, 1 dentista membro dessa clínica, 1 paciente com `patient_user_id` preenchido. Capturar IDs.
- `read_query`: escolher uma data futura (D+2) e 3 horários distintos (08:00, 09:00, 10:00 BRT) que estejam livres para o dentista escolhido.

### Execução dos cenários
Para cada cenário, usar `supabase--curl_edge_functions` quando partir do paciente (chama `request-appointment`) e `read_query` + insert tool para simular ações da clínica/triggers (UPDATE em `appointment_requests`/`appointments`).

Após cada passo:
- `read_query` em `appointment_requests` e `appointments` filtrando pelos IDs gerados.
- Asserção: status esperado bate com observado.
- Para "liberação de slot": rodar a mesma query usada por `ClinicDoctorStep` (requests `pending`/`approved` + appointments não-cancelados) e confirmar que o horário não aparece.

### Validação de UI (smoke)
- `browser--navigate_to_sandbox` em `/paciente/agendar` logado como paciente de teste — confirmar que slot recusado/cancelado volta a aparecer disponível.
- `browser--navigate_to_sandbox` em `/clinica/aprovacoes` — confirmar que pedido pendente aparece e que ações refletem.

### Cleanup
- Cancelar todos os registros criados pelo teste (`status = cancelled`) para não poluir a agenda real.

## Entregável

Um relatório no chat com tabela:

| # | Cenário | Esperado | Observado | Status |

Mais qualquer bug encontrado e a correção aplicada (se houver).

## Detalhes técnicos

- Edge function alvo: `supabase/functions/request-appointment/index.ts` (já valida `patient_overlap_appointment`, `patient_overlap_request`, conflito de doutor).
- Triggers já existentes: `sync_request_on_appointment_cancel`, `sync_appointment_on_request_cancel` — testados pelos passos 5 e 6.
- Sem alterações de schema. Sem alterações de código a menos que o teste revele bug.
- Auth token do paciente para `curl_edge_functions`: aproveitar sessão do preview se o paciente de teste estiver logado; caso contrário, executar via `service_role` simulando a chamada com header de Authorization válido (impersonating via JWT do usuário paciente lido do `auth.users` — se não viável, faço signup/login programático de um paciente dedicado de teste).

Aprove para eu executar o teste.