# Prontuário Inteligente — Atendimento do Dentista

Evolução da tela `/attendance/:appointmentId` para um fluxo focado em odontologia, sem quebrar as outras especialidades.

## 1. Cabeçalho do paciente com alertas críticos

Em `src/pages/Attendance.tsx` (Patient Header) adicionar uma faixa de **Anamnese Rápida** que carrega `patient_anamnese` (allergies, medical_conditions, medications) e mostra:

- Badge vermelho pulsante quando há alergias → "⚠ Alergias: Penicilina, Látex"
- Badge âmbar quando há condições crônicas → "Hipertensão, Diabetes"
- Badge cinza com medicações em uso

Componente novo: `src/components/attendance/PatientAlertsBar.tsx` (reaproveita a query já existente em `AssessmentForm.tsx`). Ficará logo abaixo do nome do paciente, sempre visível.

## 2. Linha do Tempo lateral (histórico progressivo)

Novo componente `src/components/attendance/HistoryDrawer.tsx`:

- Botão flutuante "Histórico" no canto direito do `Attendance.tsx` (ícone `History`).
- Abre um `Sheet` lateral (`shadcn/ui sheet`) com tabs: **Consultas anteriores**, **Prescrições**, **Procedimentos**, **Odontograma**.
- Reutiliza queries de `clinical_records`, `clinical_record_procedures`, `clinical_record_requests` (já filtradas por `patient_id`), ordenadas desc, agrupadas por data.
- Cada item é colapsável: mostra diagnóstico + procedimentos + dentes envolvidos.
- O drawer NÃO desmonta o formulário — o dentista consulta sem perder edição.

## 3. Aba "Exame Odontológico" estruturada

Hoje a aba `odontogram` só mostra um link. Vamos inline-ar um exame rápido para dentistas:

Novo componente `src/components/attendance/DentalExamForm.tsx`:

- Mini odontograma interativo (reusa `ToothMap` de `src/components/clinical-map/ToothMap.tsx`) com seleção múltipla.
- Para cada dente clicado, abre popover com:
  - Select de condição (Cárie, Restauração, Ausente, Trinca, Sensibilidade)
  - Select de face (M, D, V, L, O)
  - Campo livre de observação
- Bloco separado de **Avaliação Periodontal**: Select estado da gengiva (Saudável / Gengivite leve / Moderada / Severa), Input numérico **Índice de Placa (%)**, Input **Sangramento à Sondagem (%)**.
- Os dados ficam em `dental_exam` dentro do `SPECIALTY_DATA` do `notes` (mesmo padrão usado para anthropometry/soap), evitando migração.

Estado adicional em `Attendance.tsx`: `const [dentalExam, setDentalExam] = useState<DentalExam>({ teeth: [], gingiva: '', plaqueIndex: '', bleedingIndex: '' })`. Persistência idêntica ao `anthropometry`.

A aba só aparece quando `clinicCategory === 'odonto'`. Substitui o conteúdo atual de "Odontograma" (mantendo botão "Abrir odontograma completo" como link secundário).

## 4. Templates por subespecialidade

Atualizar a aba **Procedimentos** para mostrar chips de subespecialidade no topo (Ortodontia, Endodontia, Periodontia, Implantodontia, Prótese, Estomatologia, Limpeza, Cirurgia) — clicar filtra `proceduresCatalog` pelos procedimentos cuja `category` corresponda. Implementação: adicionar `categoryFilter` state, filtrar o `Select` de procedimento.

Ícones via `lucide-react` (ex.: `Smile`, `Scissors`, `Sparkles`, `Wrench`, `Activity`, `Microscope`).

## 5. Regra de negócio: bloqueio de finalização

Em `handleFinish`, validar antes de salvar:

```
const errors: string[] = [];
if (!diagnosis.trim() && hypotheses.filter(h => h.text.trim()).length === 0) {
  errors.push('Informe diagnóstico ou hipótese diagnóstica');
}
if (procedures.filter(p => p.procedure_id).length === 0 && !clinicalNotes.trim()) {
  errors.push('Registre ao menos um procedimento ou anotação de evolução');
}
if (errors.length) { toast.error(errors.join(' • ')); return; }
```

Visualmente, marcar as abas com pendência usando um ponto vermelho ao lado do label (computed do estado).

## 6. Resumo automático imprimível

Já existe `AttendanceSummaryModal`. Vamos:

- Disparar o modal **automaticamente** após `handleFinish` bem-sucedido (em vez do toast com action), antes de navegar para `/agenda`.
- Adicionar botão **Imprimir** dentro do modal (`window.print()` em uma `div` com classe `print:visible`) e botão **Salvar PDF** usando o helper `generatePrescriptionPdf.ts` como referência (criar `generateAttendanceSummaryPdf.ts` em `src/lib/`).
- Incluir no resumo: paciente, data, alertas de anamnese, diagnóstico/hipóteses, procedimentos com dentes/faces, prescrições, próximos retornos.

## 7. Carregamento automático de dados persistentes

Hoje o `useEffect` carrega só o registro do agendamento atual. Adicionar nova query `last-clinical-record` que busca o **último** `clinical_record` do paciente (qualquer agendamento) e, quando o registro atual está vazio, pré-preenche somente campos persistentes seguros: histórico do odontograma e medicações em uso (não copia diagnóstico nem queixa). Mostra um aviso sutil "Carregado do último atendimento — revise antes de salvar."

## Arquivos

**Novos**
- `src/components/attendance/PatientAlertsBar.tsx`
- `src/components/attendance/HistoryDrawer.tsx`
- `src/components/attendance/DentalExamForm.tsx`
- `src/lib/generateAttendanceSummaryPdf.ts`

**Editados**
- `src/pages/Attendance.tsx` — alerts bar, drawer, dental exam state, validação, auto summary.
- `src/components/attendance/AttendanceSummaryModal.tsx` — botões imprimir/PDF + seção dental exam.
- `src/lib/specialtyProfile.ts` — renomear tab `odontogram` para incluir o novo form (sem quebrar outras famílias).

## Observações técnicas

- Sem migrações: tudo cabe em `clinical_records.notes` via `<!--SPECIALTY_DATA:...-->` (padrão já usado por `anthropometry` / `soap`).
- Sem novas dependências.
- Mantém compatibilidade com Médico, Psi, Nutri, Estética — features novas só aparecem quando `clinicCategory === 'odonto'` ou família `odonto`.
