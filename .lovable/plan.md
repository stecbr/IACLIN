## Personalização avançada de Aparência (Médico/Clínica)

Adicionar, dentro de **Configurações → Aparência** (e replicar para a área do dentista em `PatientSettings`-like, mas focando no `SettingsPage` da clínica e numa nova seção em `DentistHome`/perfil do médico), um painel de **Tema personalizado** onde o usuário escolhe livremente cores de fundo, primária (botões), cartões e intensidade de sombras — preservando os modos Claro / Escuro / Sistema como "presets" para voltar ao padrão.

### O que será entregue

1. **Novo contexto `CustomThemeProvider`** (`src/components/CustomThemeProvider.tsx`)
   - Aplica overrides de CSS variables (`--background`, `--foreground`, `--primary`, `--primary-foreground`, `--card`, `--accent`, `--border`, `--ring`, `--shadow-card`, `--shadow-card-hover`, `--radius`) no `document.documentElement` via `style.setProperty`.
   - Persiste em `localStorage` por usuário (`iaclin-custom-theme:{userId}`) — não vai ao banco no MVP (zero migration).
   - Expõe `customTheme`, `setColor(key, hex)`, `setShadowIntensity(n)`, `setRadius(n)`, `resetCustom()`.
   - Quando o usuário clica em "Voltar ao padrão" ou troca para Claro/Escuro/Sistema, limpa os overrides e o `ThemeProvider` existente assume.
   - Conversão hex → HSL (string `H S% L%`) para compatibilidade com as variáveis do `index.css`.

2. **Componente `ThemeCustomizer`** (`src/components/settings/ThemeCustomizer.tsx`)
   - Color pickers (input nativo `type="color"` + hex manual) para:
     - Fundo da página
     - Cor primária / botões
     - Cor de cartões
     - Cor de destaque (accent)
     - Cor de borda
   - Slider de **Intensidade de sombra** (0–100%).
   - Slider de **Arredondamento** (0–24px) para `--radius`.
   - **Presets rápidos**: "Oceano", "Floresta", "Pôr-do-sol", "Minimalista" (4 chips de paleta).
   - Pré-visualização ao vivo (card de exemplo com botão, badge e texto).
   - Botões: **Aplicar**, **Restaurar padrão**.

3. **Integração**
   - `SettingsPage.tsx` → expandir `AppearanceSection` mantendo o seletor Claro/Escuro/Sistema atual e adicionando abaixo o `ThemeCustomizer`.
   - Para a área do médico: adicionar uma página/aba "Aparência" acessível a partir do `DentistHome` (ou via `Profile.tsx`), reutilizando o mesmo `ThemeCustomizer`. Verificarei `Profile.tsx` para encaixar lá se já existir uma seção de preferências; caso contrário, criar `src/pages/dentist/DentistAppearance.tsx` com rota `/dentist/appearance` e link no menu do dentista.
   - `App.tsx` → envolver com `<CustomThemeProvider>` logo dentro do `<ThemeProvider>` existente.

4. **Comportamento "voltar ao padrão"**
   - Ao escolher um dos 3 modos (Claro/Escuro/Sistema) o customizer mostra aviso "Tema personalizado desativado" e remove overrides.
   - Botão explícito **"Restaurar padrão"** sempre visível.

### Observações técnicas

- Sem migração de DB, sem Edge Function — tudo client-side e por usuário.
- Cores armazenadas em hex no `localStorage`; convertidas para HSL ao aplicar para casar com o sistema de tokens existente (`hsl(var(--primary))`).
- Não altera o `ThemeProvider` atual; apenas sobrepõe variáveis quando o usuário define algo custom.
- Acessibilidade: validar contraste mínimo (aviso visual quando primária × foreground ficar ilegível, sem bloquear).

### Fora de escopo

- Sincronização entre dispositivos (sem persistir no Supabase agora).
- Personalização específica por clínica para todos os membros (cada usuário define a sua).
- Edição de tipografia.