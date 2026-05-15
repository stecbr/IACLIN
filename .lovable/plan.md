
# Fase 1 — Secretária IA para Profissional Individual

Objetivo: permitir que um médico/dentista/profissional sem vínculo com clínica (ou com vínculo, mas operando em modo "consultório próprio") tenha sua **própria instância da Secretária IA** — prompt, WhatsApp, handoff, agenda e disponibilidade — sem quebrar nada do fluxo atual baseado em `clinic_id`.

Premissa central: **`ai_tenant_id` passa a ser a chave de tenancy da IA**. `clinic_id` continua existindo nas tabelas e nas rotas como apelido legado. Nada do código atual precisa ser removido nesta fase.

---

## 1. Arquitetura de contexto

Hoje o `AuthContext` expõe `currentClinicId`. Vamos introduzir um conceito superior: **`currentAiContext`**, que tem uma dessas formas:

```text
{ kind: "clinic",       clinicId, aiTenantId, displayName, branding }
{ kind: "professional", userId,   aiTenantId, displayName, branding }
```

Regras de seleção:

- Se o usuário tem 1+ `clinic_members` ativos → contexto padrão = clínica atual (igual hoje).
- Se o usuário **não** tem nenhum `clinic_members` e tem role `dentist`/`professional` → contexto = `professional` com `userId = auth.uid()`.
- Se tem ambos → o `ClinicSwitcher` ganha uma entrada extra **"Meu consultório"** que troca para o contexto profissional. Persistido em localStorage como hoje.

`aiTenantId` é resolvido on-demand via RPC `resolve_or_create_ai_tenant_for_clinic` ou `resolve_or_create_ai_tenant_for_user` (ambas já existem). O frontend nunca cria tenant manualmente.

---

## 2. Liberação do menu "Secretária IA"

Hoje o item depende de `currentClinicId` + role admin/secretária. Mudança:

- Render se `currentAiContext` estiver definido **E** (kind=clinic com role admin/secretária **OU** kind=professional e dono do tenant).
- Rota `/secretaria-ia` aceita os dois contextos. Componentes internos passam a ler `aiTenantId` do contexto, não mais `currentClinicId`.

---

## 3. Modelagem de dados

A Fase 0 já criou `ai_tenants` e a coluna `ai_tenant_id` em `ai_secretary_config`, `ai_secretary_handoff`, `whatsapp_messages`. Fase 1 adiciona apenas o que falta para o caso profissional:

### 3.1 Novas colunas (todas opcionais, aditivas)

| Tabela | Coluna nova | Motivo |
|---|---|---|
| `ai_secretary_config` | `clinic_id` passa a ser **nullable** | precisa aceitar config de profissional sem clínica |
| `ai_secretary_handoff` | `clinic_id` passa a ser **nullable** | idem |
| `whatsapp_messages` | `clinic_id` **nullable** | idem (se ainda não estiver) |
| `ai_tenants` | `business_hours jsonb`, `phone text`, `timezone text` | profissional não tem registro em `clinics` para guardar isso |
| `ai_tenants` | `whatsapp_instance_name text` | nome canônico Evolution, único por tenant |

### 3.2 Constraint de coerência

Na `ai_secretary_config` e `ai_secretary_handoff`:
```
CHECK ( ai_tenant_id IS NOT NULL )
```
e índice único `(ai_tenant_id)` — uma config por tenant. `clinic_id` vira derivado (apenas eco, mantido para queries legadas).

### 3.3 RLS

Substituir as policies atuais (`user_belongs_to_clinic(clinic_id)`) por:
```
USING ( public.user_owns_ai_tenant(auth.uid(), ai_tenant_id) )
```
A função `user_owns_ai_tenant` já existe e já cobre os dois `owner_type`. **Não removemos `clinic_id`** — só deixamos de usá-lo na policy.

### 3.4 Agenda, disponibilidade, pacientes, convênios

Sem mudança de schema nesta fase. Razão:

- `appointments`, `patients`, `availability`, `clinical_records`, `financial_transactions` já têm policy "clinic member OU `dentist_id = auth.uid()` quando `clinic_id IS NULL`". O modo profissional já é tecnicamente possível.
- A IA do profissional consulta esses dados via `ai_tenant_id → user_id` (resolvido na função SECURITY DEFINER) e filtra `WHERE dentist_id = tenant.user_id AND clinic_id IS NULL` (agenda pessoal) — ou, no futuro, `OR clinic_id IN (clinics do profissional)` (ver §7).

