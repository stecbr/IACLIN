
# Plano de ajuste — Frontend da Secretária IA

Objetivo: alinhar a tela da Secretária IA ao PRD e à última reunião, removendo duplicações com dados oficiais da clínica/profissional e separando claramente comportamento da IA × dados operacionais × automações.

---

## 1) Diagnóstico

### ✅ O que está correto hoje
- Stepper em 3 etapas (Conexão → Treinamento → Painel) com navegação livre.
- `useAiContext` já distingue clínica × profissional vinculado e resolve `aiTenantId`.
- Painel já consome dados oficiais para o Encaminhamento Humano (lista de membros da clínica via `clinic_members` + `profiles`).
- Sync com backend externo já existe (`aiBackend.syncConfig`, `syncDoctors`, `syncPatients`, `syncAvailability`, `syncAppointments`) — ou seja, a infraestrutura para "fonte única de verdade" já está pronta no backend; o problema é só no frontend de treinamento.
- Restrição da Secretária IA ao admin (dono) já aplicada via `useRoleAccess`.

### 🔁 O que está duplicado / inconsistente
- **Seção "HORÁRIOS DE ATENDIMENTO" dentro do prompt** (`PROMPT_SECTIONS` em `SecretariaIA.tsx`) — duplica `clinics.business_hours` e a disponibilidade dos profissionais. Hoje é texto livre que pode contradizer a agenda real.
- **Seção "URGÊNCIAS"** dentro do prompt sobrepõe parcialmente o módulo de Encaminhamento Humano do `SecretariaIAPainel.tsx` (telefone alternativo + palavras-gatilho).
- **Horário de atendimento no Painel** (`ClinicHoursSection` dentro de `SecretariaIAPainel`) é o mesmo dado editado em `SettingsPage` — manter dois pontos de edição vira fonte de divergência. Deve virar leitura + atalho para a configuração oficial.
- **"Mensagem de transferência" do handoff** e **"Saudação" do prompt** vivem em telas separadas sem hierarquia clara.

### ❌ O que falta (e está no PRD / reunião)
- Lembretes automáticos (24h / 2h antes).
- Mensagens fora do horário (resposta automática quando clínica fechada).
- Confirmação / reagendamento / cancelamento via WhatsApp (fluxo, não só texto).
- Pós-consulta + NPS.
- Régua de retorno preventivo (ex.: "faz 6 meses…").
- Aniversário do paciente.
- Visualização de **convênios aceitos** (puxar de `insurance_plans`) como fonte de verdade para a IA.
- Visualização de **profissionais vinculados + especialidades** que a IA usa.
- Painel de **conversas em tempo real** já existe (`LiveMessagesPanel`) mas não há métricas (volume, taxa de resolução, tempo médio) — está marcado como "em breve".
- Indicador claro de "o que a IA sabe automaticamente sobre sua clínica" (transparência da fonte de dados).

---

## 2) Reorganização proposta da tela

Manter o stepper de onboarding (Conexão → Treinamento → Painel) **só para o primeiro uso**. Depois de conectado, a tela principal vira um **hub com abas**:

```text
Secretária IA
├── Visão geral        → status WhatsApp, métricas, últimas conversas
├── Comportamento      → personalidade, saudação, objetivo, regras,
│                        restrições, exemplos  (SEM horários/urgências)
├── Conhecimento       → READ-ONLY com link "editar em Configurações":
│                        • Horário de atendimento (clinics.business_hours)
│                        • Profissionais vinculados + especialidades
│                        • Convênios aceitos
│                        • Procedimentos + duração
│                        • Salas
│                        • Disponibilidade oficial
├── Automações         → lembretes 24h/2h, fora do horário, NPS pós-consulta,
│                        retorno preventivo, aniversário
├── Atendimento humano → handoff (telefone, atendente, palavras-gatilho,
│                        mensagem de transferência)
└── Conversas          → LiveMessagesPanel + histórico
```

Princípio: **Comportamento** = como a IA fala. **Conhecimento** = o que ela sabe (sempre vindo do sistema). **Automações** = quando ela age sozinha. **Handoff** = quando ela passa para humano.

---

## 3) Ordem segura de implementação

