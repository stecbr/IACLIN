import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Wallet, Receipt } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface Props {
  transactions: any[];
  period: { start: Date; end: Date };
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function SoloFinanceOverview({ transactions, period }: Props) {
  const { user, currentClinicId } = useAuth();
  const now = new Date();
  const chartStart = startOfMonth(subMonths(now, 5));
  const chartEnd = endOfMonth(now);

  // Paid totals within the active period
  const paidIncome = transactions
    .filter((t) => t.type === 'income' && t.status === 'paid')
    .reduce((s, t) => s + Number(t.amount), 0);

  const paidExpense = transactions
    .filter((t) => t.type === 'expense' && t.status === 'paid')
    .reduce((s, t) => s + Number(t.amount), 0);

  const net = paidIncome - paidExpense;

  // Completed appointments in the same period (for ticket médio)
  const { data: completedCount = 0 } = useQuery({
    queryKey: [
      'solo-completed-apts',
      currentClinicId ?? user?.id,
      format(period.start, 'yyyy-MM-dd'),
      format(period.end, 'yyyy-MM-dd'),
    ],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .in('status', ['completed', 'finished', 'done'])
        .gte('start_time', period.start.toISOString())
        .lte('start_time', period.end.toISOString());
      if (currentClinicId) q = q.eq('clinic_id', currentClinicId);
      else if (user) q = q.eq('dentist_id', user.id);
      const { count } = await q;
      return count ?? 0;
    },
  });

  const ticket = completedCount > 0 ? paidIncome / completedCount : 0;

  // 6-month series (paid_date based)
  const { data: chartRaw = [] } = useQuery({
    queryKey: [
      'solo-finance-chart-6m',
      currentClinicId ?? user?.id,
      format(chartStart, 'yyyy-MM'),
    ],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from('financial_transactions')
        .select('type, amount, paid_date')
        .eq('status', 'paid')
        .gte('paid_date', format(chartStart, 'yyyy-MM-dd'))
        .lte('paid_date', format(chartEnd, 'yyyy-MM-dd'));
      if (currentClinicId) q = q.eq('clinic_id', currentClinicId);
      else if (user) q = q.is('clinic_id', null).eq('dentist_id', user.id);
      const { data } = await q;
      return data ?? [];
    },
  });

  const chartData = useMemo(() => {
    const buckets: Record<string, { month: string; income: number; expense: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(now, i);
      const key = format(m, 'MMM', { locale: ptBR });
      buckets[key] = { month: key, income: 0, expense: 0 };
    }
    (chartRaw as any[]).forEach((tx) => {
      if (!tx.paid_date) return;
      const key = format(parseISO(tx.paid_date), 'MMM', { locale: ptBR });
      if (!buckets[key]) return;
      if (tx.type === 'income') buckets[key].income += Number(tx.amount);
      else buckets[key].expense += Number(tx.amount);
    });
    return Object.values(buckets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartRaw]);

  const kpis = [
    { label: 'Faturamento bruto', value: fmt(paidIncome), icon: TrendingUp, color: 'text-success', bg: 'bg-success/10' },
    { label: 'Despesas totais',   value: fmt(paidExpense), icon: TrendingDown, color: 'text-destructive', bg: 'bg-destructive/10' },
    { label: 'Lucro líquido',     value: fmt(net),         icon: Wallet,    color: net >= 0 ? 'text-success' : 'text-destructive', bg: net >= 0 ? 'bg-success/10' : 'bg-destructive/10' },
    { label: 'Ticket médio',      value: fmt(ticket),      icon: Receipt,   color: 'text-primary', bg: 'bg-primary/10' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="shadow-card border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <div className={`h-8 w-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-foreground tabular-nums">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Evolução nos últimos 6 meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => fmt(value)}
                  contentStyle={{ borderRadius: '0.5rem', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                />
                <Legend />
                <Bar dataKey="income"  name="Receita" fill="hsl(var(--success))"     radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Despesa" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}