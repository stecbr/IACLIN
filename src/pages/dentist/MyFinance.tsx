import { useEffect, useMemo, useRef } from 'react';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useMyPayouts } from '@/hooks/usePayouts';
import { PayoutsHelpSheet } from '@/components/finance/PayoutsHelpSheet';
import { Info } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function MyFinance() {
  const { user, currentClinicId } = useAuth();
  const { data: payouts = [] } = useMyPayouts(currentClinicId, user?.id ?? null);
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const { data: clinicName = '' } = useQuery({
    queryKey: ['clinic-name', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const { data } = await supabase
        .from('clinics')
        .select('name')
        .eq('id', currentClinicId!)
        .maybeSingle();
      return data?.name ?? '';
    },
  });

  // Commissions assigned to me (this clinic).
  const { data: commissions = [], isLoading } = useQuery({
    queryKey: ['my-commissions', user?.id, currentClinicId],
    enabled: !!user && !!currentClinicId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select(
          'id, amount, status, due_date, paid_date, appointment_id, notes, description, created_at'
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

  // Aviso ao sair da página: verificar depósito bancário
  const payoutsRef = useRef(payouts);
  useEffect(() => { payoutsRef.current = payouts; }, [payouts]);
  useEffect(() => {
    return () => {
      if (payoutsRef.current.length > 0) {
        toast.info('Lembre-se de verificar se o valor depositado pela clínica chegou na sua conta bancária.', {
          duration: 8000,
        });
      }
    };
  }, []);

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

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Info className="h-4 w-4" />
        </div>
        <div className="flex-1 text-sm text-foreground/90 leading-relaxed">
          <p className="font-medium text-foreground">Como você recebe suas comissões</p>
          <p className="mt-1 text-muted-foreground">
            A cada atendimento finalizado, o sistema calcula sua comissão e soma em{' '}
            <strong>A receber</strong>. A clínica paga você por fora (Pix, transferência,
            dinheiro) e, ao registrar o pagamento, ele aparece em{' '}
            <strong>Fechamentos recebidos</strong>.
          </p>
        </div>
        <PayoutsHelpSheet audience="professional" />
      </div>

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
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="extract">
            <TabsList>
              <TabsTrigger value="extract">A receber</TabsTrigger>
              <TabsTrigger value="payouts">
                Fechamentos recebidos
                {payouts.length > 0 && (
                  <Badge variant="outline" className="ml-2 text-[10px] h-5 px-1.5">{payouts.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="extract" className="pt-4">
              <p className="text-xs text-muted-foreground mb-3">
                Comissões geradas pelos seus atendimentos. Aguardam o fechamento e
                pagamento pela clínica.
              </p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Carregando…</p>
          ) : commissions.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Nenhuma comissão ainda"
              description="Assim que você finalizar um atendimento com pagamento registrado, sua comissão aparece aqui."
            />
          ) : (
            <div className="w-full overflow-x-auto">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>Data</TableHead>
                    <TableHead>Clínica</TableHead>
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
                        {clinicName || '—'}
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
            </TabsContent>

            <TabsContent value="payouts" className="pt-4">
              <p className="text-xs text-muted-foreground mb-3">
                Pagamentos já confirmados pela clínica. Cada linha representa um
                fechamento de período (semanal, quinzenal ou mensal).
              </p>
              {payouts.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="Nenhum fechamento ainda"
                  description="Quando a administração fechar e pagar um período de comissões, o lançamento aparecerá aqui para sua conferência."
                />
              ) : (
                <div className="w-full overflow-x-auto">
                  <Table className="min-w-[560px]">
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead>Pago em</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Observações</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(payouts as any[]).map((p) => (
                        <TableRow key={p.id} className="hover:bg-muted/40">
                          <TableCell className="text-muted-foreground">
                            {p.paid_at ? format(parseISO(p.paid_at), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                          </TableCell>
                          <TableCell>
                            {format(parseISO(p.period_start), 'dd/MM/yy', { locale: ptBR })} – {format(parseISO(p.period_end), 'dd/MM/yy', { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {p.payment_method === 'pix' ? 'PIX'
                                : p.payment_method === 'transfer' ? 'Transferência'
                                : p.payment_method === 'cash' ? 'Dinheiro'
                                : (p.payment_method ?? '—')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground italic truncate max-w-[260px]">
                            {p.notes ?? '—'}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {fmt(Number(p.total_amount))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}