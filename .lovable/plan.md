
# Plano técnico — Base multi-contexto para a Secretaria IA

## 1. Diagnóstico do estado atual

**O que existe**
- `clinics` + `clinic_members` modelam clínica e vínculos de profissionais (com `specialty`, `registration_number`, `is_owner`, `role`).
- "Profissional individual" é apenas um modo de UI (`isPersonalMode` em `AuthContext`), que força `currentClinicId = null`. Tabelas que aceitam isso: `patients`, `appointments`, `clinical_records`, `financial_transactions`, `consultation_recordings` (RLS: `clinic_id IS NULL AND dentist_id = auth.uid()`).
- Agendas: `appointments` (com `clinic_id` nullable), `professional_availability` (com `clinic_id NOT NULL`), `professional_schedule_template` (não tipada, usada com `as any`).
- Convênios: `insurance_plans` só por clínica. Convênios "do profissional" só existem indiretamente via `professional_schedule_template.accepted_plan_ids`.
- Secretária IA: 100% acoplada a `clinic_id` — `ai_secretary_config`, `ai_secretary_handoff`, `whatsapp_messages` têm `clinic_id NOT NULL`; `useAiSync` só monta para admin com clinic; todos os endpoints em `aiBackend.ts` exigem `clinic_id`.
- `appointments` não tem `source`, `channel`, `mode` (particular/plano), `insurance_plan_id` — convênio é inferido pelo paciente.

**Problemas centrais**
1. Não há um conceito unificado de "tenant da IA" — só clínica.
2. Profissional individual não tem disponibilidade própria (`professional_availability.clinic_id NOT NULL`).
3. Convênio pertence só à clínica; profissional individual não consegue oferecer planos.
4. `appointments` não distingue origem (humana vs IA) nem modalidade (particular/plano/online).
5. `professional_schedule_template` não está nos types — fonte de bugs.
6. RLS já aceita "personal owner" em várias tabelas — bom; mas não existe equivalência para IA, convênios e disponibilidade.

## 2. Proposta de modelagem

### 2.1 Conceito unificador: `ai_tenant` (owner polimórfico da IA)

Em vez de espalhar `clinic_id OR dentist_id` por todas as tabelas de IA, introduzir uma tabela canônica:

```text
ai_tenants
  id            uuid PK
  owner_type    text  ('clinic' | 'professional')
  clinic_id     uuid  null  (FK lógica clinics.id, exigido se owner_type='clinic')
  user_id       uuid  null  (auth.users.id, exigido se owner_type='professional')
  display_name  text
  branding      jsonb (logo_url, theme, etc.)
  created_at, updated_at
  UNIQUE (owner_type, clinic_id, user_id) parcial
```

Toda a Secretaria IA passa a referenciar `ai_tenant_id` em vez de `clinic_id`:
- `ai_secretary_config.ai_tenant_id`
- `ai_secretary_handoff.ai_tenant_id`
- `whatsapp_messages.ai_tenant_id`

Backfill: para cada clínica existente cria-se um `ai_tenant` com `owner_type='clinic'`. `clinic_id` continua nas tabelas como coluna derivada (manter por enquanto para compatibilidade), mas a fonte da verdade vira `ai_tenant_id`.

Vantagem: a IA passa a perguntar "quem é meu tenant?" e descobre automaticamente o contexto (clínica ou profissional). Frontend continua passando `clinicId` — uma função `resolve_ai_tenant(clinic_id|user_id)` retorna o tenant.

### 2.2 Vínculo profissional ↔ clínica

Manter `clinic_members` como está. Um profissional pode ter:
- 0 ou 1 `ai_tenant` próprio (`owner_type='professional'`) — sua "praça pessoal".
- N vínculos em `clinic_members` — cada clínica tem seu próprio `ai_tenant`.

A IA da clínica enxerga TODOS os profissionais via `clinic_members`. A IA pessoal enxerga só o próprio user. Sem IA "compartilhada por vínculo".

### 2.3 Agendas — três visões, uma fonte

Manter `appointments` como tabela única, adicionar campos de contexto:

