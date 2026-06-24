## Problema

A confirmação do agendamento na tela "Confirmar consulta" demora alguns segundos porque a edge function `request-appointment` executa **9 queries sequenciais** ao banco antes de inserir o pedido — cada `await` espera o anterior terminar, somando latência desnecessária.

Sequência atual (cada linha = 1 round-trip):
1. `auth.getUser()`
2. `patient_accounts` (dados do paciente)
3. `profiles` (nome do dentista)
4. `patients` (IDs do paciente)
5. conflito: mesmo dia/mesmo dentista em `appointments`
6. conflito: mesmo dia/mesmo dentista em `appointment_requests`
7. conflito: overlap de horário do dentista em `appointments`
8. conflito: overlap de horário do dentista em `appointment_requests`
9. conflito: overlap do paciente com outro dentista em `appointments`
10. conflito: overlap do paciente com outro dentista em `appointment_requests`
11. `INSERT` em `appointment_requests`

A maioria dessas consultas é **independente** e pode rodar em paralelo.

## Solução

Refatorar `supabase/functions/request-appointment/index.ts` para executar em paralelo, mantendo exatamente a mesma lógica de validação e mensagens de conflito.

### Fase 1 — lookups iniciais em paralelo
Rodar com `Promise.all`:
- `patient_accounts` (dados do paciente)
- `profiles` (nome do dentista)
- `patients` (IDs vinculados ao usuário)

Reduz 3 round-trips para 1.

### Fase 2 — todas as 6 checagens de conflito em paralelo
Disparar as 6 queries com `Promise.all` e depois avaliar os resultados na mesma ordem de prioridade de hoje (para preservar a mensagem exata que aparece pro usuário em caso de múltiplos conflitos):

1. patient_overlap_appointment (mesmo dentista, mesmo dia)
2. patient_overlap_request (mesmo dentista, mesmo dia)
3. doctor overlap em `appointments`
4. doctor overlap em `appointment_requests`
5. patient overlap com outro dentista em `appointments`
6. patient overlap com outro dentista em `appointment_requests`

Quando um conflito de paciente×outro-dentista (#5 ou #6) for detectado, ainda precisamos do nome do outro profissional → buscar `profiles.full_name` **apenas** se esse caminho for acionado (1 query extra só nesse caso, raro).

Reduz 6 round-trips para 1 (caminho feliz: nenhum conflito).

### Fase 3 — replace + insert
Mantém igual. O `cancel` do replace (quando aplicável) continua antes das checagens, porque elas dependem do `replaceGuard` para ignorar o registro substituído. Isso já é o comportamento atual e é correto.

### Ganhos esperados
- Caminho feliz: de ~10 round-trips sequenciais para ~3 (auth → lookups paralelos → checagens paralelas → insert).
- Latência percebida no botão "Confirmar agendamento" deve cair de "alguns segundos" para sub-segundo em rede normal.

### Fora de escopo
- Não mexer no front-end (`SummaryStep`, `PatientBooking`) — a UI já mostra spinner "Confirmando..." durante a chamada.
- Não alterar contrato de resposta (mesmos códigos 200/400/409/500, mesma forma do payload `conflict`).
- Não alterar regras de negócio nem ordem de prioridade de mensagens de conflito.

## Arquivos alterados
- `supabase/functions/request-appointment/index.ts` — refatoração interna apenas.