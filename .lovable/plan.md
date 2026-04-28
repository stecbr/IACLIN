
# Painel personalizado para Psicólogo

Hoje a navegação do dentista (`role = dentist`) é a mesma para qualquer especialidade — psicólogo recebe "Orçamentos", "Ferramentas Clínicas" (com calculadora de anestésico, atlas de dentes, etc) e nenhum mapa próprio. Vamos personalizar pela `clinic_members.specialty = psicologia`.

---

## 1. Navegação (sidebar + bottom nav)

Quando o profissional logado for `dentist` **e** `specialty = psicologia`:

- **Remover:** "Orçamentos" (`/budgets`) e "Ferramentas Clínicas" (`/ferramentas`)
- **Adicionar:** "Ferramentas do Psicólogo" (`/psi/ferramentas`) — caixa própria
- **Mapa clínico:** novo "Mapa Psíquico" (`/mapa-clinico` continua, agora com `mapType = 'psyche'`)

Implementação: usa o `mapRegistry` existente (já mapeia specialty → mapa) e estende com lógica análoga em `AppSidebar.tsx` / `MobileBottomNav.tsx` para esconder/trocar itens quando `specialty` é de psicologia.

---

## 2. Mapa Psíquico (novo `mapType = 'psyche'`)

Painel visual com **8 áreas da vida**, cada uma marcável por sessão com humor/intensidade e nota:

```text
┌───────────┬───────────┬───────────┐
│  Humor    │   Sono    │ Ansiedade │
├───────────┼───────────┼───────────┤
│ Família   │ Trabalho  │ Relação   │
├───────────┼───────────┼───────────┤
│  Auto-    │  Corpo /  │           │
│ estima    │ somat.    │           │
└───────────┴───────────┴───────────┘
```

- Reaproveita tabela `clinical_map_entries` (já tem `map_type`, `region_code`, `severity`, `notes`).
- Condições: `stable`, `improving`, `worsening`, `crisis`, `goal`.
- Linha do tempo lateral mostrando evolução da área selecionada nas últimas sessões.

Novo componente: `src/components/clinical-map/PsycheMap.tsx` + entradas em `mapRegistry.ts` (`psicologia → psyche`) e em `CONDITIONS_BY_MAP.psyche`.

---

## 3. Caixa de Ferramentas do Psicólogo (`/psi/ferramentas`)

Nova `PsiToolsHome.tsx` no mesmo padrão visual da `ToolsHome.tsx` atual, com 8 cards:

| Ferramenta | O que faz |
|---|---|
| **Escalas Clínicas** | Aplicar PHQ-9 (depressão), GAD-7 (ansiedade), BDI-II, BAI, PSS-10 (estresse), AUDIT, escala de risco suicida (Columbia C-SSRS resumida). Calcula escore, classifica gravidade, salva no prontuário. |
| **Diário de Humor** | Registro rápido por data: humor 1–10, sono, energia, ansiedade, pensamento intrusivo, evento gatilho. Vira gráfico. |
| **Evolução SOAP** | Modelo estruturado (Subjetivo/Objetivo/Avaliação/Plano) + campo "tarefa de casa" + risco. Salva em `clinical_records`. |
| **Timer de Sessão 50min** | Cronômetro com aviso aos 45min e 50min, pausa, e auto-preenche `procedure_duration_seconds`. (Reaproveita `ProcedureTimer` ajustado.) |
| **Genograma rápido** | Editor leve de família (3 gerações) salvo como JSON no prontuário. |
| **Plano Terapêutico** | Lista de objetivos terapêuticos com status (em curso / atingido / revisar) — substitui "Orçamentos". |
| **Conversores e Tabelas** | Critérios DSM-5 resumidos (TDM, TAG, TEPT, TOC), escala EVA emocional, faixas das escalas clínicas. |
| **Ditado por Voz** | Reaproveita `VoiceDictation` existente. |

---

## 4. Documentos do Psicólogo

Novo conjunto de geradores PDF (segue padrão `generatePrescriptionPdf.ts`):

1. **Atestado de comparecimento** — reaproveita `generateCertificatePdf.ts` (sem alteração).
2. **Declaração para escola/empresa** — modelo "está em acompanhamento psicológico desde X, com sessões semanais/quinzenais".
3. **Relatório/Laudo psicológico (CFP)** — estrutura oficial: identificação, demanda, procedimentos, análise, conclusão, com aviso ético do CFP no rodapé.
4. **Encaminhamento** — para psiquiatra, neuro, fonoaudiólogo, com motivo e dados do paciente.

