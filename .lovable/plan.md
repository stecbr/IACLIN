## Contexto

Fluxo testado: paciente **Flavio** gerou o código no `/paciente`; o médico, logado na conta da **Cássia**, abriu `/prontuario/compartilhado`, redimiu o código e clicou em **"Adicionar aos meus pacientes" → Confirmar**. A edge function `import-shared-patient` retorna **500** mas o cliente só vê *"Edge Function returned a non-2xx status code"*.

Investigação:
- Logs da função `import-shared-patient` mostram apenas `boot/shutdown`. O `catch` final devolve a mensagem em JSON, mas **não chama `console.error`**, então o motivo real do 500 não aparece em lugar nenhum (nem no toast nem nos Edge Logs).
- O schema das tabelas (`patients`, `clinical_records`, `anamneses`, `clinical_map_entries`, `odontogram_entries`, `documents`, `patient_chart_shares`) é compatível com os inserts.
- Pontos suspeitos no código atual:
  1. A query "existe paciente?" reaproveita o `query builder` `q` entre dois `await`s diferentes — pode disparar `maybeSingle()` retornando erro silencioso.
  2. Tabelas como `clinical_map_entries` têm `CHECK (severity in 'low'|'medium'|'high')`; valores de origem fora desse conjunto quebram o insert e estouram tudo num único try.
  3. Se `clinical_record_procedures.procedure_id` aponta para um procedimento global que foi removido, o insert quebra.
  4. Todas as cópias estão dentro de um único `try`, então **uma falha pontual aborta a importação inteira**.

## O que vamos ajustar

### 1. `supabase/functions/import-shared-patient/index.ts`
- Adicionar `console.error('[import-shared-patient] step=<x>', err)` em cada etapa: busca do share, busca do anchor, validação de clínica, insert do paciente, anamnese, registros, procedimentos, requests, odontograma, mapa, documentos.
- Refatorar a busca de paciente existente para **criar um novo query builder por chamada** (não reaproveitar `q`).
- Quebrar as cópias em **try/catch individuais por bloco**, logando o erro mas seguindo para o próximo (importação resiliente).
- Sanitizar `severity` em `clinical_map_entries` (`['low','medium','high'].includes(x) ? x : null`).
- Garantir tipos numéricos: `Number(p.price ?? 0)`.
- Manter a etapa final (`patient_chart_shares.update consumed`) mesmo se algum sub-bloco falhar.
- Retornar no JSON, além de `patient_id`, um array `warnings: string[]` com os blocos que falharam, para mostrar no toast.

### 2. `src/pages/PatientChartRedeem.tsx`
- Esconder o botão **"Adicionar aos meus pacientes"** quando o usuário logado for **o próprio dono do prontuário** (`data.patient_user_id === user.id`) — não faz sentido importar para si.
- Quando `clinics.length === 0`, esconder o botão (sem clínica de destino não há onde importar).
- No catch do `runImport`, exibir no toast o `data.error` real (já vem no body do 500 da função) em vez da mensagem genérica.
- Se a função retornar `warnings`, mostrar toast `success` + descrição listando os blocos que não foram copiados.

### 3. Validação
- Logar como Cássia, redimir o código gerado pelo Flavio, importar. Verificar:
  - paciente aparece em `/pacientes` da clínica da Cássia,
  - histórico (`atendimentos`, anamnese, mapa, documentos) replicado,
  - `patient_chart_shares.consumed_at` preenchido,
  - Edge Logs da função mostrando `step=...` em caso de erro.
- Logar como Flavio (próprio dono) → botão **não** deve aparecer.

## Arquivos afetados
- `supabase/functions/import-shared-patient/index.ts`
- `src/pages/PatientChartRedeem.tsx`

Sem novas migrações.