```text
appointments  (alterações)
  ai_tenant_id        uuid  null  (preenchido quando origem=IA ou para roteamento)
  context_type        text  ('clinic'|'professional')   default derivado
  source              text  ('manual'|'ai'|'marketplace'|'patient_app')  default 'manual'
  channel             text  ('whatsapp'|'web'|'walk_in'|'phone')  null
  mode                text  ('particular'|'insurance'|'online')  default 'particular'
  insurance_plan_id   uuid  null
```

Visões (views materializadas ou RLS-friendly):
- **Agenda pessoal do profissional** = `appointments WHERE dentist_id=auth.uid()` (independente de clinic).
- **Agenda da clínica** = `appointments WHERE clinic_id=X`.
- **Agenda do profissional dentro da clínica** = `appointments WHERE dentist_id=Y AND clinic_id=X`.

Nada novo precisa ser criado — só usar filtros. O front já tem isso quase pronto.

### 2.4 Disponibilidade

Tornar `professional_availability.clinic_id NULLABLE` e migrar índice único para `(user_id, clinic_id, work_date, start_time)` (com clinic_id null permitido). Idem para `professional_schedule_template` (já é nullable, mas tipar via migration explícita para entrar nos types).

Adicionar tabela única para bloqueios/férias/datas especiais:
```text
availability_overrides
  id, user_id, clinic_id (null=pessoal), date_from, date_to,
  type ('block'|'vacation'|'special_hours'),
  start_time, end_time, breaks jsonb, reason text
```

Resolução em runtime: template semanal → override de data específica → bloqueio → resultado final consultado pela IA.

### 2.5 Convênios

Generalizar `insurance_plans`:
```text
insurance_plans
  + owner_type    text  ('clinic'|'professional')
  + user_id       uuid  null   (quando owner_type='professional')
  clinic_id   passa a ser nullable
```

Plus tabela ponte para "este profissional aceita estes planos da clínica X":
```text
professional_insurance_plans
  user_id, insurance_plan_id, clinic_id (null=contexto pessoal),
  is_active, notes
  PK composta
```

Permite as três regras pedidas: convênios da clínica, convênios pessoais, convênios válidos só num vínculo específico.

### 2.6 Secretária IA — identificação de contexto

Fluxo de uma mensagem WhatsApp:
1. Mensagem chega no número → backend identifica `ai_tenant_id` pelo número conectado (`whatsapp_connections.ai_tenant_id`).
2. `resolve_ai_context(ai_tenant_id)` retorna: `{owner_type, clinic_id?, professionals[], insurance_plans[], availability_resolver, branding}`.
3. Se `owner_type='clinic'`: oferece todos profissionais do `clinic_members`, todos convênios via `insurance_plans WHERE clinic_id=X`.
4. Se `owner_type='professional'`: usa só aquele user, convênios via `insurance_plans WHERE user_id=Y` ∪ `professional_insurance_plans WHERE clinic_id IS NULL`.
5. Branding: do `ai_tenants.branding`, fallback para `clinics.logo_url` ou `profiles.avatar_url`.

### 2.7 O que está preso em clinic_id (precisa soltar)
- `ai_secretary_config`, `ai_secretary_handoff`, `whatsapp_messages` (NOT NULL clinic_id).
- `professional_availability.clinic_id` NOT NULL.
- `insurance_plans.clinic_id` NOT NULL.
- `prescription_templates.clinic_id` NOT NULL — também impede profissional individual de ter receituário próprio.
- `clinic_rooms.clinic_id` NOT NULL (ok manter — sala é conceito de clínica).
- `useAiSync(clinicId)` no `AppLayout` — passar a aceitar `aiTenantId`.

## 3. Ordem segura de implementação (faseada, não-quebradora)

**Fase 0 — Preparação (sem mudança de comportamento)**
- Criar `ai_tenants` + função `resolve_or_create_ai_tenant_for_clinic(clinic_id)` e `..._for_user(user_id)`.
- Backfill: 1 ai_tenant por clínica existente.
- Adicionar coluna `ai_tenant_id` (nullable) em `ai_secretary_config`, `ai_secretary_handoff`, `whatsapp_messages` e popular via trigger/backfill. Manter `clinic_id` por enquanto.

