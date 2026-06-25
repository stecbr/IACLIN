import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type LucideIcon } from 'lucide-react';
import { AnimatedNumber } from '@/components/dashboard/AnimatedNumber';
import { PageHeader } from '@/components/PageHeader';
import { ViewModeToggle } from '@/components/ViewModeToggle';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel';

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
  return (
    <div className="space-y-8">
      <PageHeader title={title} description={description}>
        <ViewModeToggle />
      </PageHeader>

      <Carousel
        opts={{ align: 'start', dragFree: true, containScroll: 'trimSnaps' }}
        className="relative"
      >
        <CarouselContent className="-ml-4">
          {kpis.map((kpi, i) => (
            <CarouselItem
              key={kpi.title}
              className="pl-4 basis-[85%] sm:basis-1/2 md:basis-1/3 lg:basis-1/4"
            >
              <Card
                className="group relative h-full overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 border-border/50 hover:-translate-y-0.5"
                style={{ animationDelay: `${i * 80}ms`, animation: 'slide-up 0.4s ease-out backwards' }}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-4 p-5 pb-3 space-y-0">
                  <CardTitle className="text-sm font-medium text-muted-foreground leading-snug line-clamp-2">
                    {kpi.title}
                  </CardTitle>
                  <div className={`h-9 w-9 shrink-0 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  <AnimatedNumber value={kpi.value} className="text-2xl font-semibold text-foreground" formatter={kpi.formatter} />
                  <p className="mt-2 text-xs text-muted-foreground">{kpi.desc}</p>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden md:flex left-1 lg:-left-4" />
        <CarouselNext className="hidden md:flex right-1 lg:-right-4" />
      </Carousel>

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