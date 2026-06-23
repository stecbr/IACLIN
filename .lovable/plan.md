## Objetivo
Corrigir o bug **H-1** (CNPJ aceito sem validação de checksum, permitindo `00000000000000`) e validar o estado atual da **geolocalização** de clínicas usada nos mapas.

---

## Parte 1 — Validação de CNPJ (checksum)

### 1.1 Criar helper em `src/lib/cnpj.ts`
Análogo ao `src/lib/cpf.ts`, com:
- `formatCnpj(value)` — máscara `00.000.000/0000-00` (centraliza o que hoje está duplicado em 3 arquivos).
- `unmaskCnpj(value)` — só dígitos.
- `isValidCnpj(value)` — algoritmo oficial dos 2 DVs, rejeita comprimento ≠ 14 e sequências repetidas (`00000000000000`, `11111111111111`, …).

### 1.2 Aplicar `isValidCnpj` nos pontos de entrada
Substituir a checagem fraca `digits.length !== 14` por validação real, com mensagem `"CNPJ inválido. Confira os dígitos."`:

- **`src/pages/Auth.tsx`** — fluxos de signup `clinic` e `operadora` (linhas 306, 325) + dentro de `fetchCnpjData` antes de chamar a BrasilAPI.
- **`src/components/RegisterClinicDialog.tsx`** — submit + `fetchCnpj`.
- **`src/pages/Onboarding.tsx`** — `fetchCnpj` + submit do passo de identificação.
- **`src/components/settings/PaymentAccountSection.tsx`** — quando `pix_key_type === 'cnpj'` (linha 144).
- Também trocar os `formatCnpj` locais por import único do helper (remove duplicação).

### 1.3 (Opcional, mesma onda) Pequena dica de UX
Mostrar o aviso `"CNPJ inválido"` inline (abaixo do input) quando o usuário digitar 14 dígitos com checksum errado, sem esperar o submit — usando o estado `cnpjHint` que já existe em `Auth.tsx`/`RegisterClinicDialog.tsx`.

### 1.4 Sem mudanças de schema/backend
A edge function `create-own-clinic` apenas persiste o `cnpj` recebido — a validação é client-side (consistente com como o CPF é tratado hoje). Não há migration.

---

## Parte 2 — Verificação da Geolocalização

A geocodificação já existe e é razoavelmente robusta (`src/lib/geocode.ts`: cache em `localStorage` v5, BrasilAPI CEP, Nominatim com ranking por rua/bairro/cidade, fallbacks). Os consumidores principais são:

- `src/components/superadmin/ClinicsMapWidget.tsx` (mapa do superadmin)
- `src/components/marketplace/MarketplaceMap.tsx`
- `src/components/landing/LandingNetworkMap.tsx`
- `src/components/clinical-map/*`

### Verificação a executar (após aprovar a Parte 1)
Auditoria estática + smoke-test E2E:

1. **Estática:** confirmar que todas as clínicas seed do QA (`qa+clinica@iaclin.test`) terminam o cadastro com `city/state/zip_code` preenchidos — sem isso o `ClinicsMapWidget` filtra a clínica fora (linha `clinics.filter(c => c.city || c.state)`).
2. **E2E Playwright** (script novo `/tmp/browser/qa/geo.py`):
   - Login como super admin → abrir `/superadmin` → aguardar o widget de mapa → ler o contador "Mapeando X de Y" e confirmar `X === Y` para a clínica seed.
   - Abrir `/marketplace` sem filtro → checar marcadores renderizados.
   - Screenshot de cada passo em `/tmp/browser/qa/screenshots/`.
3. **Riscos conhecidos a reportar (não corrigir agora):**
   - Nominatim sem `User-Agent` customizado pode ser rate-limited (HTTP 403) em produção — boa prática do OSM, mas hoje funciona.
   - CEPs genéricos `…000` caem direto pra busca por rua/cidade (já tratado em `isGenericCep`).
   - Sem fallback se a clínica tiver só endereço sem cidade.

O resultado da verificação volta como um mini-relatório (Ok/Falha por consumidor + screenshots), sem alterações de código a menos que algo realmente quebre — nesse caso peço aprovação de uma nova onda.

---

## Arquivos afetados (Parte 1)
- **Criar:** `src/lib/cnpj.ts`
- **Editar:** `src/pages/Auth.tsx`, `src/components/RegisterClinicDialog.tsx`, `src/pages/Onboarding.tsx`, `src/components/settings/PaymentAccountSection.tsx`

## Fora de escopo
- Validar CNPJ no backend (edge function) — fica para uma onda futura junto com hardening de `create-own-clinic`.
- Reescrever pipeline de geocode (já está bom).
