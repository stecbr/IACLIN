import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type LucideIcon } from 'lucide-react';
import { AnimatedNumber } from '@/components/dashboard/AnimatedNumber';
import { PageHeader } from '@/components/PageHeader';
import { ViewModeToggle } from '@/components/ViewModeToggle';

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <Card
            key={kpi.title}
            className="group relative overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 border-border/50 hover:-translate-y-0.5"
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