### 3.5 Convênios (`insurance_plans`)

Hoje exige `clinic_id NOT NULL`. Fase 1: tornar `clinic_id` nullable e adicionar `ai_tenant_id`. Profissional individual cadastra seus próprios convênios sob o tenant pessoal. RLS via `user_owns_ai_tenant`.

---

## 4. Backend externo (compatibilidade tripla)

O backend hoje só fala `clinicId`. Estratégia: **aceitar três identificadores na mesma rota**, resolver internamente para `ai_tenant_id`, e responder no mesmo formato.

### 4.1 Resolver de tenant (no backend)

Função única `resolveTenant(req)`:
1. Se header `x-ai-tenant-id` ou query `?ai_tenant_id=` presente → usa direto.
2. Senão, se path tem `/clinics/:clinicId/...` → `SELECT id FROM ai_tenants WHERE clinic_id=:clinicId`.
3. Senão, se path tem `/professionals/:userId/...` (novo) → `SELECT id FROM ai_tenants WHERE user_id=:userId`.
4. Falha 400 se nenhum.

### 4.2 Rotas

Manter todas as rotas atuais `/api/clinics/:clinicId/...` funcionando idênticas. Adicionar **mirror** `/api/tenants/:aiTenantId/...` com a mesma lógica. Frontend novo passa a usar `tenants/:id`. Frontend antigo (e qualquer integração externa) continua chamando `clinics/:id`.

Sync endpoints (`/api/sync/config`, `/sync/doctors`, etc.) recebem **um campo a mais** no body: `ai_tenant_id`. Se ausente, derivam de `clinic_id` (modo legado). Nada quebra.

### 4.3 WhatsApp / Evolution

Nome de instância passa a ser determinístico por tenant:
```
tenant-<aiTenantId-prefix>-<random>
```
Persistido em `ai_tenants.whatsapp_instance_name`. Para tenants legados de clínica, fazer um backfill que migra o nome atual `clinic-<id>-...` para essa coluna **sem renomear na Evolution** (só registra).

Profissional individual abre sua própria instância. WhatsApp da clínica e WhatsApp do profissional são instâncias separadas — números diferentes, QR codes diferentes.

### 4.4 Handoff

Profissional individual → handoff aponta sempre para ele mesmo (`target_user_id = user_id do tenant`). UI esconde o seletor "atendente da equipe" no modo profissional e mostra só "telefone alternativo" e "palavras-gatilho".

---

## 5. Frontend — mudanças por área

### 5.1 Hooks
- **Novo** `useAiContext()` — retorna `{ kind, aiTenantId, clinicId?, userId?, displayName, branding }`.
- `useAiSync` passa a enviar `ai_tenant_id` em todos os payloads.
- `useClinicBranding` ganha fallback para branding do tenant profissional.

### 5.2 `aiBackend.ts`
- Aceita `aiTenantId` opcional. Se presente, usa rotas `/api/tenants/:id/...`. Se não, mantém `/api/clinics/:clinicId/...` (legado).

### 5.3 Páginas
- `SecretariaIA.tsx` e `SecretariaIAPainel.tsx`: trocam `currentClinicId` por `useAiContext().aiTenantId`. Carregam config por tenant. UI praticamente idêntica.
- `LiveMessagesPanel.tsx`: realtime filtrado por `ai_tenant_id` em vez de `clinic_id`.
- `AppSidebar.tsx` e `MobileBottomNav.tsx`: condição de exibição do item.
- `ClinicSwitcher.tsx`: adicionar entrada "Meu consultório" se aplicável.

### 5.4 Compatibilidade
Componentes que ainda leem `currentClinicId` (agenda, pacientes, financeiro) **não mudam**. Eles continuam no escopo "clínica". Só o módulo IA passa a operar por `ai_tenant_id`.

---

## 6. WhatsApp — instância por tenant

```text
ai_tenants
├── owner_type=clinic   →  instância "clinic-<clinicId>"   (legado mantido)
└── owner_type=professional → instância "tenant-<aiTenantId>" (novo padrão)
```

Backfill: para tenants de clínica existentes, gravar `whatsapp_instance_name` = nome atualmente usado pela Evolution. Sem renomear nada lá. Novos tenants (clínica nova ou profissional novo) usam o padrão `tenant-<id>`.

Disconnect/reconnect funcionam por tenant — não por clínica. UI já está organizada assim, só muda o id passado.

---

## 7. Profissional em múltiplas clínicas

