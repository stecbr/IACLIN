## Auditoria: vazamentos odontológicos no perfil Médico

Mapeei 11 áreas. A boa notícia: o sistema **já tem** a camada de contextualização certa (`specialtyFamily`, `specialtyProfile`, `useSpecialtyProfile`, `clinicCategory`, `attendanceTabs`, `patientTabs`). Atendimento, Prontuário, Pacientes, Financeiro de procedimentos e Agenda já estão gateados corretamente.

O que está vazando vem de **5 causas-raiz**, e a maioria dos sintomas visíveis (incluindo o badge **IACLINDENTAL** no print que você enviou para o Júnior médico) some assim que essas 5 forem corrigidas.

---

### Inconsistências encontradas (resumo executivo)

| # | Tela / Componente | Sintoma | Causa-raiz |
|---|---|---|---|
| 1 | Sidebar / topo (badge do usuário) | Médico sem especialidade salva vê **IACLINDENTAL** e anel ciano "odonto" | `AuthContext.clinicCategory` default = `'odonto'` + fallback de `useProfessionalLabel` para `'odonto'` |
| 2 | Dashboard (DentistHome) | Cards **"Sessões de Hoje"** e **"Planos Abertos"** aparecem para médico/fisio/podologia/genérico | KPIs não respeitam `profile.showBudgets` nem `family.appointmentNounPlural` |
| 3 | Sidebar / Bottom nav | **"Orçamentos"** aparece para médico/fisio/podologia/genérico | Filtro só exclui `psi`; ignora `showBudgets` |
| 4 | Sidebar admin | Link **"Odontograma"** aparece em clínica médica | Falta gate `isOdonto` em `patientItems` |
| 5 | Profile / Auth | Médico sem especialidade recebe rótulo **CRO** em vez de **CRM**; `profSubType` derivado de `clinic.category` | Mesma causa-raiz 1 + uso de `clinicCategory` como proxy de "é dentista" |
| 6 | Settings → Convênios | Tipo de plano inicia como **"dental"** em clínica médica | Default hard-coded `'dental'` |
| 7 | PDF Prontuário | Coluna **"Dente"** sempre aparece; secção **"Odontograma"** consultada mesmo para médico | Falta flag de família no `generateAttendancePdf` / `generateFullChartPdf` |

Atendimento, Prontuário (abas), Pacientes (campos), Procedimentos do financeiro e Agenda → **já estão corretos**. Não há vazamento real.

---

### Correções a implementar

**Causa-raiz 1 — `AuthContext`**
- `src/contexts/AuthContext.tsx`: trocar default de `clinicCategory` de `'odonto'` para `null` (e ajustar tipo). Consumidores que checam `=== 'odonto'` continuam corretos; consumidores que usavam `'odonto'` como fallback de "modo pessoal" passam a se basear em `specialty`.

**Causa-raiz 2 — `useProfessionalLabel`**
- `src/hooks/useProfessionalLabel.ts`: quando `specialty` é null, retornar família `'generic'` (IACLINMEDICO) em vez de `'odonto'`. Só usar `'odonto'` quando `clinicCategory === 'odonto'` **E** a especialidade salva confirmar isso.

**Causa-raiz 3 — `Auth.tsx` profSubType**
- `src/pages/Auth.tsx`: derivar `profSubType` de `getSpecialtyFamily(user.specialty)` em vez de `clinic.category`.

**Profile (CRM/CRO)**
- `src/pages/Profile.tsx`: `regLabel` baseado em `family === 'odonto'` (via `useProfessionalLabel`), não em `clinicCategory`.

**Dashboard**
- `src/pages/dentist/DentistHome.tsx`:
  - "Sessões de Hoje" → usar `apptCapPlural` (já calculado).
  - Card "Planos Abertos" e a query → renderizar somente quando `profile.showBudgets`.
  - Título do diálogo de sessões → `apptCapPlural`.

**Sidebar / Bottom nav**
- `src/components/AppSidebar.tsx`: filtrar `/budgets` quando `!profile.showBudgets`; gatear `/odontogram` em `patientItems` com `isOdonto`.
- `src/components/MobileBottomNav.tsx`: idem para "Orçamentos".

**Settings → Convênios**
- `src/components/settings/InsurancePlansSection.tsx`: default `planType` = `clinicCategory === 'odonto' ? 'dental' : 'health'`.

**PDFs**
- `src/lib/generateAttendancePdf.ts`: aceitar flag `showTooth` e omitir a coluna "Dente" quando false.
- `src/lib/generateFullChartPdf.ts`: pular a query e a seção "Odontograma" quando família ≠ `'odonto'`.
- Atualizar chamadores para passar a flag baseada em `useSpecialtyProfile`.

---

### Checklist final (Médico Clínico Geral)

- [ ] Badge no header mostra **IACLINMEDICO**, não IACLINDENTAL.
- [ ] Anel do avatar não usa cor "odonto".
- [ ] Dashboard sem "Sessões de Hoje" e sem "Planos Abertos".
- [ ] Sidebar sem "Orçamentos" e sem "Odontograma".
- [ ] Bottom nav mobile sem "Orçamentos".
- [ ] Profile: rótulo **CRM** (não CRO).
- [ ] Cadastro de convênio inicia tipo **"Saúde"**.
- [ ] PDF do atendimento sem coluna "Dente".
- [ ] PDF do prontuário completo sem seção "Odontograma".
- [ ] Atendimento sem aba Odontograma, sem campos dentários (já validado, mantém).

---

### Fora de escopo (não toca)

- Estrutura da agenda, abas de atendimento, abas de prontuário, fluxo CID/prescrição/exames/atestados/encaminhamentos — já estão corretos pelo `specialtyProfile`.
- Roteamento `DentistRouter` → `DentistHome` para `physio`/`podology`/`generic` permanece; apenas removo os cards odonto de dentro do `DentistHome`. Criar `GenericHome` separado é refator maior e pode ser feito depois.
