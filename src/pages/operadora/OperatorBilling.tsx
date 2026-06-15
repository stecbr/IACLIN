import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function OperatorBilling() {
  const { operatorId } = useAuth();
  const period = format(new Date(), 'yyyy-MM');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['operator-billing', operatorId, period],
    enabled: !!operatorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select(
          'id, amount, status, insurance_invoice_status, insurance_invoice_period, created_at, due_date, notes, description, clinic_id, patient_id, patients(full_name), clinics(name)'
        )
        .eq('operator_id', operatorId!)
        .eq('insurance_invoice_period', period)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { toBill, billed, disputed } = useMemo(() => {
    let toBill = 0;
    let billed = 0;
    let disputed = 0;
    for (const r of rows) {
      const amt = Number(r.amount) || 0;
      const st = r.insurance_invoice_status ?? 'open';
      if (st === 'open') toBill += amt;
      else if (st === 'closed' || st === 'paid' || st === 'invoiced') billed += amt;
      else if (st === 'disputed' || st === 'glossed') disputed += 1;
    }
    return { toBill, billed, disputed };
  }, [rows]);

  const kpis = [
    { label: 'A faturar este mês', value: brl(toBill) },
    { label: 'Faturado no mês', value: brl(billed) },
    { label: 'Glosas em análise', value: String(disputed) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Faturamento</h1>
        <p className="text-sm text-muted-foreground">
          Visão consolidada dos atendimentos faturáveis e repasses à rede credenciada.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="rounded-xl p-5">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="text-2xl font-semibold mt-1">{k.value}</div>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <Card className="rounded-xl p-10 text-center text-sm text-muted-foreground">
          Carregando atendimentos...
        </Card>
      ) : rows.length === 0 ? (
        <Card className="rounded-xl p-10 flex flex-col items-center justify-center text-center gap-3">
          <Wallet className="h-10 w-10 text-muted-foreground" />
          <div className="text-sm font-medium">Nenhum atendimento faturável neste mês</div>
          <p className="text-xs text-muted-foreground max-w-md">
            Atendimentos finalizados pela rede credenciada como convênio aparecerão
            automaticamente aqui, agrupados pelo mês de competência.
          </p>
        </Card>
      ) : (
        <Card className="rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border text-sm font-medium">
            Atendimentos do mês ({format(new Date(), 'MMMM/yyyy', { locale: ptBR })})
          </div>
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">
                    {r.patients?.full_name ?? 'Paciente'}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.clinics?.name ?? 'Clínica'} ·{' '}
                    {format(parseISO(r.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </div>
                  {r.notes && (
                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {r.notes}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold">{brl(Number(r.amount))}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.insurance_invoice_status ?? 'open'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}