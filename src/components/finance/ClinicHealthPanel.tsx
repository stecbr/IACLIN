import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'Pix',
  credit_card: 'Cartão Crédito',
  debit_card: 'Cartão Débito',
  cash: 'Dinheiro',
  bank_transfer: 'Transferência',
  ted: 'TED',
  credit: 'Crédito',
  debit: 'Débito',
  boleto: 'Boleto',
  check: 'Cheque',
};

interface Props {
  clinicId: string;
  transactions: any[];
  period: { start: Date; end: Date };
}

export function ClinicHealthPanel({ clinicId, transactions, period }: Props) {
  const fmt = (v: number) =>
    `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const pct = (v: number, total: number) =>
    total === 0 ? '0%' : `${Math.round((v / total) * 100)}%`;

  const paidIncome = transactions.filter(
    (t) => t.type === 'income' && t.status === 'paid'
  );
  const totalIncome = paidIncome.reduce((s, t) => s + Number(t.amount), 0);

  // Revenue per professional
  const revenueByPro = useMemo(() => {
    const map: Record<string, { dentistId: string; total: number }> = {};
    paidIncome.forEach((t) => {
      if (!t.dentist_id) return;
      if (!map[t.dentist_id])
        map[t.dentist_id] = { dentistId: t.dentist_id, total: 0 };
      map[t.dentist_id].total += Number(t.amount);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [paidIncome]);

  const dentistIds = useMemo(
    () => revenueByPro.map((r) => r.dentistId),
    [revenueByPro]
  );

  const { data: profilesData = [] } = useQuery({
    queryKey: ['profiles-health-panel', ...dentistIds],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', dentistIds);
      return data ?? [];
    },
    enabled: dentistIds.length > 0,
  });

  const profileMap = useMemo(() => {
    const m: Record<string, string> = {};
    profilesData.forEach((p: any) => {
      m[p.id] = p.full_name;
    });
    return m;
  }, [profilesData]);

  // Payment methods breakdown
  const paymentData = useMemo(() => {
    const map: Record<string, number> = {};
    paidIncome.forEach((t) => {
      const k = t.payment_method ?? 'other';
      map[k] = (map[k] ?? 0) + Number(t.amount);
    });
    return Object.entries(map)
      .map(([key, total]) => ({
        key,
        label: PAYMENT_METHOD_LABELS[key] ?? key,
        total,
      }))
      .sort((a, b) => b.total - a.total);
  }, [paidIncome]);

  // Top treatments from completed appointments
  const { data: appointments = [] } = useQuery({
    queryKey: [
      'clinic-top-treatments',
      clinicId,
      format(period.start, 'yyyy-MM-dd'),
      format(period.end, 'yyyy-MM-dd'),
    ],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('procedure_id, procedures(name, default_price)')
        .eq('clinic_id', clinicId)
        .in('status', ['completed', 'finished', 'done'])
        .gte('start_time', period.start.toISOString())
        .lte('start_time', period.end.toISOString());
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const topTreatments = useMemo(() => {
    const map: Record<string, { name: string; count: number; revenue: number }> = {};
    appointments.forEach((a: any) => {
      const name = a.procedures?.name ?? 'Sem procedimento';
      if (!map[name]) map[name] = { name, count: 0, revenue: 0 };
      map[name].count += 1;
      map[name].revenue += Number(a.procedures?.default_price ?? 0);
    });
    return Object.values(map)
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  }, [appointments]);

  const totalTreatments = topTreatments.reduce((s, t) => s + t.count, 0);

  const periodLabel = `${format(period.start, "d 'de' MMMM", { locale: ptBR })} – ${format(period.end, "d 'de' MMMM", { locale: ptBR })}`;

  const SectionRow = ({
    label,
    percentage,
    amount,
    rank,
  }: {
    label: string;
    percentage: string;
    amount: string;
    rank?: number;
  }) => (
    <div className="flex items-center gap-3 py-1.5 text-sm border-b border-border/30 last:border-0">
      <span className="flex-1 text-primary truncate">
        {rank != null ? `${rank}. ` : ''}
        {label}
      </span>
      <span className="text-muted-foreground w-10 text-right text-xs">{percentage}</span>
      <span className="font-medium w-32 text-right">{amount}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          * Apenas transações com status "Pago" são contabilizadas
        </p>
        <Badge variant="outline" className="text-xs">
          {periodLabel}
        </Badge>
      </div>

      <Card className="border-border/50 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Distribuição do faturamento por profissional
          </CardTitle>
        </CardHeader>
        <CardContent>
          {revenueByPro.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Nenhuma receita registrada no período
            </p>
          ) : (
            <div>
              <div className="flex items-center gap-3 pb-1 text-xs text-muted-foreground font-medium border-b border-border/50 mb-1">
                <span className="flex-1">Profissional</span>
                <span className="w-10 text-right">%</span>
                <span className="w-32 text-right">Valor</span>
              </div>
              {revenueByPro.map((row) => (
                <SectionRow
                  key={row.dentistId}
                  label={profileMap[row.dentistId] ?? 'Profissional'}
                  percentage={pct(row.total, totalIncome)}
                  amount={fmt(row.total)}
                />
              ))}
              <div className="flex items-center gap-3 pt-2 text-sm font-semibold">
                <span className="flex-1">Total</span>
                <span className="w-10 text-right text-xs">100%</span>
                <span className="w-32 text-right">{fmt(totalIncome)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Formas de pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          {paymentData.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Nenhum pagamento no período
            </p>
          ) : (
            <div>
              <div className="flex items-center gap-3 pb-1 text-xs text-muted-foreground font-medium border-b border-border/50 mb-1">
                <span className="flex-1">Forma</span>
                <span className="w-10 text-right">%</span>
                <span className="w-32 text-right">Valor</span>
              </div>
              {paymentData.map((row) => (
                <SectionRow
                  key={row.key}
                  label={row.label}
                  percentage={pct(row.total, totalIncome)}
                  amount={fmt(row.total)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Tratamentos mais realizados no período
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topTreatments.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Nenhum tratamento finalizado no período
            </p>
          ) : (
            <div>
              <div className="flex items-center gap-3 pb-1 text-xs text-muted-foreground font-medium border-b border-border/50 mb-1">
                <span className="flex-1">Tratamento</span>
                <span className="w-10 text-right">%</span>
                <span className="w-32 text-right">Receita</span>
              </div>
              {topTreatments.map((row, idx) => (
                <SectionRow
                  key={row.name}
                  rank={idx + 1}
                  label={row.name}
                  percentage={pct(row.count, totalTreatments)}
                  amount={fmt(row.revenue)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
