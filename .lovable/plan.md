

# Plano: Modal de resumo do atendimento ao clicar em consulta concluída

## O que vai acontecer

Quando alguém (médico, clínica ou paciente) clicar numa consulta com status **Concluída** ou **Em atendimento**, abre um modal só-leitura com **todo o histórico clínico** que o médico preencheu durante o atendimento, organizado em seções limpas, mais botão para imprimir/exportar.

## Componente novo: `AttendanceSummaryModal`

Arquivo: `src/components/attendance/AttendanceSummaryModal.tsx`

Modal único reaproveitado em todos os contextos. Recebe `appointmentId` e busca em paralelo:

- `appointments` (com paciente, profissional, procedimento, clínica)
- `clinical_records` por `appointment_id` (com `clinical_record_procedures` e `clinical_record_requests` aninhados)

Layout em seções colapsáveis (todas abertas por padrão), exibindo apenas o que tem dado:

```text
┌─────────────────────────────────────────────────┐
│ [Avatar] Flavio Batista                         │
│         Cardiologia · Dr. Joel · 22/04 19:00    │
│         [Concluída]                             │
├─────────────────────────────────────────────────┤
│ ▸ Avaliação                                     │
│   Queixa principal · HDA · Duração · Exame      │
│ ▸ Sinais vitais                                 │
│   PA · FC · Temp · Sat · Glicemia               │
│ ▸ Diagnóstico                                   │
│   Hipóteses (badges) · Diagnóstico · Gravidade  │
│ ▸ Conduta                                       │
│   Plano · Retorno em DD/MM · Motivo             │
│ ▸ Solicitações (3)                              │
│   Exames, receitas, atestados (cards)           │
│ ▸ Procedimentos realizados (2)                  │
│   Lista com preço · total                       │
│ ▸ Evolução / Anotações                          │
├─────────────────────────────────────────────────┤
│ [Imprimir]                            [Fechar]  │
└─────────────────────────────────────────────────┘
```

Seções vazias aparecem como “Não informado” em cinza claro, em vez de sumirem totalmente, para deixar claro o que não foi preenchido.

Imprimir = `window.print()` com CSS específico que esconde o resto da UI.

## Onde plugar o modal

### 1. Médico e secretária (Agenda)
Arquivo: `src/components/agenda/AppointmentDetailDialog.tsx`

- Quando `status === 'completed'` ou `status === 'in_progress'`: trocar os botões de ação por um botão **“Ver resumo do atendimento”** que abre o `AttendanceSummaryModal`.
- Quando `status === 'completed'`: também esconder o botão “Iniciar atendimento” (já está) e mostrar o resumo como ação principal.
- Para `in_progress`: mostrar tanto “Continuar atendimento” quanto “Ver resumo parcial”.

### 2. Paciente (Minhas consultas)
Arquivo: `src/components/patient/AppointmentDetailDrawer.tsx`

- Adicionar uma nova seção “Resumo da consulta” quando `status === 'completed'`.
- Mostrar inline um preview compacto (queixa principal, diagnóstico, conduta, próximo retorno) e um botão **“Ver resumo completo”** que abre o `AttendanceSummaryModal`.
- Se ainda não houver `clinical_record` para a consulta concluída, mostrar mensagem amigável: “O médico ainda não publicou o resumo desta consulta.”

### 3. Painel do médico
Arquivo: `src/pages/dentist/DentistHome.tsx`

- Nos cards de “Próximas/Recentes consultas”, ao clicar numa consulta concluída, abrir o mesmo `AttendanceSummaryModal`.

### 4. Painel da clínica
Arquivo: `src/pages/clinica/ClinicaHome.tsx` (e onde a clínica lista atendimentos do dia)

- Mesma coisa: clicar na consulta concluída abre o modal.

## Permissões / RLS

A leitura já é coberta pelas policies existentes:

- **Médico/clínica**: `Clinic members can view clinical records` + `_procedures` + `_requests` via `user_belongs_to_clinic`.
- **Paciente**: `Patients can view own clinical records` + `Patients can view own record requests` (via join com `patients.patient_user_id = auth.uid()`). 

Ou seja, **nenhuma migration necessária**. O modal só faz `select`, e cada perfil verá só o que pode.

## Pequena melhoria de UX no Attendance

No `Attendance.tsx`, quando clica **Finalizar atendimento**, hoje ele só salva e volta para a agenda. Vou:

- Trocar o `toast.success('Atendimento finalizado!')` por um toast com ação “Ver resumo” que abre o `AttendanceSummaryModal` na hora — assim o médico já confirma visualmente o que foi gravado.

## Arquivos tocados

**Novo**
- `src/components/attendance/AttendanceSummaryModal.tsx`

**Editados**
- `src/components/agenda/AppointmentDetailDialog.tsx` — botão “Ver resumo” quando concluída/em andamento
- `src/components/patient/AppointmentDetailDrawer.tsx` — seção e botão de resumo quando concluída
- `src/pages/dentist/DentistHome.tsx` — abrir modal nos cards de consulta concluída
- `src/pages/clinica/ClinicaHome.tsx` — abrir modal nos cards de consulta concluída
- `src/pages/Attendance.tsx` — toast com ação “Ver resumo” após finalizar

## O que NÃO muda

- Tabela `clinical_records` e relacionadas — já guardam tudo (queixa, HDA, vitais, hipóteses, diagnóstico, conduta, retorno, solicitações, procedimentos, evolução).
- Fluxo de salvar em `Attendance.tsx` — já funcional.
- RLS — já permite leitura pelos 3 perfis.

## Resultado esperado

Ao clicar na consulta do Flavio (concluída) na agenda do Joel, abre o modal com tudo: queixa principal, diagnóstico, plano, procedimentos com preço, solicitações geradas. O Lucas (admin da clínica) vê o mesmo. O Flavio, em **/paciente/agendas**, vê o resumo da consulta dele com um botão para imprimir.

