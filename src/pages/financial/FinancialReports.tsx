import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Download, FileBarChart } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFinanceVisibility } from '@/hooks/useFinanceVisibility';
import { useFinancialSummary, MonthlySummary } from '@/hooks/useFinancialSummary';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/EmptyState';

type Preset = 'current' | 'last' | 'last3' | 'last6' | 'custom';

const fmt = (v: number) =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

function monthLabel(m: string) {
  // m: 'YYYY-MM' → 'MMM/YYYY'
  if (!m || !/^\d{4}-\d{2}$/.test(m)) return m;
  const [y, mo] = m.split('-');
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${names[Number(mo) - 1]}/${y}`;
}

const ROWS: Array<{ key: keyof MonthlySummary; label: string; sign: '+' | '–' | '='; muted?: boolean }> = [
  { key: 'revenue_particular', label: '(+) Faturamento particular', sign: '+' },
  { key: 'revenue_insurance_received', label: '(+) Faturamento convênio (recebido)', sign: '+' },
  { key: 'revenue_insurance_invoiced', label: '(+) Faturamento convênio (faturado, não recebido)', sign: '+', muted: true },
  { key: 'card_fees', label: '(–) Taxas de cartão', sign: '–' },
  { key: 'glosas_accepted', label: '(–) Glosas aceitas', sign: '–' },
  { key: 'commissions_paid', label: '(–) Repasses pagos', sign: '–' },
  { key: 'operational_expenses', label: '(–) Despesas operacionais', sign: '–' },
  { key: 'net_result', label: '(=) Resultado líquido', sign: '=' },
];

export default function FinancialReports() {
  const { user, currentClinicId } = useAuth();
  const visibility = useFinanceVisibility();

  const [preset, setPreset] = useState<Preset>('current');
  const now = new Date();
  const [customStart, setCustomStart] = useState(format(startOfMonth(now), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(endOfMonth(now), 'yyyy-MM-dd'));
  const [dentistFilter, setDentistFilter] = useState<string>('all');

  const range = useMemo(() => {
    if (preset === 'current') return { start: startOfMonth(now), end: endOfMonth(now) };
    if (preset === 'last') return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
    if (preset === 'last3') return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
    if (preset === 'last6') return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) };
    return { start: new Date(customStart), end: new Date(customEnd) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customStart, customEnd]);

  const startStr = format(range.start, 'yyyy-MM-dd');
  const endStr = format(range.end, 'yyyy-MM-dd');

  const isAdminLike = visibility.mode === 'clinic' || visibility.mode === 'staff';

  const { data: dentists = [] } = useQuery({
    queryKey: ['clinic-dentists-for-reports', currentClinicId],
    enabled: !!currentClinicId && isAdminLike,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_members')
        .select('user_id, profiles!clinic_members_user_id_fkey(full_name)')
        .eq('clinic_id', currentClinicId!)
        .in('role', ['admin', 'dentist']);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.user_id,
        name: r.profiles?.full_name ?? 'Profissional',
      }));
    },
  });

  const effectiveDentistId = !isAdminLike
    ? user?.id ?? null
    : dentistFilter === 'all'
      ? null
      : dentistFilter;

  const { data: summary, isLoading } = useFinancialSummary({
    clinicId: currentClinicId,
    startDate: startStr,
    endDate: endStr,
    dentistId: effectiveDentistId,
  });

  if (visibility.mode === 'denied' || visibility.mode === 'professional') {
    return <Navigate to="/meu-financeiro" replace />;
  }
  if (!currentClinicId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Relatórios financeiros" description="Disponível dentro de uma clínica." />
        <EmptyState
          icon={FileBarChart}
          title="Selecione uma clínica"
          description="O DRE gerencial agrega dados por clínica. Troque o contexto para acessá-lo."
        />
      </div>
    );
  }

  const months = summary?.monthly ?? [];
  const totals = summary?.totals;

  const exportCsv = () => {
    if (!summary) return;
    const header = ['Rubrica', ...months.map((m) => monthLabel(m.month)), 'Total'];
    const lines: string[] = [header.join(';')];
    ROWS.forEach((row) => {
      const cells = [
        row.label,
        ...months.map((m) => Number(m[row.key] ?? 0).toFixed(2).replace('.', ',')),
        Number((totals as any)?.[row.key] ?? 0).toFixed(2).replace('.', ','),
      ];
      lines.push(cells.join(';'));
    });
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dre_${startStr}_a_${endStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios financeiros"
        description="DRE gerencial mês a mês, com receitas, deduções e resultado líquido."
      >
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={exportCsv}
          disabled={!summary || months.length === 0}
        >
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </PageHeader>

      <Card className="border-border/50">
        <CardContent className="p-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Período</Label>
            <Select value={preset} onValueChange={(v: any) => setPreset(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Mês atual</SelectItem>
                <SelectItem value="last">Mês anterior</SelectItem>
                <SelectItem value="last3">Últimos 3 meses</SelectItem>
                <SelectItem value="last6">Últimos 6 meses</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {preset === 'custom' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">De</Label>
                <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Até</Label>
                <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
              </div>
            </>
          )}
          {isAdminLike && (
            <div className="space-y-1.5">
              <Label className="text-xs">Profissional</Label>
              <Select value={dentistFilter} onValueChange={setDentistFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {dentists.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            DRE gerencial · {format(range.start, 'dd/MM/yyyy')} – {format(range.end, 'dd/MM/yyyy')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Carregando…</p>
          ) : months.length === 0 ? (
            <EmptyState
              icon={FileBarChart}
              title="Sem dados no período"
              description="Ajuste o período ou registre receitas e despesas para visualizar o DRE."
            />
          ) : (
            <div className="w-full overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-semibold">Rubrica</TableHead>
                    {months.map((m) => (
                      <TableHead key={m.month} className="text-right font-semibold">
                        {monthLabel(m.month)}
                      </TableHead>
                    ))}
                    <TableHead className="text-right font-semibold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ROWS.map((row) => {
                    const isNet = row.key === 'net_result';
                    return (
                      <TableRow
                        key={row.key as string}
                        className={isNet ? 'bg-muted/40 hover:bg-muted/40' : undefined}
                      >
                        <TableCell className={isNet ? 'font-semibold' : row.muted ? 'text-muted-foreground' : ''}>
                          {row.label}
                        </TableCell>
                        {months.map((m) => {
                          const v = Number(m[row.key] ?? 0);
                          const cls = isNet
                            ? v >= 0 ? 'text-success font-semibold' : 'text-destructive font-semibold'
                            : row.muted ? 'text-muted-foreground' : '';
                          return (
                            <TableCell key={m.month} className={`text-right ${cls}`}>
                              {fmt(v)}
                            </TableCell>
                          );
                        })}
                        <TableCell
                          className={`text-right ${
                            isNet
                              ? (Number((totals as any)?.[row.key] ?? 0) >= 0 ? 'text-success font-bold' : 'text-destructive font-bold')
                              : row.muted ? 'text-muted-foreground' : 'font-medium'
                          }`}
                        >
                          {fmt(Number((totals as any)?.[row.key] ?? 0))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {totals && (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="border-border/60">
                    Comissões pendentes no período: {fmt(totals.commissions_pending)}
                  </Badge>
                  <Badge variant="outline" className="border-border/60">
                    Despesas a pagar: {fmt(totals.operational_pending)}
                  </Badge>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}