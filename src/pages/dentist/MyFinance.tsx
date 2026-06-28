import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Wallet, Clock, CheckCircle2, Receipt } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function MyFinance() {
  const { user, currentClinicId } = useAuth();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Commissions assigned to me (this clinic).
  const { data: commissions = [], isLoading } = useQuery({
    queryKey: ['my-commissions', user?.id, currentClinicId],
    enabled: !!user && !!currentClinicId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select(
          'id, amount, status, due_date, paid_date, appointment_id, notes, description, created_at, patients(full_name)'
        )
        .eq('clinic_id', currentClinicId!)
        .eq('dentist_id', user!.id)
        .eq('type', 'expense')
        .eq('category', 'commission')
        .order('created_at', { ascending: false })
        .limit(80);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Has any commission rule configured for me in this clinic?
  const { data: ruleCount = 0 } = useQuery({
    queryKey: ['my-commission-rules', user?.id, currentClinicId],
    enabled: !!user && !!currentClinicId,
    queryFn: async () => {
      const { count } = await supabase
        .from('commission_rules')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', currentClinicId!)
        .eq('dentist_id', user!.id);
      return count ?? 0;
    },
  });

  // My appointments this month (informational ticket médio).
  const { data: myMonthApts = [] } = useQuery({
    queryKey: ['my-month-apts', user?.id, currentClinicId, format(now, 'yyyy-MM')],
    enabled: !!user && !!currentClinicId,
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('id, status, start_time')
        .eq('clinic_id', currentClinicId!)
        .eq('dentist_id', user!.id)
        .in('status', ['completed', 'finished', 'done'])
        .gte('start_time', monthStart.toISOString())
        .lte('start_time', monthEnd.toISOString());
      return data ?? [];
    },
  });

  // My income transactions (for ticket médio).
  const { data: myIncomeMonth = [] } = useQuery({
    queryKey: ['my-income-month', user?.id, currentClinicId, format(now, 'yyyy-MM')],
    enabled: !!user && !!currentClinicId,
    queryFn: async () => {
      const { data } = await supabase
        .from('financial_transactions')
        .select('amount, status, paid_date')
        .eq('clinic_id', currentClinicId!)
        .eq('dentist_id', user!.id)
        .eq('type', 'income')
        .gte('paid_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('paid_date', format(monthEnd, 'yyyy-MM-dd'));
      return data ?? [];
    },
  });

  const monthFilter = (d: string | null) => {
    if (!d) return false;
    const dt = parseISO(d);
    return dt >= monthStart && dt <= monthEnd;
  };

  const toReceive = useMemo(
    () => commissions
      .filter((c: any) => c.status !== 'paid')
      .reduce((s: number, c: any) => s + Number(c.amount), 0),
    [commissions]
  );

  const receivedMonth = useMemo(
    () => commissions
      .filter((c: any) => c.status === 'paid' && monthFilter(c.paid_date))
      .reduce((s: number, c: any) => s + Number(c.amount), 0),
    [commissions]
  );

  const apptCountMonth = useMemo(() => {
    const ids = new Set<string>();
    (commissions as any[]).forEach((c) => {
      if (c.appointment_id && monthFilter(c.created_at)) ids.add(c.appointment_id);
    });
    // Fallback to appointments table if no commission yet linked.
    return ids.size || (myMonthApts as any[]).length;
  }, [commissions, myMonthApts]);

  const ticket = useMemo(() => {
    const paidIncome = (myIncomeMonth as any[])
      .filter((t) => t.status === 'paid')
      .reduce((s, t) => s + Number(t.amount), 0);
    const n = (myMonthApts as any[]).length;
    return n > 0 ? paidIncome / n : 0;
  }, [myIncomeMonth, myMonthApts]);

  const kpis = [
    { label: 'A receber',          value: fmt(toReceive),     icon: Clock,        color: 'text-warning',   bg: 'bg-warning/10' },
    { label: 'Recebido no mês',    value: fmt(receivedMonth), icon: CheckCircle2, color: 'text-success',   bg: 'bg-success/10' },
    { label: 'Atendimentos no mês',value: String(apptCountMonth), icon: Wallet,   color: 'text-primary',   bg: 'bg-primary/10' },
    { label: 'Ticket médio',       value: fmt(ticket),        icon: Receipt,      color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meu Financeiro"
        description="Acompanhe suas comissões, valores a receber e histórico de pagamentos."
      />

      {ruleCount === 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 text-sm text-foreground">
            Nenhuma regra de comissão está definida para você nesta clínica.
            Fale com a administração para configurar seu repasse — enquanto isso,
            seus valores a receber podem aparecer zerados.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="shadow-card border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
              <div className={`h-8 w-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-foreground tabular-nums">
                {kpi.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Extrato de comissões</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Carregando…</p>
          ) : commissions.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Nenhuma comissão registrada"
              description="Quando seus atendimentos gerarem comissão, eles aparecerão aqui."
            />
          ) : (
            <div className="w-full overflow-x-auto">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>Data</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(commissions as any[]).map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/40">
                      <TableCell className="text-muted-foreground">
                        {format(parseISO(c.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {c.patients?.full_name ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[260px]">
                        {c.description ?? c.notes ?? 'Comissão sobre atendimento'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            c.status === 'paid'
                              ? 'border-success/30 text-success'
                              : 'border-warning/30 text-warning'
                          }
                        >
                          {c.status === 'paid' ? 'Pago' : 'A receber'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {fmt(Number(c.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}