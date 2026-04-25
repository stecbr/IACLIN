

# Plano: Caixa de Ferramentas Clínicas do Dentista

## Contexto

Hoje o dentista tem agenda, pacientes, odontograma e orçamentos. O que falta é o **kit de ferramentas que ele usa entre uma consulta e outra** — coisas tipo "preciso de uma calculadora de anestesia agora", "quero uma referência rápida de prescrição", "vou marcar o próximo retorno desse paciente em 7 dias". Essas micro-ferramentas existem hoje em apps soltos no celular do dentista; vamos centralizar tudo dentro do IACLIN.

## Módulo central: `/ferramentas` (Caixa de Ferramentas)

Nova área no menu lateral do dentista, **abaixo do mapa clínico**, com ícone `Briefcase` ou `Stethoscope`. Tela única com cards grandes (estilo "app drawer" do iOS), cada um abrindo uma ferramenta específica. Mobile-first, otimizada para uso rápido com luva.

```text
┌─────────────────────────────────────────────┐
│  Ferramentas Clínicas                       │
├─────────────┬─────────────┬─────────────────┤
│ 💉 Anestesia│ 💊 Receituário│ 📅 Próx. Retorno│
├─────────────┼─────────────┼─────────────────┤
│ 📸 Foto     │ 🎤 Ditado   │ 🦷 Atlas Dentes │
├─────────────┼─────────────┼─────────────────┤
│ ⏱ Timer     │ 📋 Atestado │ 🧮 Conversor   │
└─────────────┴─────────────┴─────────────────┘
```

## Ferramentas (cada uma é um modal/drawer dentro de `/ferramentas`)

### 1. 💉 Calculadora de Anestésico
A mais pedida na rotina odontológica. Entrada:
- Peso do paciente (kg)
- Anestésico usado (Lidocaína 2%, Mepivacaína 2%, Articaína 4%, Bupivacaína 0.5% — tabela embutida)
- Vasoconstritor (com ou sem)

Saída em destaque grande:
- **Dose máxima segura**: ex. "Até 7 tubetes de Lidocaína 2% c/ epi"
- **Alerta vermelho** se o paciente tiver alergia/condição registrada na anamnese
- Histórico das últimas 5 calculadas (cache local)

Sem dependência de IA — fórmulas clássicas (mg/kg). Lookup integrado com `anamneses` do paciente selecionado para puxar peso e alergias automaticamente.

### 2. 💊 Receituário rápido
Modelos de prescrição prontos para situações comuns em odontologia:
- Pós-extração (analgésico + anti-inflamatório)
- Profilaxia antibiótica (endocardite)
- Pulpite aguda (combinação SOS)
- Pós-cirúrgico de implante

Fluxo:
1. Escolhe o modelo
2. Busca paciente (autocomplete em `patients`)
3. Ajusta dosagem se quiser
4. Gera **PDF com cabeçalho da clínica + assinatura digital do dentista** (reaproveita `generateBudgetPdf.ts`)
5. Salva em `documents` do paciente automaticamente
6. Botão "Enviar por WhatsApp" (link `wa.me`)

Tabela nova `prescription_templates` (clinic-scoped, editável pelo dentista para criar seus próprios modelos).

### 3. 📅 Próximo retorno
Tela rápida de **agendamento de retorno** sem sair do contexto da consulta:
- "Voltar em [7 dias / 15 / 30 / 60 / 90 / 6 meses / 1 ano]"
- Sugere automaticamente o próximo slot livre da agenda do dentista
- Cria o `appointment` com `label = 'Retorno'` em 1 clique
- Opção "Lembrar paciente 24h antes via WhatsApp"

### 4. 📸 Foto clínica rápida
Acessa câmera do dispositivo (`navigator.mediaDevices.getUserMedia`):
- 1 clique tira a foto
- Tag automática: dente/região (puxando do contexto se vier do mapa clínico) + data + dentista
- Salva direto em `documents` do paciente com categoria "foto_clinica"
- Comparação lado-a-lado com fotos anteriores ("antes/depois")

Útil para clareamento, ortodontia, lesões de pele em derma, etc.

### 5. 🎤 Ditado por voz
Botão grande de microfone. Dentista fala, vira texto automaticamente. Texto vai para:
- Notas do prontuário em andamento (se houver `clinical_record` aberto)
- Ou clipboard para colar em qualquer lugar

Usa Web Speech API (gratuito, no navegador). Modo offline-friendly. Nada de IA paga.

### 6. 🦷 Atlas anatômico interativo (apenas Odonto)
Referência visual: clica num dente → mostra:
- Anatomia (raízes, canais, número médio)
- Procedimentos comumente realizados
- Posição na arcada

Funciona como **referência rápida** durante explicação ao paciente ("olha, esse é o seu dente 36, tem 3 canais"). Vira ferramenta de **comunicação com o paciente**, não só do dentista. Para outras especialidades (cardio, derma, etc.) o atlas é diferente — versão MVP só Odonto.

### 7. ⏱ Timer de procedimento
Cronômetro grande, simples:
- Start/Stop/Reset
- Salva tempo no `clinical_record` em andamento ao parar
- Útil para procedimentos com tempo crítico (ácido fosfórico 15s, polimerização 20s) — **presets nomeados**: Condicionamento ácido (15s), Fotopolimerização (20s), Profilaxia (60s), etc.
- Beep sonoro ao terminar
- Funciona em segundo plano se mudar de aba