### Fase A — Limpeza (sem risco, agora)
1. Remover as seções `horarios` e `urgencias` de `PROMPT_SECTIONS` em `SecretariaIA.tsx`.
2. Migrar prompts já salvos: na leitura, se vier `HORÁRIOS DE ATENDIMENTO:` ou `URGÊNCIAS:`, descartar silenciosamente (a fonte de verdade passa a ser o sistema).
3. Em "Treinamento", adicionar um card read-only **"O que a IA já sabe sobre sua clínica"** listando: horários, nº de profissionais, nº de convênios, nº de procedimentos, com link "Editar em Configurações".
4. No `SecretariaIAPainel.tsx`, trocar o editor `ClinicHoursSection` por leitura + botão "Editar horários" que leva para `/settings`.

### Fase B — Reorganização visual (agora, depois de A)
5. Transformar o step 3 ("Painel") em **hub com abas** (Visão geral / Comportamento / Conhecimento / Automações / Handoff / Conversas) usando o `Tabs` já existente.
6. Mover o conteúdo de Treinamento (step 2) para a aba **Comportamento** desse hub. O stepper passa a ser mostrado só enquanto WhatsApp não estiver conectado (onboarding); depois, fica oculto.
7. Aba **Conhecimento**: ler de `clinics`, `clinic_members`+`profiles`, `insurance_plans`, `procedures`, `clinic_rooms`, `professional_availability` (apenas display).

### Fase C — Funcional (depois, em iterações)
8. Aba **Automações**: novas tabelas/configs para lembretes, fora do horário, NPS, retorno, aniversário. Cada toggle salva em `ai_secretary_config` ou tabela nova `ai_secretary_automations`. Backend externo precisa expor endpoints — coordenar com o backend.
9. Métricas reais na aba **Visão geral** (substituir placeholder "em breve").
10. Sync automático ao salvar Comportamento: garantir que `syncConfig` rode (hoje só roda em modo clínica — ok).

### O que fica para depois (fora deste plano)
- Campanhas em massa de WhatsApp/SMS (Módulo 1 do PRD, secundário).
- Funil Kanban de orçamentos (módulo separado).
- Integração com operadoras (Módulo 2, fora do escopo da Secretária IA).

---

## 4) Detalhes técnicos (referência)

- **Arquivos afetados na Fase A+B**:
  - `src/pages/SecretariaIA.tsx` — remover seções `horarios`/`urgencias`, ajustar `PROMPT_SECTIONS`, `EMPTY_SECTIONS`, `parsePromptToSections`, `buildPromptFromSections`. Adicionar card "O que a IA já sabe".
  - `src/pages/SecretariaIAPainel.tsx` — converter para layout de abas; remover edição de `business_hours`.
  - Possivelmente novo: `src/components/secretaria-ia/KnowledgeSourcePanel.tsx` para a aba Conhecimento.
- **Sem migrations** nesta fase. Schema atual (`ai_secretary_config`, `ai_secretary_handoff`, `clinics.business_hours`, `clinic_members`, `insurance_plans`, `procedures`, `professional_availability`) já cobre tudo.
- **Compatibilidade**: prompts antigos com blocos `HORÁRIOS:`/`URGÊNCIAS:` continuam sendo aceitos na leitura mas não reapresentados — ao salvar de novo, esses blocos somem. Sem perda de dado crítico porque a info real está no sistema.
- **Não afetar paciente**: nada deste plano toca em `PatientLayout`, `PatientSidebar` ou rotas `/patient/*`.

---

## 5) Resumo executivo

| Item | Status proposto |
|---|---|
| Horários no prompt | ❌ remover (Fase A) |
| Urgências no prompt | ❌ remover, migrar para Handoff (Fase A) |
| Edição de business_hours no Painel IA | ❌ remover, virar atalho para Settings (Fase A) |
| Aba "Conhecimento" read-only | ➕ adicionar (Fase B) |
| Hub com abas pós-onboarding | ➕ reorganizar (Fase B) |
| Automações (lembretes, NPS, retorno) | ⏳ Fase C |
| Métricas reais | ⏳ Fase C |

Implementação recomendada agora: **apenas Fases A e B**, que são puramente frontend, sem migrations e sem mudar contrato com o backend externo.
