import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, Clock, CheckCircle2, Building2, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type Period = '1' | '3' | '6' | '12';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  paid:    { label: 'Pago',     variant: 'default' },
  pending: { label: 'Pendente', variant: 'secondary' },
  overdue: { label: 'Vencido',  variant: 'destructive' },
};

const METHOD_MAP: Record<string, string> = {
  cash: 'Dinheiro', pix: 'PIX', credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito', bank_transfer: 'Transferência',
  insurance: 'Convênio', later: 'A combinar',
};

export default function DentistFinancialSection() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('3');
  const [expandedClinic, setExpandedClinic] = useState<string | null>(null);

  const { from, to } = useMemo(() => {
    const now = new Date();
    return {
      from: startOfMonth(subMonths(now, Number(period) - 1)).toISOString(),
      to: endOfMonth(now).toISOString(),
    };
  }, [period]);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['dentist-financial', user?.id, from, to],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('id, amount, status, payment_method, due_date, paid_date, description, created_at, clinic_id, appointment_id, type, category')
        .eq('dentist_id', user!.id)
        .gte('due_date', from)
        .lte('due_date', to)
        .order('due_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch clinic names
  const clinicIds = useMemo(() => [...new Set(transactions.map((t) => t.clinic_id).filter(Boolean))] as string[], [transactions]);
  const { data: clinics = [] } = useQuery({
    queryKey: ['clinics-names', clinicIds],
    enabled: clinicIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('clinics').select('id, name').in('id', clinicIds);
      return data ?? [];
    },
  });
  const clinicMap = useMemo(() => new Map(clinics.map((c) => [c.id, c.name])), [clinics]);

  // Totals
  const totalReceived = transactions.filter((t) => t.status === 'paid').reduce((s, t) => s + Number(t.amount), 0);
  const totalPending  = transactions.filter((t) => t.status === 'pending').reduce((s, t) => s + Number(t.amount), 0);
  const totalOverdue  = transactions.filter((t) => t.status === 'overdue').reduce((s, t) => s + Number(t.amount), 0);

  // Group by clinic
  const byClinic = useMemo(() => {
    const map = new Map<string, typeof transactions>();
    for (const t of transactions) {
      const key = t.clinic_id ?? '__personal__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [transactions]);

  return (
    <div className="space-y-6">
      {/* Header + filtro */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">Meu Financeiro</h2>
          <p className="text-sm text-muted-foreground">Valores recebidos e pendentes por atendimentos nas clínicas</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Este mês</SelectItem>
            <SelectItem value="3">Últimos 3 meses</SelectItem>
            <SelectItem value="6">Últimos 6 meses</SelectItem>
            <SelectItem value="12">Último ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recebido</p>
              <p className="text-lg font-bold text-emerald-600">{brl(totalReceived)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pendente</p>
              <p className="text-lg font-bold text-amber-600">{brl(totalPending)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total bruto</p>
              <p className="text-lg font-bold">{brl(totalReceived + totalPending + totalOverdue)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista por clínica */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : byClinic.size === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <TrendingUp className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nenhum lançamento no período</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Os valores aparecem após finalizar atendimentos</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {Array.from(byClinic.entries()).map(([clinicId, txs]) => {
            const clinicName = clinicId === '__personal__' ? 'Pessoal' : (clinicMap.get(clinicId) ?? 'Clínica');
            const clinicTotal = txs.reduce((s, t) => s + Number(t.amount), 0);
            const clinicPaid  = txs.filter((t) => t.status === 'paid').reduce((s, t) => s + Number(t.amount), 0);
            const isOpen = expandedClinic === clinicId;

            return (
              <Card key={clinicId} className="overflow-hidden">
                <button
                  className="w-full flex items-center justify-between gap-3 p-4 hover:bg-muted/40 transition-colors text-left"
                  onClick={() => setExpandedClinic(isOpen ? null : clinicId)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{clinicName}</p>
                      <p className="text-xs text-muted-foreground">{txs.length} lançamento{txs.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold">{brl(clinicTotal)}</p>
                      <p className="text-xs text-emerald-600">{brl(clinicPaid)} recebido</p>
                    </div>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border divide-y divide-border">
                    {txs.map((t) => {
                      const st = STATUS_MAP[t.status] ?? { label: t.status, variant: 'outline' as const };
                      return (
                        <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {t.description || 'Atendimento'}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(parseISO(t.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                              </span>
                              {t.payment_method && (
                                <span className="text-xs text-muted-foreground">
                                  · {METHOD_MAP[t.payment_method] ?? t.payment_method}
                                </span>
                              )}
                              {t.paid_date && (
                                <span className="text-xs text-muted-foreground">
                                  · Pago em {format(parseISO(t.paid_date), 'dd/MM', { locale: ptBR })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant={st.variant} className="text-[11px]">{st.label}</Badge>
                            <span className="text-sm font-semibold w-24 text-right">{brl(Number(t.amount))}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
