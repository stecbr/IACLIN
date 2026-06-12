import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { ArrowLeft, Send, CheckCircle2, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Tx {
  id: string;
  amount: number;
  description: string | null;
  notes: string | null;
  due_date: string;
  operator_id: string;
  insurance_invoice_period: string;
  insurance_invoice_status: string | null;
  status: string;
  created_at: string;
  patients: { full_name: string } | null;
  insurance_operators: { name: string } | null;
}

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPeriod(p: string) {
  const [y, m] = p.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export default function InsuranceInvoices() {
  const { user, currentClinicId } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ['insurance-invoices', currentClinicId, user?.id],
    queryFn: async () => {
      let q = supabase
        .from('financial_transactions')
        .select('id, amount, description, notes, due_date, operator_id, insurance_invoice_period, insurance_invoice_status, status, created_at, patients(full_name), insurance_operators(name)')
        .not('operator_id', 'is', null)
        .order('insurance_invoice_period', { ascending: false });
      if (currentClinicId) q = q.eq('clinic_id', currentClinicId);
      else if (user) q = q.eq('dentist_id', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Tx[];
    },
    enabled: !!user,
  });

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; operator_id: string; operator_name: string; period: string; status: string; total: number; count: number; items: Tx[] }>();
    for (const t of txs) {
      if (!t.operator_id || !t.insurance_invoice_period) continue;
      const key = `${t.operator_id}__${t.insurance_invoice_period}`;
      const g = map.get(key) ?? {
        key,
        operator_id: t.operator_id,
        operator_name: t.insurance_operators?.name ?? '—',
        period: t.insurance_invoice_period,
        status: t.insurance_invoice_status ?? 'open',
        total: 0, count: 0, items: [],
      };
      g.total += Number(t.amount) || 0;
      g.count += 1;
      g.items.push(t);
      // status do grupo: prioridade open > sent > paid
      const order: Record<string, number> = { open: 0, sent: 1, paid: 2 };
      if ((order[t.insurance_invoice_status ?? 'open'] ?? 0) < (order[g.status] ?? 0)) {
        g.status = t.insurance_invoice_status ?? 'open';
      }
      map.set(key, g);
    }
    return Array.from(map.values()).sort((a, b) => b.period.localeCompare(a.period));
  }, [txs]);

  const toggle = (k: string) => {
    setExpanded((s) => {
      const ns = new Set(s);
      if (ns.has(k)) ns.delete(k); else ns.add(k);
      return ns;
    });
  };

  const updateGroup = async (g: typeof groups[number], newStatus: 'sent' | 'paid') => {
    const ids = g.items.map((i) => i.id);
    const patch: any = { insurance_invoice_status: newStatus };
    if (newStatus === 'paid') {
      patch.status = 'paid';
      patch.paid_date = new Date().toISOString().slice(0, 10);
    }
    const { error } = await supabase.from('financial_transactions').update(patch).in('id', ids);
    if (error) { toast.error(error.message); return; }
    toast.success(newStatus === 'sent' ? 'Fatura marcada como enviada' : 'Fatura marcada como paga');
    qc.invalidateQueries({ queryKey: ['insurance-invoices'] });
    qc.invalidateQueries({ queryKey: ['financial-transactions'] });
  };

  return (
    <div className="container max-w-5xl py-6 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild><Link to="/financial"><ArrowLeft className="h-4 w-4 mr-1" /> Financeiro</Link></Button>
      </div>
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <FileText className="h-6 w-6" /> Faturas de Convênio
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Consultas agrupadas por operadora e mês. Envie no dia 20 de cada mês.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isLoading && groups.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Nenhuma fatura de convênio. Finalize consultas usando a opção "Convênio" para começar.
        </CardContent></Card>
      )}

      {groups.map((g) => {
        const isOpen = expanded.has(g.key);
        const statusBadge =
          g.status === 'paid' ? <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">Paga</Badge>
          : g.status === 'sent' ? <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20">Enviada</Badge>
          : <Badge variant="outline">Aberta</Badge>;
        return (
          <Card key={g.key}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <button onClick={() => toggle(g.key)} className="flex items-center gap-2 text-left">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <div>
                    <CardTitle className="text-base">{g.operator_name}</CardTitle>
                    <p className="text-xs text-muted-foreground capitalize">{fmtPeriod(g.period)} • {g.count} consulta(s)</p>
                  </div>
                </button>
                <div className="flex items-center gap-3">
                  {statusBadge}
                  <span className="font-mono font-semibold">{brl(g.total)}</span>
                </div>
              </div>
            </CardHeader>
            {isOpen && (
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-border divide-y divide-border">
                  {g.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{it.patients?.full_name ?? '—'}</p>
                        <p className="text-xs text-muted-foreground truncate">{it.notes ?? it.description}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(it.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <span className="font-mono">{brl(Number(it.amount))}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2 flex-wrap">
                  {g.status === 'open' && (
                    <Button variant="outline" size="sm" onClick={() => updateGroup(g, 'sent')} className="gap-2">
                      <Send className="h-4 w-4" /> Marcar como enviada
                    </Button>
                  )}
                  {g.status !== 'paid' && (
                    <Button size="sm" onClick={() => updateGroup(g, 'paid')} className="gap-2">
                      <CheckCircle2 className="h-4 w-4" /> Marcar como paga
                    </Button>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}