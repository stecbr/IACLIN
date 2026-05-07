# Logo personalizada da clínica/médico no topo

Hoje a logo IACLIN aparece no header e no sidebar para todos os usuários. Vamos permitir que cada clínica (incluindo a "clínica pessoal" do médico solo) personalize com a própria logo, e opcionalmente esconda a logo IACLIN.

## Comportamento

- Em **Configurações → Dados da Clínica**: o upload de logo já existe. Vamos adicionar logo abaixo um checkbox **"Ocultar logo IACLIN"**.
- No **header (mobile)** e no **sidebar (desktop)**, ao carregar, busca a clínica atual:
  - Se `hide_iaclin_logo = true` e `logo_url` definida → mostra **somente** a logo da clínica no lugar da IACLIN.
  - Se `hide_iaclin_logo = false` e `logo_url` definida → mostra **IACLIN + logo da clínica** lado a lado (com um separador `·`).
  - Se não houver `logo_url` → mostra apenas IACLIN (comportamento atual).
- Médico vinculado a uma clínica: vê a logo da clínica vinculada (já que `currentClinicId` = clínica do dono).
- Médico solo: tem a própria clinic record (criada no onboarding), então mesma tela de Configurações funciona.

## Mudanças técnicas

1. **Migration**: adicionar coluna `hide_iaclin_logo BOOLEAN NOT NULL DEFAULT false` em `public.clinics`.
2. **`src/pages/SettingsPage.tsx`**: 
   - Adicionar checkbox "Ocultar logo IACLIN" próximo ao upload de logo.
   - Salvar via `supabase.from('clinics').update({ hide_iaclin_logo })`.
3. **Novo hook `src/hooks/useClinicBranding.ts`**: lê `currentClinicId` e retorna `{ logoUrl, hideIaclinLogo }` com cache simples.
4. **`src/components/AppSidebar.tsx`** e **`src/components/AppLayout.tsx`**: usar o hook para renderizar:
   - `hideIaclinLogo && logoUrl` → `<img src={logoUrl} />`
   - `logoUrl` → `<img IACLIN /> <span>·</span> <img src={logoUrl} />`
   - default → IACLIN só.
5. **`src/lib/clinicalDocsHelpers.ts`** já busca `logo_url`; sem mudança.

## Fora de escopo

- Não muda PDFs/laudos (continuam usando logo da clínica como hoje).
- Não muda páginas públicas (marketplace).
