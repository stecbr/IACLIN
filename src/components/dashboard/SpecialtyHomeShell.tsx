import { ReactNode, useRef, useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { AnimatedNumber } from '@/components/dashboard/AnimatedNumber';
import { PageHeader } from '@/components/PageHeader';
import { ViewModeToggle } from '@/components/ViewModeToggle';
import { Button } from '@/components/ui/button';

export interface KpiSpec {
  title: string;
  value: number;
  desc: string;
  icon: LucideIcon;
  color: string; // tailwind text-* class
  bg: string;    // tailwind bg-* class
  formatter?: (v: number) => string;
}

/**
 * Common shell used by every per-specialty Home dashboard. Renders the
 * greeting header, a 4-column KPI grid and a slot for the body content.
 */
export function SpecialtyHomeShell({
  title,
  description,
  kpis,
  children,
}: {
  title: string;
  description: string;
  kpis: KpiSpec[];
  children: ReactNode;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ down: false, startX: 0, startScroll: 0, moved: false });
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [updateArrows, kpis.length]);

  const onMouseDown = (e: React.MouseEvent) => {
    const el = scrollerRef.current;
    if (!el) return;
    dragState.current = { down: true, startX: e.pageX, startScroll: el.scrollLeft, moved: false };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const el = scrollerRef.current;
    if (!el || !dragState.current.down) return;
    const dx = e.pageX - dragState.current.startX;
    if (Math.abs(dx) > 4) dragState.current.moved = true;
    el.scrollLeft = dragState.current.startScroll - dx;
  };
  const endDrag = () => {
    dragState.current.down = false;
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (dragState.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      dragState.current.moved = false;
    }
  };

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const step = Math.max(240, Math.round(el.clientWidth * 0.7));
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  return (
    <div className="space-y-8">
      <PageHeader title={title} description={description}>
        <ViewModeToggle />
      </PageHeader>

      <div className="group/carousel relative -mx-1">
        {canLeft && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label="Anterior"
            onClick={() => scrollBy(-1)}
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full shadow-md opacity-0 group-hover/carousel:opacity-100 transition-opacity"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        {canRight && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label="Próximo"
            onClick={() => scrollBy(1)}
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full shadow-md opacity-0 group-hover/carousel:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
        <div
          ref={scrollerRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onClickCapture={onClickCapture}
          className="flex gap-4 overflow-x-auto px-1 py-1 select-none cursor-grab active:cursor-grabbing snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {kpis.map((kpi, i) => (
            <Card
              key={kpi.title}
              className="group relative overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 border-border/50 hover:-translate-y-0.5 snap-start shrink-0 w-[220px]"
              style={{ animationDelay: `${i * 80}ms`, animation: 'slide-up 0.4s ease-out backwards' }}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
                <div className={`h-9 w-9 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <AnimatedNumber value={kpi.value} className="text-2xl font-semibold text-foreground" formatter={kpi.formatter} />
                <p className="mt-1 text-xs text-muted-foreground">{kpi.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {children}
    </div>
  );
}

export function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}