## Objetivo
Transformar a grade de KPIs do dashboard (atualmente comprimida em 4-6 cards apertados) em um carrossel horizontal arrastável, mantendo todos os cards no tamanho ideal e permitindo navegar deslizando com mouse (drag) ou toque.

## Mudança
Arquivo único: `src/components/dashboard/SpecialtyHomeShell.tsx`

Substituir o `<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">` por um carrossel horizontal com scroll-snap + arrastar.

### Comportamento
- Largura fixa por card (ex.: `min-w-[220px] max-w-[240px]`) para que todos fiquem legíveis sem espremer texto/valor.
- Container `overflow-x-auto` com `scroll-snap-type: x mandatory` e `snap-align: start` em cada card.
- Arrastar com mouse (click-and-drag) além do scroll nativo touch/trackpad:
  - Handlers `onMouseDown/Move/Up/Leave` ajustando `scrollLeft` (padrão clássico, sem libs).
  - `cursor-grab` / `active:cursor-grabbing`.
- Setas laterais discretas (chevron left/right) que aparecem em `hover` no desktop e fazem `scrollBy({ left: ±cardWidth, behavior: 'smooth' })`. Ocultas no mobile (usuário desliza com o dedo).
- Esconder scrollbar visualmente (`scrollbar-hide` ou estilo inline `[&::-webkit-scrollbar]:hidden`).
- Animação `slide-up` por card mantida.

### Sem efeitos colaterais
- Nenhuma mudança na API `KpiSpec` nem nos consumidores (`DentistHome`, `MedicalHome`, `PsiHome`, `NutritionHome`, etc.) — todos passam `kpis: KpiSpec[]` e o shell decide o layout.
- Sem alteração no resto do dashboard (gráficos abaixo permanecem).

## Resultado
- Médico/Dentista/Psi/Nutri verão todos os KPIs em uma faixa única e arrastável, sem cards apertados.
- Mobile: swipe nativo. Desktop: drag com mouse + setas no hover.
