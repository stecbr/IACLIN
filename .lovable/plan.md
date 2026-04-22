

# Plano: Tela de atendimento clínico completa (multiespecialidade)

Expandir a tela `/atendimento/:appointmentId` (`Attendance.tsx`) pra cobrir tudo que um profissional de qualquer especialidade preencheria numa consulta. Hoje ela tem só **Evolução**, **Procedimentos** e **Odontograma**. Vou adicionar os blocos clínicos completos, todos como **registro digital** (sem PDF agora — fica pra fase 2).

## Estrutura da tela (nova)

Manter o cabeçalho atual (paciente + ações Salvar/Finalizar), mas trocar as 3 tabs por **6 tabs progressivas** que seguem o fluxo natural de uma consulta:

```
┌──────────────────────────────────────────────────────────────────────┐
│ 👤 Lucas Ferreira  ·  21/04 14:30  ·  Consulta            [Salvar] [Finalizar]│
├──────────────────────────────────────────────────────────────────────┤
│ [1.Avaliação] [2.Sinais Vitais] [3.Diagnóstico] [4.Conduta]          │
│ [5.Solicitações] [6.Procedimentos] [7.Odontograma†]                  │
└──────────────────────────────────────────────────────────────────────┘
```
† Odontograma só aparece em clínica `category='odonto'` (regra que já existe no projeto).

### Tab 1 — Avaliação Clínica
- **Queixa principal** (texto curto)
- **História da doença atual / HDA** (textarea)
- **Duração dos sintomas** (input + select dia/semana/mês)
- **Antecedentes relevantes** (textarea — puxa anamnese do paciente como sugestão read-only no topo: alergias, medicações em uso, doenças)
- **Exame físico / inspeção** (textarea livre)

### Tab 2 — Sinais Vitais
Grid de inputs numéricos curtos:
- PA sistólica / diastólica (mmHg)
- FC (bpm), FR (rpm), Temperatura (°C), SpO₂ (%)
- Peso (kg), Altura (cm) → **IMC calculado automaticamente** com classificação
- Glicemia capilar (opcional)

### Tab 3 — Diagnóstico
- **Hipóteses diagnósticas** (lista — cada item tem texto livre + campo opcional pra CID-10 manual; sem busca de catálogo CID nessa fase, só campo de texto)
- **Diagnóstico definitivo** (textarea)
- **Severidade**: leve / moderado / grave (chips)

### Tab 4 — Conduta e Retorno
- **Plano terapêutico / orientações** (textarea longa)
- **Sugestão de retorno**: data picker + motivo (campo livre)
  - Botão "Agendar retorno agora" → abre o `AppointmentFormDialog` já com paciente e data preenchidos.

### Tab 5 — Solicitações (lista de itens estruturados)
Quatro accordions independentes dentro da tab, cada um com botão "+ Adicionar":

**5a. Exames laboratoriais** — lista de linhas: nome do exame (ex: "Hemograma completo"), justificativa (opcional), urgência (rotina/urgente).

**5b. Exames de imagem** — nome (ex: "Raio-X panorâmico"), região, justificativa.

**5c. Prescrições / Receita** — medicamento, concentração, posologia (ex: "1 cp 8/8h"), duração ("7 dias"), via (oral/tópica/etc), tipo (comum/controlada).

**5d. Encaminhamentos** — especialidade destino, motivo, urgência.

Cada item exibido como card compacto editável; botão lixeira pra remover.

### Tab 6 — Procedimentos realizados
Mantém igual ao que já existe (catálogo + dente + face + valor). Sem mudança.

### Tab 7 — Odontograma
Mantém o link existente pro odontograma do paciente. Só renderiza se a clínica é odonto.

## Modelo de dados (1 migration)

Tudo fica anexado ao `clinical_records` (que já existe). Crio **uma tabela JSONB-friendly** pra evitar 7 tabelas novas:

```sql
ALTER TABLE public.clinical_records
  ADD COLUMN chief_complaint text,
  ADD COLUMN history_present_illness text,
  ADD COLUMN symptom_duration text,
  ADD COLUMN physical_exam text,
  ADD COLUMN vital_signs jsonb,            -- {bp_sys, bp_dia, hr, rr, temp, spo2, weight, height, glycemia}
  ADD COLUMN hypotheses jsonb,             -- [{text, cid10}]
  ADD COLUMN severity text,                -- 'mild'|'moderate'|'severe'
  ADD COLUMN treatment_plan text,
  ADD COLUMN follow_up_date date,
  ADD COLUMN follow_up_reason text;

CREATE TABLE public.clinical_record_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinical_record_id uuid NOT NULL,
  kind text NOT NULL,                      -- 'lab_exam'|'imaging_exam'|'prescription'|'referral'
  payload jsonb NOT NULL,                  -- campos específicos do tipo
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clinical_record_requests ENABLE ROW LEVEL SECURITY;
-- policies: clinic members podem CRUD se forem membros da clínica do clinical_record pai
```

Por que JSONB pros sub-itens? Cada tipo tem campos diferentes (medicamento ≠ exame), e não tem busca/relatório complexo — JSONB é mais simples e flexível agora; se virar relatório depois, é só promover pra colunas.

## Integração com a Timeline do paciente

`PatientTimeline` (já existe) passa a buscar e mostrar:
- Atendimento finalizado: "Consulta — 21/04 — Dr. Felipe — 3 hipóteses, 2 prescrições, 1 exame solicitado"
- Cada item clicável abre o atendimento em modo leitura.

## Permissões

- **Médico (`dentist`)**: acesso completo, edita o próprio atendimento.
- **Admin/Secretária**: vê (read-only) atendimentos finalizados; **não cria/edita** (só o médico que atendeu).
- **Paciente**: vê na própria área (`PatientHistory`) um resumo do atendimento — diagnóstico, prescrições e retorno; sem campos internos como "exame físico".

## Arquivos tocados

**Editado**:
- `src/pages/Attendance.tsx` — reorganizar em 7 tabs; adicionar formulários novos (Avaliação, Vitais, Diagnóstico, Conduta, Solicitações); persistir no `clinical_records` + `clinical_record_requests`.
- `src/components/patients/PatientTimeline.tsx` — novos eventos vindos de `clinical_records` enriquecidos.
- `src/pages/patient/PatientHistory.tsx` — mostrar resumo da consulta pro paciente.

**Novos**:
- `src/components/attendance/VitalSignsForm.tsx` — grid de inputs com cálculo de IMC.
- `src/components/attendance/HypothesesEditor.tsx` — lista editável de hipóteses + CID.
- `src/components/attendance/RequestsEditor.tsx` — accordions de exames/receitas/encaminhamentos.
- `src/components/attendance/AssessmentForm.tsx` — bloco queixa/HDA/exame físico.
- `src/components/attendance/FollowUpBlock.tsx` — campo de retorno + botão pra agenda.

**Migration**:
- Adicionar colunas em `clinical_records` + criar `clinical_record_requests` com RLS espelhando `clinical_record_procedures`.

## O que NÃO entra agora

- **PDF de receita / atestado / pedido de exame** — fica pra fase 2 (você confirmou "só registro digital").
- **Atestado médico** — não está nos blocos priorizados; se quiser depois, é um 5º accordion na tab Solicitações (dias + CID).
- **Busca de catálogo CID-10** — campo livre por enquanto. Adicionar busca depois se precisar.
- **Envio por WhatsApp** dos documentos.
- **Assinatura digital**.
- Nenhum dado dos pacientes existentes é alterado; colunas novas aceitam NULL.

