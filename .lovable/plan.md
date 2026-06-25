## Causa raiz

A tela do print é renderizada por `src/pages/dentist/DentistHome.tsx`, que **não usa** o `SpecialtyHomeShell`. Ele monta seu próprio `<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-{n} xl:grid-cols-7">` (linhas 271-299) com até 7 cards forçados em colunas estreitas — daí o "Atendimentos Concluídos Hoje" quebrando em 3 linhas. As mudanças anteriores no `SpecialtyHomeShell` só afetam `MedicalHome`, `PsiHome` e `NutritionHome`.

## Mudanças

### 1. `src/pages/dentist/DentistHome.tsx`
Substituir o bloco `{/* ── KPIs ── */}` (linhas 271-299) por um Carousel shadcn, mantendo o array `kpiCards` exatamente como está (com `gradient`, `currency`, `click` etc.).

- Importar `Carousel`, `CarouselContent`, `CarouselItem`, `CarouselPrevious`, `CarouselNext` de `@/components/ui/carousel`.
- Estrutura exata:

```tsx
<Carousel
  opts={{ align: 'start', dragFree: true, containScroll: 'trimSnaps' }}
  className="w-full overflow-visible"
>
  <CarouselContent className="-ml-4">
    {kpiCards.map((kpi, i) => (
      <CarouselItem
        key={kpi.title}
        className="pl-4 basis-[85%] sm:basis-1/2 md:basis-1/3 lg:basis-1/4"
      >
        <Card
          onClick={kpi.click}
          role={kpi.click ? 'button' : undefined}
          tabIndex={kpi.click ? 0 : undefined}
          onKeyDown={kpi.click ? (e:any)=>{ if(e.key==='Enter') kpi.click(); } : undefined}
          className={`relative w-full h-full overflow-hidden border-0 shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5 ${kpi.click ? 'cursor-pointer' : ''}`}
          style={{ animationDelay: `${i*60}ms`, animation: 'slide-up 0.4s ease-out backwards' }}
        >
          <div className={`absolute inset-0 opacity-10 ${kpi.gradient}`} />
          <CardHeader className="relative p-5 pb-3 flex flex-row items-start justify-between gap-4 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground leading-snug line-clamp-2">
              {kpi.title}
            </CardTitle>
            <div className={`h-9 w-9 shrink-0 rounded-xl ${kpi.gradient} flex items-center justify-center`}>
              <kpi.icon className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent className="relative p-5 pt-0">
            <AnimatedNumber
              value={kpi.value}
              className="text-2xl font-semibold tracking-tight"
              formatter={kpi.currency ? brl : undefined}
            />
            <p className="mt-2 text-xs text-muted-foreground">{kpi.desc}</p>
          </CardContent>
        </Card>
      </CarouselItem>
    ))}
  </CarouselContent>
  <CarouselPrevious className="hidden md:flex left-1 md:-left-4" />
  <CarouselNext className="hidden md:flex right-1 md:-right-4" />
</Carousel>
```

- Remover qualquer largura fixa (`w-[260px]`, `w-64` etc.) — nenhuma deve existir no Card.
- Manter `kpiCards`, `baseKpis`, `ownerKpis`, `setSessionsOpen` e demais comportamentos intactos.

### 2. `src/components/dashboard/SpecialtyHomeShell.tsx`
Já está conforme as diretrizes (basis responsivo, `w-full h-full`, padding `p-5`, `line-clamp-2`, setas `hidden md:flex`). Garantir apenas que o `Carousel` raiz tenha `className="w-full overflow-visible relative"` para bater 100% com a estrutura solicitada.

## Não muda
- `MedicalHome`, `PsiHome`, `NutritionHome`, `DentistHome` continuam com as mesmas queries, KPIs e seções de gráfico/agenda.
- Nenhuma lógica manual de drag/scrollRef/Chevron antiga precisa ser removida — não existe nesses arquivos hoje.

## Validação
Após build, abrir `/` como dentista (clínico geral) em ~1280px e ~390px:
- Títulos longos limitados a 2 linhas, nunca 3+.
- 4 cards visíveis em desktop, 1 + pedaço do próximo em mobile.
- Drag livre funcionando; setas só em ≥md, dentro do viewport.
