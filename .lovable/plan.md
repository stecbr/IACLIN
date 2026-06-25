## Objetivo
Substituir o scroller manual atual em `SpecialtyHomeShell.tsx` por um carrossel baseado em Embla (via componente `Carousel` do shadcn já presente em `src/components/ui/carousel.tsx`), com cards mais respirados e responsivos.

## Mudanças em `src/components/dashboard/SpecialtyHomeShell.tsx`

1. **Trocar implementação custom por shadcn `Carousel`**
   - Importar `Carousel`, `CarouselContent`, `CarouselItem`, `CarouselPrevious`, `CarouselNext` de `@/components/ui/carousel`.
   - Configurar `opts={{ align: 'start', dragFree: true, containScroll: 'trimSnaps' }}` — `dragFree` dá a sensação de "clicar e arrastar" livremente em vez de snap rígido.
   - Remover toda a lógica manual de `scrollerRef`, `onMouseDown/Move/Up`, `dragState`, `updateArrows`, `canLeft/Right` e os botões `ChevronLeft/Right` custom.

2. **Larguras responsivas dos `CarouselItem`** (basis controla quantos cards aparecem)
   - Mobile: `basis-[85%]` → 1 card inteiro + pedaço do próximo (atende o requisito 3).
   - `sm`: `sm:basis-1/2` → 2 cards.
   - `md`: `md:basis-1/3` → 3 cards.
   - `lg`: `lg:basis-1/4` → ~4 cards visíveis em desktop.
   - O `CarouselContent` já aplica `-ml-4` e cada item `pl-4`, garantindo `gap-4` equilibrado.

3. **Padding interno e tipografia dos cards (anti-quebra de título)**
   - `CardHeader`: `p-5 pb-3` com `flex items-start justify-between gap-4`.
   - `CardTitle`: `text-sm font-medium text-muted-foreground leading-snug line-clamp-2` (limita a 2 linhas — "Atendimentos Concluídos Hoje" cabe confortavelmente em 2 linhas com a largura ~1/4 do container).
   - Ícone: manter `h-9 w-9 shrink-0` com `bg`/`color` semânticos.
   - `CardContent`: `p-5 pt-0` com valor `text-2xl font-semibold` e `desc` em `mt-2 text-xs text-muted-foreground`.
   - Card: manter `shadow-card hover:shadow-card-hover`, `hover:-translate-y-0.5`, animação `slide-up` escalonada — remover `w-[260px]` fixo (largura agora vem do `basis` do item).

4. **Posicionamento das setas (`CarouselPrevious`/`CarouselNext`)**
   - shadcn posiciona em `-left-12/-right-12` por padrão (fora do container). Para não vazar do layout, sobrescrever com `className="left-1 md:-left-4"` e `right-1 md:-right-4`, escondendo no mobile via `hidden md:flex` (mobile usa swipe nativo).

5. **Container externo**
   - Manter wrapper `relative` sem `-mx-1` para alinhar com o restante da página.
   - `overflow-visible` no Carousel raiz para as setas externas; `CarouselContent` já tem `overflow-hidden`.

## Nada que muda
- Assinatura de `SpecialtyHomeShell` e `KpiSpec` permanece igual — todas as Home pages (DentistHome, MedicalHome, PsiHome, NutritionHome) continuam funcionando sem alteração.
- `AnimatedNumber`, `PageHeader`, `ViewModeToggle` inalterados.
- Sem mudança em backend ou outros arquivos.

## Validação
- Verificar visualmente em 3 breakpoints (mobile ~390px, tablet ~768px, desktop ≥1280px) que: drag funciona, títulos não quebram em 3+ linhas, gap uniforme, setas aparecem só em desktop e ficam dentro do viewport.
