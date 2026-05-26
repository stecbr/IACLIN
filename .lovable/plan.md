## Objetivo

Permitir que o paciente compartilhe seu prontuário digital completo com qualquer médico via código de 6 dígitos (mesma mecânica usada hoje entre médicos). Ao resgatar, o médico visualiza em modo leitura e pode **importar** o paciente para sua clínica — copiando dados cadastrais, anamnese, registros clínicos, odontograma, mapa clínico e referências de documentos — já vinculando ao usuário do paciente (`patient_user_id`).

## Fluxo do paciente

1. No painel `/paciente` (e também em `Configurações`), novo cartão **"Compartilhar meu prontuário"**.
2. Botão abre dialog reaproveitando o estilo de `SharePatientChartDialog`:
   - Gera código de 6 dígitos via edge function (expira em 5 min).
   - Mostra código grande, contagem regressiva, copiar código / link e enviar por WhatsApp.
3. Sempre disponível, mesmo sem histórico.

## Fluxo do médico

1. Acessa `/prontuario/compartilhado` (página `PatientChartRedeem` já existente) e digita o código.
2. A resposta agora inclui o flag `from_patient: true` quando o código foi gerado pelo próprio paciente.
3. Visualização em modo leitura (igual ao atual).
4. Quando `from_patient` for `true`, aparece botão **"Adicionar aos meus pacientes"** no topo:
   - Abre seletor de clínica (se o médico pertencer a mais de uma) e confirmação.
   - Chama nova edge function `import-shared-patient` que copia tudo para a clínica do médico.
   - Ao concluir, redireciona para `/pacientes/:novoId`.

## Mudanças técnicas

### Banco de dados (migration)
- Adicionar coluna `source` em `patient_chart_shares` (`'professional' | 'patient'`, default `'professional'`).
- Adicionar política RLS / permitir que o **paciente autenticado** insira shares onde `patient_user_id = auth.uid()` (a edge function usa service role, mas o flag fica no registro).
- Sem deletes destrutivos.

### Edge functions

**Nova: `share-own-chart`** (paciente gera código)
- Valida JWT → pega `auth.uid()`.
- Localiza `patient_user_id = user.id` em `patient_accounts` / `patients`.
- Gera código único de 6 dígitos, insere em `patient_chart_shares` com `source='patient'`, `clinic_id=null`, `patient_id` = id consolidado (o primeiro `patients` row vinculado, ou apenas grava `patient_user_id` extra).
- Retorna `{ code, expires_at }`.

**Atualizar: `redeem-patient-chart`**
- Quando `source='patient'`, agrega dados de **todos** os `patients` rows vinculados ao mesmo `patient_user_id` (paciente pode existir em múltiplas clínicas) — anamneses, clinical_records, odontogram, map_entries, documents.
- Retorna `from_patient: true` e `patient_user_id` para a UI saber que pode importar.

**Nova: `import-shared-patient`**
- Body: `{ code, clinic_id }`.
- Valida JWT, checa se usuário é membro da `clinic_id`.
- Revalida o code em `patient_chart_shares` (ainda válido, `source='patient'`).
- Insere novo `patients` na clínica destino com CPF/nome/contato/conv. e `patient_user_id` preenchido (trigger `link_patients_by_cpf` já mantém vínculo).
- Copia: 1 `anamneses` (mais recente), `clinical_records` (+ `clinical_record_procedures` e `_requests`), `odontogram_entries`, `clinical_map_entries`. Documentos: copia apenas o registro em `documents` apontando para o mesmo `file_url` (sem duplicar arquivo em storage) com `category='compartilhado'`.
- Marca `patient_chart_shares.consumed_at`.
- Retorna `{ patient_id }`.

### Frontend

- **Novo componente** `src/components/patient/ShareMyChartDialog.tsx` (clone enxuto de `SharePatientChartDialog`, sem dependência de `patientId` — usa a edge `share-own-chart`).
- **Novo cartão** em `src/pages/patient/PatientHome.tsx` + entrada em `PatientSettings.tsx`.
- **Atualizar** `src/pages/PatientChartRedeem.tsx`:
  - Após resgate, se `from_patient`, mostrar barra superior com botão "Adicionar aos meus pacientes".
  - Modal de confirmação com select de clínica (usa `currentClinicId` por padrão, lista via `AuthContext`).
  - Toast de sucesso + `navigate('/pacientes/:id')`.

### Sem alterações
- `SharePatientChartDialog` médico→médico permanece igual.
- Política de bucket `patient-files` mantida (URLs já públicas para essa categoria; documentos privados ficam fora do clone).

## Detalhes técnicos relevantes

- `patient_chart_shares.patient_id` é NOT NULL hoje? Se for, ao compartilhar pelo paciente passamos o primeiro `patients.id` ligado ao `patient_user_id`; o redeem expande o escopo via `patient_user_id`.
- Códigos de 6 dígitos seguem a mesma geração (`Math.floor(random*1e6).padStart(6,'0')`).
- TTL: 5 minutos, igual ao atual.
- Edge functions com CORS + validação Zod do body.
- RLS: nada que dependa de `auth.uid()` no insert via edge (usamos service role); leitura permanece via edge function pública.

## Entregáveis

1. 1 migration (coluna `source`).
2. 2 novas edge functions + atualização de 1.
3. 1 componente novo + atualização de 3 telas (`PatientHome`, `PatientSettings`, `PatientChartRedeem`).
