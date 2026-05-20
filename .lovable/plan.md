## Objetivo
Gerar um código de compartilhamento de teste, válido por 5 minutos, para o paciente **Flavio Batista** (`c9483c6b-...`) — o mesmo que você está visualizando — para testar a tela `/prontuario/compartilhado`.

## Ação
Inserir uma linha em `patient_chart_shares` via `supabase--insert`:

- `code`: `123456`
- `patient_id`: `c9483c6b-6b05-40a7-a319-8dae28363bdc`
- `clinic_id`: `cf88a719-c991-4188-bbc9-e5f2d210d656`
- `created_by`: dono da clínica (lookup pelo `clinics.owner_id`)
- `expires_at`: `now() + interval '5 minutes'`

Depois é só digitar `123456` na tela de resgate.

## Fora do escopo
- Nenhuma mudança de código.
- Nenhuma mudança de schema.