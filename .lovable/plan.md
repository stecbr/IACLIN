## Painel da Operadora — Reformulação Completa

Hoje o painel da operadora compartilha o mesmo visual da clínica/paciente e o fluxo de credenciamento está incompleto. Esta entrega vai diferenciar a identidade, completar o onboarding bilateral, adicionar contrato digital, geolocalização e antifraude no atendimento.

Trabalho dividido em 5 fases, entregáveis de forma incremental.

---

### Fase 1 — Identidade Visual B2B do painel da operadora

- Novo tema (cores corporativas distintas do app clínico): paleta navy/azul-aço com accent âmbar, tipografia mais densa (estilo dashboard B2B).
- `OperatorLayout` ganha:
  - Logo da operadora (upload em Configurações) exibida no topo da sidebar — fallback IACLIN se ainda não tiver.
  - Header com nome da operadora, CNPJ, status (ativa/pendente) e badge "Operadora".
  - Sidebar mais larga, agrupada por seção (Visão geral · Rede · Onboarding · Atendimentos · Financeiro · Configurações).
- Tokens próprios em `index.css` sob `.operator-scope` para não vazar pro restante do app.

### Fase 2 — Fluxo de Credenciamento Bilateral

**Lado da Operadora:**
- Página "Convites" (`/operadora/convites`): operadora envia convite por e-mail/telefone para clínica ou profissional específico. Gera link com token.
- Briefing público da operadora (`/operadora/:slug/briefing`): página de vitrine com "anos de mercado", tabela de valores resumida, volume médio de pacientes/mês, regiões de atuação, diferenciais. Operadora edita em Configurações.

**Lado do Profissional:**
- Em "Minhas operadoras" (já existe), cada operadora vira card com botão "Ver briefing" antes de "Solicitar credenciamento".
- Wizard de credenciamento em etapas (substitui o pedido simples atual):
  1. **Perfil profissional** — foto, nome, CPF, RG, estado civil, CRM/CRO (com validação de formato).
  2. **Clínica** — endereço completo, fotos da clínica (upload múltiplo no bucket `clinic-assets`), horários.
  3. **Especialidades e formação** — multiselect + campos livres.
  4. **Procedimentos por operadora** — checklist filtrado pelo catálogo da operadora; o profissional marca quais aceita atender por aquela operadora específica.
  5. **Revisão e envio**.

**Schema novo (migração):**
- `operator_briefings` (operator_id, years_in_market, avg_monthly_volume, value_table_summary, differentials, regions[]).
- `operator_invites` (operator_id, target_email, target_phone, target_user_id?, token, status, expires_at).
- `professional_credentialing_profile` (user_id, cpf, rg, marital_status, photo_url, clinic_photos[]).
- `credentialing_procedures` (credentialing_id, procedure_code, procedure_name) — procedimentos aceitos por aquela operadora.

### Fase 3 — Validação, Contrato e Assinatura Digital

- Painel da operadora ganha aba "Análise" em cada pedido de credenciamento com checklist:
  - CPF validado · CRM/CRO validado · Antecedentes (campo de upload/observação) · Fotos da clínica revisadas · Endereço confirmado.
- Após "Aprovar", sistema **gera contrato PDF** (`generateCredentialingContractPdf.ts`) usando dados do profissional + operadora + procedimentos selecionados.
- Tela de **assinatura digital dupla** (`/credenciamento/:id/assinar`):
  - Profissional assina (nome digitado + checkbox de aceite + captura de IP/timestamp).
  - Operadora assina (mesmo padrão).
  - Status só vai para `active` (entra nas buscas do paciente/marketplace) após as duas assinaturas.
- Schema: `credentialing_contracts` (credentialing_id, pdf_url, professional_signed_at, operator_signed_at, professional_signature_meta jsonb, operator_signature_meta jsonb).

### Fase 4 — Dashboard com Geolocalização e Métricas

- `OperatorDashboard` ganha:
  - **Mapa** (Leaflet, padrão do projeto) com pinos dos profissionais credenciados, agrupados por cidade.
  - Cards: total por cidade/estado, distribuição por especialidade.
- `OperatorNetwork` recebe filtros: estado · cidade · especialidade · tempo de credenciamento.
- Perfil individual do credenciado (`/operadora/rede/:id`):
  - Tempo de credenciamento.
  - Volume de pacientes atendidos pela operadora.
  - Faturamento gerado.
  - Histórico de atendimentos.

### Fase 5 — Atendimento Antifraude

- Sincronização de agenda já existe (`professional_availability` modo `plano`/`ambos`) — manter.
- Novo fluxo de **confirmação de execução**:
  - Quando o profissional marca consulta como `completed`, o sistema cria um `attendance_confirmation` com token de 6 dígitos.
  - O paciente recebe o token (notificação no app/SMS futuramente) e confirma na tela "Minhas consultas" → `confirmed_by_patient_at`.
  - Alternativa: profissional pode pedir que o paciente assine na tela (assinatura no canvas, salva como imagem).
  - **A operadora só vê o atendimento como "faturável" depois da confirmação do paciente**.
- Nova página `/operadora/atendimentos`:
  - Lista de atendimentos com status: `pendente_confirmacao_paciente` · `confirmado` · `disputado` · `pago`.
  - Filtros por profissional, período e status.

**Schema:** `attendance_confirmations` (appointment_id, token, patient_confirmed_at, professional_signature_url, status, disputed_reason).

---

### Stack técnica (sem alterações)

- Frontend: React + Vite + Tailwind + shadcn, tema novo via CSS variables escopadas.
- Backend: Lovable Cloud (Supabase) — migrações SQL com RLS e GRANTs explícitos para cada tabela nova.
- PDF de contrato: jsPDF (mesmo padrão dos outros geradores em `src/lib/generate*Pdf.ts`).
- Mapa: Leaflet imperativo via refs (memória do projeto).

---

### Ordem de execução sugerida

1. Fase 1 (visual) — entrega rápida, alto impacto visual.
2. Fase 2 (credenciamento bilateral) — maior valor de negócio.
3. Fase 3 (contrato + assinatura) — fecha o ciclo de onboarding.
4. Fase 4 (mapa + métricas).
5. Fase 5 (antifraude).

Cada fase é mergeada de forma independente e testável.

---

### Pergunta antes de começar

Confirma que devo seguir **nesta ordem** e fazer **fase por fase** (te entrego a Fase 1 primeiro pra você validar, depois sigo)? Ou prefere que eu agrupe diferente (ex: visual + credenciamento juntos)?