### 8. 📋 Gerador de Atestado
Modelo de atestado pronto, 1 clique:
- Paciente (autocomplete)
- "Esteve em atendimento odontológico em [data] das [hora] às [hora]"
- Ou: "Necessita afastamento por [X dias] a partir de [data]"
- CID-10 opcional (lista comum em odonto: K02, K04, K07…)
- Gera PDF com assinatura, salva em `documents`, manda por WhatsApp

### 9. 🧮 Conversor & Tabelas rápidas
Conversores e referências de bolso:
- mL ↔ tubetes anestésicos
- Tabela de tempo de hemostasia por anticoagulante
- Tabela ASA (avaliação de risco pré-cirúrgico)
- Escala de dor (EVA visual para mostrar ao paciente)

Tudo offline, dados estáticos no código. Útil em consulta sem conectividade.

## Mudanças no banco

Mínimas, focadas no essencial:

1. **`prescription_templates`** (nova): `id, clinic_id, dentist_id, name, content (jsonb), is_default, created_at`. RLS por clínica.
2. **`profiles`**: adicionar `signature_url` (text, nullable) — assinatura digital escaneada para PDFs de receita/atestado.
3. **`documents`**: já tem `category` — só passamos a usar valores novos: `prescription`, `medical_certificate`, `clinical_photo`.
4. **`clinical_records`**: adicionar `procedure_duration_seconds` (int, nullable) para o timer.

Sem novas migrações pesadas — só ALTER TABLE simples.

## Onde isso vive na navegação do dentista

**Sidebar** (`AppSidebar.tsx`):
```text
Principal:
  - Dashboard
  - Agenda
  - Disponibilidade

Clínica:
  - Pacientes
  - Aprovações
  - Odontograma (mapa dinâmico)
  - 🆕 Ferramentas Clínicas    ← NOVO
  - Orçamentos

Rodapé: Meu Perfil
```

**Mobile bottom nav**: trocar o atual "Mais" para abrir uma folha com **Ferramentas + Odontograma + Orçamentos** juntos. Dá pra acessar com 1 toque mesmo de luva.

**Atalho contextual**: dentro de `Attendance.tsx` (atendimento em andamento), botão flutuante 🛠️ no canto que abre as 3-4 ferramentas mais usadas em modo overlay (Anestesia, Timer, Ditado, Receituário) sem sair da tela do prontuário. Esse é o **maior ganho de UX** — ferramenta na mão durante o atendimento.

## Fora de escopo (deixar para depois)

- IA que sugere prescrição baseada no diagnóstico — bom mas requer aprovação clínica.
- Integração com leitor de raio-X / scanner intra-oral — depende de hardware.
- Reconhecimento de imagem para diagnóstico de cárie — fora do MVP.
- Atlas anatômico para outras especialidades além de odonto.

## Arquivos novos

- `src/pages/dentist/ToolsHome.tsx` — grade de ferramentas
- `src/components/dentist/tools/AnestheticCalculator.tsx`
- `src/components/dentist/tools/PrescriptionPad.tsx`
- `src/components/dentist/tools/QuickReturn.tsx`
- `src/components/dentist/tools/ClinicalCamera.tsx`
- `src/components/dentist/tools/VoiceDictation.tsx`
- `src/components/dentist/tools/ToothAtlas.tsx`
- `src/components/dentist/tools/ProcedureTimer.tsx`
- `src/components/dentist/tools/CertificateGenerator.tsx`
- `src/components/dentist/tools/QuickReference.tsx`
- `src/components/dentist/tools/ToolsOverlay.tsx` — overlay flutuante para usar dentro do atendimento
- `src/lib/anestheticDoses.ts` — tabela de fármacos e doses máximas
- `src/lib/prescriptionTemplates.ts` — modelos pré-definidos
- Migração: criar `prescription_templates`, adicionar `signature_url` em `profiles`, `procedure_duration_seconds` em `clinical_records`

## Arquivos editados

- `src/App.tsx` — registrar rota `/ferramentas` (e sub-rotas se necessário)
- `src/components/AppSidebar.tsx` — novo item "Ferramentas Clínicas" para `dentist`
- `src/components/MobileBottomNav.tsx` — agrupar ferramentas no bottom sheet
- `src/hooks/useRoleAccess.ts` — permissão da rota
- `src/pages/Attendance.tsx` — botão flutuante do `ToolsOverlay`
- `src/lib/generateBudgetPdf.ts` ou novo `generatePrescriptionPdf.ts` reaproveitando estrutura

## Onda de entrega sugerida

Para não virar um sprint gigante, entregar em 3 ondas:

**Onda 1 — As 3 ferramentas mais pedidas no dia a dia (sprint pequeno)**
- Calculadora de Anestésico
- Timer de Procedimento (com presets)
- Próximo Retorno em 1 clique

**Onda 2 — Documentos**
- Receituário rápido + assinatura digital
- Gerador de Atestado
- Foto clínica

**Onda 3 — Plus**
- Ditado por voz
- Atlas anatômico
- Conversores e tabelas
- Overlay flutuante dentro do atendimento

## Resultado esperado

O dentista para de pular entre 3 apps no celular (calculadora de anestesia, gerador de receita, cronômetro) e tem **tudo dentro do IACLIN**, com os dados do paciente já carregados (peso, alergias, histórico). Vira um diferencial real: não é "mais um sistema de gestão", é a **ferramenta clínica do dia a dia**.

---

**Recomendo começar pela Onda 1** (Anestésico + Timer + Retorno) — é o que ele usa **toda consulta**, e em 1 sprint já entrega valor percebido imediato. Me confirma se faz sentido, ou se prefere começar por outro recorte (ex: focar primeiro em receituário/atestado, que é mais "papelada").

