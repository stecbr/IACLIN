# Simplificar Personalização Avançada de Tema

Remover toda a edição manual e manter apenas a grade de paletas inteligentes (ampliada) + botão de restaurar padrão.

## Alterações em `src/components/settings/ThemeCustomizer.tsx`

### Remover
- Seções: **Superfícies**, **Identidade**, **Detalhes** (3 grupos de color pickers)
- Seção **Tons derivados da primária** (ramp)
- Sliders **Intensidade da sombra** e **Arredondamento**
- Seção **Pré-visualização ao vivo**
- Switch **Contraste automático**
- Imports não usados (`Slider`, `Switch`, `PremiumColorPicker`, `shadeRamp`, `Wand2`, `useState`, `useAuth`, `COLOR_FIELDS`, `CustomThemeKey` se não usado)

### Manter / ajustar
- Header do card (título "Personalização avançada")
- Grade de **Paletas inteligentes** (ampliada para 20+ opções, incluindo vermelha, vinho, rosa e variações)
- Botão **Restaurar padrão**
- Atualizar `CardDescription` para refletir que agora é só seleção de paleta pronta

### Ampliar PRESETS para 20+ paletas
Adicionar/substituir mantendo as 5 atuais (Oceano, Floresta, Pôr-do-sol, Minimalista, Rosé Couture) e incluir:

1. Vermelho Rubi
2. Vinho Bordeaux
3. Rosa Millennial
4. Rosa Pink Vibrante
5. Magenta Berry
6. Coral Suave
7. Lilás Lavanda
8. Roxo Imperial
9. Violeta Profundo
10. Turquesa Tropical
11. Azul Marinho Clássico
12. Verde Esmeralda
13. Verde Menta
14. Amarelo Mostarda
15. Âmbar Dourado
16. Terracota Rústico
17. Café Expresso
18. Grafite Moderno
19. Cinza Nórdico
20. Petróleo Sofisticado

Cada preset com `colors` (background, foreground, primary, primaryForeground, card, accent, border) + `radius` + `shadowIntensity` coerentes — paletas claras adequadas ao light mode (a customização só se aplica no modo claro, conforme `CustomThemeProvider`).

### Layout da grade
Manter visual atual de cards-swatch, mas em grid responsivo `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5` para acomodar 20+ itens sem ficar apertado.

## Não alterar
- `CustomThemeProvider.tsx` — API permanece igual (`applyPreset` e `resetCustom` já existem)
- `AppearanceSettingsSection.tsx` — continua renderizando `<ThemeCustomizer />`
- `PremiumColorPicker.tsx` — não usado mais aqui, mas pode permanecer no projeto caso usado em outro lugar