Cenário: Dr. X é membro da Clínica A e da Clínica B, e também tem consultório próprio.

Modelo:
- Tenant da Clínica A → IA da clínica A (compartilhada com a equipe).
- Tenant da Clínica B → IA da clínica B.
- Tenant pessoal de Dr. X → IA do consultório próprio dele.

São **três tenants distintos**, três WhatsApps potenciais, três prompts. O `ClinicSwitcher` lista os três contextos. Não há fusão automática — fundir agendas de múltiplas clínicas dentro de uma única IA pessoal fica para Fase 2 (precisa de modelo de "agregação multi-tenant" e regras de prioridade).

Para a IA pessoal **enxergar** os agendamentos do profissional dentro das clínicas (read-only), criar uma view `ai_professional_agenda` no Postgres:
```
SELECT * FROM appointments
 WHERE dentist_id = :userId
   AND (clinic_id IS NULL OR clinic_id IN (clinics onde é membro))
```
Com RLS via `user_owns_ai_tenant`. Mas a **escrita** de novos agendamentos pela IA pessoal vai apenas para `clinic_id IS NULL` (agenda pessoal). Isso evita conflito de governança com as clínicas.

---

## 8. Separação de agendas

| Agenda | Filtro | Escrita pela IA |
|---|---|---|
| Pessoal do profissional | `dentist_id = userId AND clinic_id IS NULL` | IA pessoal sim |
| Da clínica | `clinic_id = X` | IA da clínica X sim |
| Do profissional **dentro** da clínica | `clinic_id = X AND dentist_id = userId` | IA da clínica X (com regra de qual dentista) |

A IA pessoal **lê** todas as três (via view) mas só **escreve** na pessoal. Visual: o painel da Secretária IA pessoal mostra três abas/cores se o profissional tiver mais de um vínculo.

---

## 9. Riscos

| Risco | Severidade | Mitigação |
|---|---|---|
| RLS nova bloqueia config existente | Alta | Manter policies antigas (`user_belongs_to_clinic`) ativas em paralelo até validar; só dropar na Fase 1.5. |
| Tornar `clinic_id` nullable quebra inserts em código antigo que assume NOT NULL | Média | Buscar todos os inserts no frontend; nenhum deveria depender da NOT NULL constraint, só do valor — mas validar antes. |
| Backend externo recebe payload sem `ai_tenant_id` e cria duplicata | Média | Resolver no servidor: se body tem `clinic_id` mas não `ai_tenant_id`, derivar via lookup; nunca criar config nova sem tenant resolvido. |
| Instância Evolution duplicada | Alta | Backfill obrigatório de `whatsapp_instance_name` antes de mudar a lógica de geração de nome. |
| Profissional admin de clínica acaba com IA pessoal "sombra" | Baixa | Tenant pessoal só é criado on-demand quando o profissional clica em "Ativar IA pessoal". Nunca automático. |
| Realtime do `LiveMessagesPanel` filtrando por `clinic_id` para de funcionar | Média | Adicionar canal alternativo por `ai_tenant_id`; manter os dois durante migração. |
| Múltiplos tenants confundem o usuário | Média | UI: badge claro no header "Você está na IA de: Clínica X / Meu consultório". |

---

## 10. Estratégia de compatibilidade

1. **Aditivo primeiro, restritivo depois.** Toda mudança de schema é coluna nova ou policy nova *ao lado* da antiga.
2. **Backend dual.** Rotas `/clinics/:id` e `/tenants/:id` coexistem por tempo indeterminado. O backend resolve internamente para o mesmo `ai_tenant_id`.
3. **Frontend dual.** O `aiBackend.ts` aceita os dois modos e escolhe pelo `aiContext.kind`.
4. **Sem dropar nada nesta fase.** `clinic_id` permanece em todas as tabelas IA. Policies antigas permanecem. Nada de breaking.
5. **Feature flag.** `VITE_ENABLE_PROFESSIONAL_AI=true` para liberar a UI do contexto pessoal apenas quando estivermos prontos. Default off.

---

## 11. Ordem segura de implementação

