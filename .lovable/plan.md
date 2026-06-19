## Objetivo

Trocar a logo atual (light/dark) pelo novo símbolo "VA" enviado e, na home (Landing), exibir o nome **IACLIN** ao lado do símbolo, com **IA** em `#033563` e **CLIN** em `#5b6887`.

## Mudanças

1. **Upload do novo asset** via `lovable-assets` a partir de `/mnt/user-uploads/logo-iaclin-2.png` → gera `src/assets/iaclin-logo.png.asset.json`.

2. **Substituir os imports antigos** (`logo-light.png` e `logo-dark.png`) pelo novo asset único em todos os arquivos que hoje importam essas imagens:
   - `src/components/AppLayout.tsx`
   - `src/components/AppSidebar.tsx`
   - `src/components/PatientSidebar.tsx`
   - `src/components/PatientLayout.tsx`
   - `src/components/marketplace/MarketplaceHeader.tsx`
   - `src/components/superadmin/SuperAdminLayout.tsx`
   - `src/components/operadora/OperatorLayout.tsx`
   - `src/components/settings/MyCredentialingSection.tsx`
   - `src/pages/Landing.tsx`
   - `src/pages/Auth.tsx`
   - `src/pages/ResetPassword.tsx`
   - `src/pages/operadora/OperatorSettings.tsx`
   - `src/pages/operadora/OperatorProfessionals.tsx`

   Como o novo símbolo é colorido (gradiente azul/teal) e funciona bem em qualquer fundo, ele substituirá tanto a variante clara quanto a escura — o switch por tema deixa de ser necessário nesses locais.

3. **Wordmark na Landing (home)**: ao lado do símbolo no header e/ou hero, renderizar:
   ```tsx
   <span className="font-bold tracking-tight text-2xl">
     <span style={{ color: '#033563' }}>IA</span>
     <span style={{ color: '#5b6887' }}>CLIN</span>
   </span>
   ```
   Aplicado apenas em `src/pages/Landing.tsx` (home pública), conforme pedido.

4. **Limpeza**:
   - Remover `src/assets/logo-light.png` e `src/assets/logo-dark.png`.
   - Remover `src/assets/iaclin-default-logo.png.asset.json` (asset antigo não usado nos imports principais — confirmar com grep antes de deletar) via `assets--delete_asset`.

## Fora de escopo
- Favicon (`public/`) — não foi pedido.
- Branding dinâmico da clínica (`useClinicBranding` / `logo_url` do tenant) permanece intacto.
- Não adicionar o wordmark em sidebars/headers internos — somente na home pública.
