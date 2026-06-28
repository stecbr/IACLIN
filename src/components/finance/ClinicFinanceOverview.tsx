import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users2, Wrench, PiggyBank } from 'lucide-react';

interface Props {
  transactions: any[];
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Aggregated finance KPIs for clinic admins/owners (multi-member).
 * Pure presentational: receives the already-fetched paid transactions.
 */
export function ClinicFinanceOverview({ transactions }: Props) {
  const paidIncome = transactions
    .filter((t) => t.type === 'income' && t.status === 'paid')
    .reduce((s, t) => s + Number(t.amount), 0);

  const allCommissions = transactions.filter(
    (t) => t.type === 'expense' && t.category === 'commission'
  );
  const commissionsPending = allCommissions
    .filter((t) => t.status !== 'paid')
    .reduce((s, t) => s + Number(t.amount), 0);
  const commissionsPaid = allCommissions
    .filter((t) => t.status === 'paid')
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalCommissions = commissionsPending + commissionsPaid;

  const operationalExpenses = transactions
    .filter(
      (t) =>
        t.type === 'expense' &&
        t.category !== 'commission' &&
        t.status === 'paid'
    )
    .reduce((s, t) => s + Number(t.amount), 0);

  const netMargin = paidIncome - operationalExpenses - totalCommissions;

  const cards = [
    {
      label: 'Faturamento bruto',
      value: fmt(paidIncome),
      icon: TrendingUp,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      label: 'Repasses gerados',
      value: fmt(totalCommissions),
      sub: `${fmt(commissionsPending)} pendentes · ${fmt(commissionsPaid)} pagos`,
      icon: Users2,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Despesas operacionais',
      value: fmt(operationalExpenses),
      icon: Wrench,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
    },
    {
      label: 'Margem líquida',
      value: fmt(netMargin),
      icon: PiggyBank,
      color: netMargin >= 0 ? 'text-success' : 'text-destructive',
      bg: netMargin >= 0 ? 'bg-success/10' : 'bg-destructive/10',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} className="shadow-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {c.label}
            </CardTitle>
            <div className={`h-8 w-8 rounded-lg ${c.bg} flex items-center justify-center`}>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground tabular-nums">
              {c.value}
            </div>
            {c.sub && (
              <p className="text-[11px] text-muted-foreground mt-1 truncate">{c.sub}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}