```text
Fase 1.0  Schema aditivo
          ├─ ai_tenants: + business_hours, phone, timezone, whatsapp_instance_name
          ├─ ai_secretary_config: clinic_id NULLABLE + UNIQUE(ai_tenant_id)
          ├─ ai_secretary_handoff: clinic_id NULLABLE + UNIQUE(ai_tenant_id)
          ├─ whatsapp_messages:    clinic_id NULLABLE
          ├─ insurance_plans:      clinic_id NULLABLE + ai_tenant_id
          └─ Backfill whatsapp_instance_name dos tenants de clínica
          ✅ Frontend continua 100%; nada usa coluna nova ainda

Fase 1.1  Backend externo aceita ai_tenant_id
          ├─ resolveTenant() implementado
          ├─ rotas /api/tenants/:id/... espelhadas
          ├─ payloads de sync aceitam ai_tenant_id opcional
          └─ Evolution: nome de instância vem de ai_tenants.whatsapp_instance_name
          ✅ Frontend antigo continua chamando /clinics/:id e funciona igual

Fase 1.2  Frontend: useAiContext + adoção interna no módulo IA
          ├─ useAiContext() retorna kind=clinic para todos hoje
          ├─ SecretariaIA, SecretariaIAPainel, LiveMessagesPanel, useAiSync
          │   passam a usar aiTenantId
          ├─ aiBackend usa rotas /tenants/:id quando aiTenantId presente
          └─ Nenhuma mudança visual; apenas trocou a chave usada
          ✅ Validação manual: mesma clínica de teste, todos os fluxos passam

Fase 1.3  RLS: adicionar policies via user_owns_ai_tenant
          └─ ADD ao lado das antigas; não remove ainda

Fase 1.4  Liberar contexto profissional (feature flag ON)
          ├─ ClinicSwitcher mostra "Meu consultório"
          ├─ Botão "Ativar IA pessoal" cria tenant on-demand
          ├─ Painel IA funciona idêntico, mas sob tenant pessoal
          └─ Convênios e handoff em modo profissional

Fase 1.5  Limpeza (opcional, semanas depois)
          ├─ Drop policies antigas baseadas em clinic_id (módulo IA apenas)
          └─ Frontend para de enviar clinic_id em payloads novos da IA

Fase 2 (fora do escopo)
          ├─ View ai_professional_agenda agregando múltiplas clínicas
          ├─ IA pessoal lendo agendas de clínicas onde o profissional atua
          └─ Migração de instâncias Evolution antigas para o novo padrão de nome
```

---

## 12. O que é incremental vs. arriscado

**Incremental (baixo risco, pode parar a qualquer momento):**
- Fase 1.0 (schema aditivo)
- Fase 1.1 (backend dual)
- Fase 1.2 (frontend internamente troca chave)
- Backfill de `whatsapp_instance_name`

**Arriscado (precisa janela de validação):**
- Fase 1.3 (RLS) — qualquer policy mal escrita esconde dados.
- Fase 1.4 (feature flag ON) — primeira vez que um usuário real usa modo profissional; precisa logging detalhado.
- Fase 1.5 (limpeza) — irreversível na prática, só fazer após semanas estáveis.
- Renomear instâncias Evolution — **não fazer**. Manter nomes legados.

---

## 13. Resumo dos arquivos/pontos que mudariam

**Migrations (Fase 1.0 e 1.3):** 2 a 3 migrations aditivas.

**Backend externo:** `resolveTenant`, mirror routes `/api/tenants/:id/*`, geração de nome de instância via coluna.

**Frontend:**
- `src/contexts/AuthContext.tsx` — adicionar `currentAiContext`
- novo `src/hooks/useAiContext.ts`
- `src/lib/aiBackend.ts` — aceitar `aiTenantId`
- `src/hooks/useAiSync.ts` — enviar `ai_tenant_id`
- `src/pages/SecretariaIA.tsx`, `SecretariaIAPainel.tsx` — ler tenant
- `src/components/secretaria-ia/LiveMessagesPanel.tsx` — realtime por tenant
- `src/components/AppSidebar.tsx`, `MobileBottomNav.tsx` — condição do menu
- `src/components/ClinicSwitcher.tsx` — entrada "Meu consultório"

**Sem mudança nesta fase:** agenda, pacientes, prontuário, financeiro, odontograma, marketplace.

---

## 14. Definição de "pronto" da Fase 1

- Uma clínica existente continua funcionando exatamente como hoje, sem nenhuma diferença visual ou comportamental.
- Um profissional sem clínica consegue: ativar IA pessoal, conectar WhatsApp próprio, salvar prompt, testar conversa, receber agendamentos da IA na sua agenda pessoal.
- Backend externo aceita os três identificadores e resolve para o mesmo tenant.
- Nenhuma policy antiga foi removida ainda. Rollback é só `DROP` das colunas novas.

