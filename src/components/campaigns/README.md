# Campanhas — Estado real e briefing para o redesign

> **Leia isto antes de mexer.** Docs antigos (env var, "85% aguardando config",
> API fake em `localhost:3333`) foram REMOVIDOS por estarem errados. Este é o
> estado verdadeiro depois do commit `977bd15`.

---

## O que já funciona (NÃO refazer do zero — reusar)

### 1. Segmentação de público — `src/hooks/useCampaignAudience.ts`
`resolveCampaignAudience(clinicId, audienceType, filters)` resolve os 9 públicos
direto na base REAL do Supabase e devolve `{ recipients: [{patient_id, phone, name}], count }`.
Só inclui quem tem telefone.

| Público (`audienceType`) | Como filtra |
|---|---|
| `all` | todos da clínica |
| `active` | `patients.is_active = true` |
| `inactive` | `is_active = false` |
| `scheduled` | tem `appointments.start_time` futuro |
| `absent` | SEM consulta nos últimos X meses (`filters.last_visit_months`) |
| `birthday` | `date_of_birth` no mês atual |
| `private` | `insurance_provider` nulo |
| `insurance` | `insurance_provider = filters.insurance_plan` |
| `manual` | `filters.patient_ids` (usar `PatientPickerDialog`) |

**Não depende de `VITE_API_BASE_URL`.** É Supabase puro. Se for redesenhar a UI,
importe esse hook em vez de reescrever a lógica de filtro.

### 2. Disparo em massa — NÃO é pelo Supabase, é pelo backend IA
Quem envia WhatsApp é o backend em `https://iaclin.stec-apps.com` (Evolution),
acessível via `src/lib/aiBackend.ts` (URL já hardcoded lá). Fluxo:

```
POST /api/clinics/{clinicId}/campaigns            → cria (body inclui recipients[])
POST /api/clinics/{clinicId}/campaigns/{id}/send  → dispara em background
```

O backend já grava `campaign_sends` e usa `patient_name`/`patient_phone` da lista
enviada. **Não criar edge function que manda WhatsApp pelo Supabase** — ignoraria
a conexão Evolution existente e não enviaria nada.

---

## O redesign aprovado (o que fazer)

**UX:** trocar o wizard de 5 passos por uma tela única (2 colunas: "Para quem" |
"O que enviar" + rodapé de canal/agendar/enviar). Contador ao vivo de impactados
e de telefones válidos. Histórico abaixo.

**Persistência (opção B):** criar no Supabase, com RLS por `clinic_id`:
- `campaigns` (id, clinic_id, name, audience_type, filters jsonb, template,
  channels, status, scheduled_for, stats jsonb, created_at)
- `campaign_recipients` (id, campaign_id, patient_id, phone, name,
  whatsapp_status, sms_status, sent_at) — histórico de destinatários.

**Contrato do envio (manter):** ao enviar, o front (a) resolve recipients via
`useCampaignAudience`, (b) grava `campaigns`+`campaign_recipients` no Supabase,
(c) chama `aiBackend` → `/campaigns/{id}/send` passando os recipients. O backend
dispara e atualiza status.

---

## Correções já aplicadas (não regredir)
- `SelectItem value=""` crashava o Radix Select → tela branca. Usar sempre
  `value` não-vazio (sentinel `"all"` + handler converte pra `null`).
- Campo era `last_visit_days`/`last_visit_months`, NUNCA `lastConsultDays`.
- "Enviar agora" cria draft → pega `id` → `POST /send` (não manda `status:'sending'`
  no create; o backend ignora e força `draft`).

## Testar
Build local do IACLIN NÃO roda (falta dep `@lovable.dev/mcp-js`, só existe no
Lovable). Validar com `npx tsc --noEmit -p tsconfig.app.json`. Teste real: no
Lovable + backend `iaclin.stec-apps.com` rodando + WhatsApp conectado.