Novos arquivos: `src/lib/generatePsiDeclarationPdf.ts`, `generatePsiReportPdf.ts`, `generatePsiReferralPdf.ts`. Acessíveis pela aba "Documentos" da Caixa de Ferramentas e pelo overlay durante a sessão.

---

## 5. Overlay durante a sessão

`ToolsOverlay.tsx` (FAB no `Attendance.tsx`) ganha versão psi quando specialty = psicologia: botões **Escala**, **Humor**, **SOAP**, **Timer 50min**, **Ditado**, **Laudo** — em vez de calculadora de anestésico/receituário.

---

## 6. Banco de Dados

Tudo cabe nas tabelas existentes — **não precisa migração**:

- Mapa Psíquico → `clinical_map_entries` (`map_type='psyche'`, `region_code='mood'|'sleep'|...`, `severity`, `notes`).
- Escalas aplicadas → `clinical_record_requests` (`kind='psi_scale'`, `payload={scale, answers, score, classification}`).
- Diário de humor → `clinical_record_requests` (`kind='psi_mood'`).
- Plano terapêutico → `treatment_plans` + `treatment_plan_items` (status já existe), só muda o rótulo na UI.

---

## 7. Detalhes técnicos

- **`mapRegistry.ts`**: adicionar `MapType = '... | psyche'`, mapear `psicologia / psicologo / psicanalise / psicoterapia / neuropsicologia` → `{ mapType: 'psyche', label: 'Mapa Psíquico', icon: Brain }`. Adicionar `CONDITIONS_BY_MAP.psyche`.
- **`AppSidebar.tsx`**: adicionar flag `isPsi = isDentist && memberSpecialty é psicologia`. Filtrar `clinicNav` removendo `/budgets` e `/ferramentas`, injetar item `Ferramentas do Psicólogo` (`/psi/ferramentas`, ícone `Brain`).
- **`MobileBottomNav.tsx`**: mesma lógica no `allMoreItems`.
- **`useRoleAccess.ts`**: adicionar rota `/psi/ferramentas` permitida para `['admin', 'dentist']`.
- **`App.tsx`**: registrar rota `/psi/ferramentas` → `PsiToolsHome`.
- **`ClinicalMapPage.tsx`**: adicionar `case 'psyche'` no switch de mapas e helper `getPsycheRegionLabel`.
- Bibliotecas auxiliares: `src/lib/psiScales.ts` (PHQ-9, GAD-7, etc com perguntas/escores), `src/lib/psiReferenceData.ts` (DSM-5 resumido), `src/lib/psyMapData.ts` (8 áreas).

---

## Arquivos novos

```text
src/components/clinical-map/PsycheMap.tsx
src/pages/psi/PsiToolsHome.tsx
src/components/psi/PsiScales.tsx
src/components/psi/MoodDiary.tsx
src/components/psi/SoapNote.tsx
src/components/psi/SessionTimer.tsx
src/components/psi/Genogram.tsx
src/components/psi/TherapyPlan.tsx
src/components/psi/PsiReference.tsx
src/components/psi/PsiDocuments.tsx
src/lib/psiScales.ts
src/lib/psiReferenceData.ts
src/lib/psyMapData.ts
src/lib/generatePsiDeclarationPdf.ts
src/lib/generatePsiReportPdf.ts
src/lib/generatePsiReferralPdf.ts
```

## Arquivos editados

```text
src/components/AppSidebar.tsx        (esconder budgets/ferramentas + injetar psi)
src/components/MobileBottomNav.tsx   (mesma lógica)
src/components/clinical-map/mapRegistry.ts  (specialty psicologia → psyche)
src/components/clinical-map/ClinicalMapPage.tsx  (case psyche)
src/components/dentist/tools/ToolsOverlay.tsx  (variante psi no Attendance)
src/hooks/useRoleAccess.ts           (rota /psi/ferramentas)
src/App.tsx                          (registrar rota)
```

---

## Fora do escopo

- Aplicação interativa do paciente para responder escalas em casa (fica para depois).
- Integração com CRP / e-Psi (governo).
- Vídeo-sessão (telepsicologia) — já existe meio em outro módulo.

Posso seguir por essa ordem: **(1) registry + sidebar/nav** → **(2) Mapa Psíquico** → **(3) Caixa de Ferramentas** (escalas + SOAP + timer + humor) → **(4) Documentos** → **(5) Overlay no atendimento**. Confirma?