**Fase 1 — Soltar NOT NULL e estender domínios**
- `professional_availability.clinic_id` → nullable + índice único atualizado.
- `insurance_plans.clinic_id` → nullable + adicionar `owner_type`, `user_id`.
- `prescription_templates.clinic_id` → nullable + adicionar `user_id`.
- Criar `availability_overrides` e `professional_insurance_plans`.
- Atualizar RLS de cada tabela para aceitar contexto pessoal (`clinic_id IS NULL AND user_id = auth.uid()`).

**Fase 2 — Estender appointments**
- Adicionar `ai_tenant_id`, `source`, `channel`, `mode`, `insurance_plan_id`, `context_type` (todos com default seguro). RLS não muda.

**Fase 3 — Adaptar frontend incrementalmente**
- `useAiSync`: passar a resolver tenant via hook `useAiTenant()` (que retorna o tenant do contexto atual — clínica ou pessoal).
- Em `isPersonalMode`, montar `useAiSync` com tenant pessoal.
- Telas existentes seguem usando `currentClinicId`; só os pontos de IA migram para `aiTenantId`.

**Fase 4 — Cortar legado (depois de tudo verde)**
- Tornar `ai_tenant_id` NOT NULL nas tabelas de IA.
- Remover `clinic_id` das tabelas de IA (ou manter como coluna gerada).

## 4. Impacto esperado

**Supabase**
- ~6 migrations (criação `ai_tenants`, alteração de NOT NULL em 3 tabelas, novas tabelas `availability_overrides` e `professional_insurance_plans`, extensão de `appointments`, extensão de `insurance_plans`/`prescription_templates`).
- ~12 políticas RLS reescritas para aceitar `(clinic_id IS NULL AND user_id = auth.uid())` ou `ai_tenant` do usuário.
- Funções novas: `resolve_ai_tenant`, `user_owns_ai_tenant(uuid)`.

**Frontend (mínimo, sem refactor amplo)**
- Novo hook `useAiTenant()` (substitui `clinicId` nos pontos de IA).
- `useAiSync` aceita `aiTenantId`.
- `aiBackend.ts`: endpoints aceitam `ai_tenant_id` (manter `clinic_id` como alias até Fase 4).
- `SecretariaIA.tsx`: deixar de bloquear `!currentClinicId` quando há tenant pessoal.
- `InsurancePlansSection`, `Availability` páginas: aceitar criar planos/disponibilidades pessoais quando `isPersonalMode`.
- Nenhuma tela de agenda/paciente/financeiro precisa mudar — já operam com `clinic_id` nullable.

## 5. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Quebrar RLS soltando NOT NULL | Cada migration roda com nova policy ANTES do drop NOT NULL; testar com `EXPLAIN` |
| Types do Supabase desalinhados | Rodar migration sozinha (sem código) e regenerar types antes de tocar front |
| Backend de IA externo só conhece `clinic_id` | Manter `clinic_id` nas tabelas e nos payloads como alias até backend migrar; resolver tenant server-side |
| Duplicação de `ai_tenant` para mesma clínica | UNIQUE parcial + função `resolve_or_create` idempotente |
| Convênios duplicados (clínica vs profissional) | UI deduplicar por `ans_code` na visão da IA |
| `professional_schedule_template` fora dos types | Recriar a tabela em migration explícita e reutilizar (não recriar dados) |

## 6. Critérios de "pronto"

- Profissional sem clínica consegue: cadastrar disponibilidade, cadastrar convênios próprios, conectar WhatsApp à IA, receber agendamentos pela IA.
- Clínica continua funcionando 100% como hoje.
- Nenhuma query do frontend atual precisa ser reescrita para continuar passando.
- IA recebe `ai_tenant_id` e descobre sozinha o contexto.

---

Sem mudanças de código ainda. Aguardando aprovação para começar pela **Fase 0** (criar `ai_tenants` + backfill, sem impacto em telas).
