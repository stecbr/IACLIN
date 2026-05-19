## Prontuário Completo + Compartilhamento Seguro

Construir exportação completa do prontuário em PDF e um sistema de compartilhamento via código de acesso temporário (expira em 5 minutos), para o profissional enviar a outro colega com segurança.

### 1. Geração do PDF completo (`src/lib/generateFullChartPdf.ts`)

Novo helper reaproveitando `jsPDF` + `autoTable` (mesmo padrão de `generateAttendancePdf.ts`). Recebe `patientId` e monta um documento único com:

- Capa: dados da clínica (logo, nome, endereço, CNPJ) + dados do paciente (nome, CPF, nascimento, telefone, convênio) + data de emissão e profissional responsável.
- Anamnese (tabela `anamneses`): alergias, condições, medicações, hábitos, tipo sanguíneo, observações.
- Linha do tempo de atendimentos (`clinical_records` ordenados por data desc): para cada visita — data, profissional, queixa, HDA, exame físico, sinais vitais, hipóteses, diagnóstico, plano, retorno, evolução/notas, procedimentos realizados (com dente/face/valor) e solicitações (receitas, exames, atestados, encaminhamentos).
- Odontograma (`odontogram_entries`) e mapa clínico (`clinical_map_entries`) — lista resumida por dente/região + condição.
- Documentos anexos (`documents`) — apenas listagem com nome e categoria (sem incluir o binário).
- Rodapé com numeração de página e identificação ("Prontuário emitido por IACLIN — uso clínico restrito").

Áudios/transcrições de `consultation_recordings` ficam de fora por padrão (mantém PDF enxuto); fica como melhoria futura.

### 2. Botão "Exportar prontuário (PDF)" no `PatientDetail.tsx`

Adicionar ação no cabeçalho do prontuário do paciente, com loading e `toast` de erro/sucesso. Visível apenas para membros da clínica (já garantido pelas rotas atuais).

### 3. Compartilhamento seguro via código temporário (5 min)

#### 3.1 Migration (nova tabela `patient_chart_shares`)
- `id uuid pk`
- `patient_id uuid not null`
- `clinic_id uuid not null`
- `created_by uuid not null` (profissional que gerou)
- `code text not null` (6 dígitos numéricos, único enquanto ativo)
- `access_token uuid not null default gen_random_uuid()` (usado internamente para baixar)
- `expires_at timestamptz not null` (`now() + interval '5 minutes'`)
- `consumed_at timestamptz` (marca quando o destinatário abriu — opcional, permitir múltiplas aberturas até expirar)
- `created_at timestamptz default now()`
- Índice em `(code) where expires_at > now()`.
- RLS: insert/select apenas para membros da clínica (`user_belongs_to_clinic`). Nada exposto publicamente via PostgREST — o resgate do PDF acontece via edge function com service role.

#### 3.2 Edge function `share-patient-chart` (POST, autenticado)
Gera o código:
- Valida JWT do solicitante e que ele pertence à `clinic_id` do paciente.
- Cria registro em `patient_chart_shares` com código aleatório de 6 dígitos e `expires_at = now()+5min`.
- Retorna `{ code, expires_at, share_url }` onde `share_url` aponta para `/prontuario/compartilhado` na própria plataforma.

#### 3.3 Edge function `redeem-patient-chart` (POST, público)
Resgata e gera o PDF:
- Recebe `{ code }`.
- Busca share válido (`expires_at > now()`). Se expirado/inexistente → 404 "código inválido ou expirado".
- Carrega todos os dados do paciente (mesma agregação do helper PDF, server-side com `jsPDF` via npm) e devolve o PDF como `application/pdf` em stream para download.
- Não exige login do destinatário — o código de 5 min é o fator de acesso.
- Log mínimo (sem dados clínicos) em `notifications` para o emissor: "Prontuário acessado".

Alternativa considerada: gerar o PDF no cliente do emissor e subir a um Storage privado com signed URL de 5 min. Descartado porque exigiria o emissor manter a aba aberta e duplicaria a lógica de PDF.

#### 3.4 UI de compartilhamento (`SharePatientChartDialog.tsx`)
Disparado por novo botão "Compartilhar prontuário" ao lado de "Exportar PDF":
- Botão "Gerar código de acesso" → chama `share-patient-chart`.
- Exibe código grande (ex: `483 921`), contador regressivo de 5:00, botões "Copiar código", "Copiar link" e "Enviar por WhatsApp" (usando `whatsappLink` do `clinicalDocsHelpers`).
- Aviso de segurança: "Este código expira em 5 minutos e dá acesso ao prontuário completo. Compartilhe apenas com o profissional destinatário."
- Após expirar, botão "Gerar novo código".

#### 3.5 Página pública `/prontuario/compartilhado` (`PatientChartRedeem.tsx`)
- Formulário simples: input do código de 6 dígitos.
- Ao submeter, chama `redeem-patient-chart` e dispara o download do PDF.
- Mensagens claras de erro (expirado, inválido).
- Sem necessidade de login.

### 4. Detalhes técnicos

```text
PatientDetail
  ├─ [Exportar PDF]        → generateFullChartPdf(patientId)
  └─ [Compartilhar]        → SharePatientChartDialog
                              └─ edge: share-patient-chart  → { code, expires_at }

Destinatário
  /prontuario/compartilhado
  └─ input code → edge: redeem-patient-chart → PDF stream
```

Rotas alteradas: adicionar `<Route path="/prontuario/compartilhado" element={<PatientChartRedeem/>} />` em `App.tsx` (fora do `AppLayout` autenticado).

Sem mudanças em RLS de tabelas clínicas — a edge `redeem-patient-chart` usa service role e só libera dados quando o share está válido.

### Itens fora deste plano
- Incluir áudio/transcrição da consulta no PDF.
- Histórico de quem acessou (auditoria) além do "consumed_at".
- Limite de tentativas por IP (pode ser adicionado depois com rate limit simples na edge).
