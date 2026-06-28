import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { ArrowLeft, Send, FileText, ChevronDown, ChevronRight, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useInsuranceInvoiceGroups,
  useMarkInvoiced,
  type InvoiceGroup,
} from '@/hooks/useInsuranceInvoices';
import { ReconcileInvoiceDialog } from '@/components/finance/ReconcileInvoiceDialog';
import { GlosasPanel } from '@/components/finance/GlosasPanel';

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPeriod(p: string) {
  const [y, m] = p.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function StatusBadge({ status }: { status: InvoiceGroup['status'] }) {
  if (status === 'reconciled') return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">Conciliada</Badge>;
  if (status === 'paid') return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">Paga</Badge>;
  if (status === 'invoiced') return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20">Faturada</Badge>;
  return <Badge variant="outline">Aberta</Badge>;
}

function GroupCard({
  g,
  onMarkInvoiced,
  onReconcile,
}: {
  g: InvoiceGroup;
  onMarkInvoiced?: (g: InvoiceGroup) => void;
  onReconcile?: (g: InvoiceGroup) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button onClick={() => setIsOpen((v) => !v)} className="flex items-center gap-2 text-left">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <div>
              <CardTitle className="text-base">{g.operator_name}</CardTitle>
              <p className="text-xs text-muted-foreground capitalize">{fmtPeriod(g.period)} • {g.count} consulta(s)</p>
            </div>
          </button>
          <div className="flex items-center gap-3">
            <StatusBadge status={g.status} />
            <span className="font-mono font-semibold">{brl(g.total)}</span>
          </div>
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="space-y-3">
          <div className="rounded-xl border divide-y">
            {g.items.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{it.patients?.full_name ?? '—'}</p>
                  <p className="text-xs text-muted-foreground truncate">{it.notes ?? it.description}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(it.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <span className="font-mono">{brl(Number(it.amount))}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 flex-wrap">
            {onMarkInvoiced && (
              <Button variant="outline" size="sm" onClick={() => onMarkInvoiced(g)} className="gap-2">
                <Send className="h-4 w-4" /> Marcar como faturada
              </Button>
            )}
            {onReconcile && (
              <Button size="sm" onClick={() => onReconcile(g)} className="gap-2">
                <Wallet className="h-4 w-4" /> Conciliar pagamento
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function InsuranceInvoices() {
  const { user, currentClinicId } = useAuth();
  const { data: groups = [], isLoading } = useInsuranceInvoiceGroups(currentClinicId ?? null, user?.id ?? null);
  const markInvoiced = useMarkInvoiced();
  const [reconcileGroup, setReconcileGroup] = useState<InvoiceGroup | null>(null);

  const buckets = useMemo(() => ({
    open: groups.filter((g) => g.status === 'open'),
    invoiced: groups.filter((g) => g.status === 'invoiced'),
    received: groups.filter((g) => g.status === 'paid' || g.status === 'reconciled'),
  }), [groups]);

  const handleMarkInvoiced = async (g: InvoiceGroup) => {
    try {
      await markInvoiced.mutateAsync({ ids: g.items.map((i) => i.id) });
      toast.success('Lote marcado como faturado');
    } catch (e: any) { toast.error(e?.message); }
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
          Acompanhe lotes por operadora e mês, envie faturas e concilie pagamentos com glosas.
        </p>
      </div>

      <Tabs defaultValue="open" className="space-y-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="open">Abertos ({buckets.open.length})</TabsTrigger>
          <TabsTrigger value="invoiced">Faturados ({buckets.invoiced.length})</TabsTrigger>
          <TabsTrigger value="received">Recebidos ({buckets.received.length})</TabsTrigger>
          <TabsTrigger value="glosas">Glosas</TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!isLoading && buckets.open.length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
              Nenhum lote em aberto. Finalize consultas com "Convênio" para começar.
            </CardContent></Card>
          )}
          {buckets.open.map((g) => (
            <GroupCard key={g.key} g={g} onMarkInvoiced={handleMarkInvoiced} />
          ))}
        </TabsContent>

        <TabsContent value="invoiced" className="space-y-3">
          {buckets.invoiced.length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
              Nenhum lote faturado aguardando conciliação.
            </CardContent></Card>
          )}
          {buckets.invoiced.map((g) => (
            <GroupCard key={g.key} g={g} onReconcile={setReconcileGroup} />
          ))}
        </TabsContent>

        <TabsContent value="received" className="space-y-3">
          {buckets.received.length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
              Nenhum lote recebido ainda.
            </CardContent></Card>
          )}
          {buckets.received.map((g) => (
            <GroupCard key={g.key} g={g} />
          ))}
        </TabsContent>

        <TabsContent value="glosas">
          {currentClinicId
            ? <GlosasPanel clinicId={currentClinicId} />
            : <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">Selecione uma clínica para ver glosas.</CardContent></Card>}
        </TabsContent>
      </Tabs>

      {currentClinicId && (
        <ReconcileInvoiceDialog
          open={!!reconcileGroup}
          onOpenChange={(v) => !v && setReconcileGroup(null)}
          group={reconcileGroup}
          clinicId={currentClinicId}
        />
      )}
    </div>
  );
}