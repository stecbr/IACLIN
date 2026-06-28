import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInsuranceGlosas, useUpdateGlosaStatus, type Glosa } from '@/hooks/useInsuranceInvoices';
import { toast } from 'sonner';

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const statusLabel: Record<Glosa['status'], string> = {
  identified: 'Identificada',
  accepted: 'Aceita',
  contested: 'Contestada',
  recovered: 'Recuperada',
};

const statusClass: Record<Glosa['status'], string> = {
  identified: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20',
  accepted: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20',
  contested: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20',
  recovered: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
};

export function GlosasPanel({ clinicId }: { clinicId: string }) {
  const { data = [], isLoading } = useInsuranceGlosas(clinicId);
  const update = useUpdateGlosaStatus();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = useMemo(() => {
    return data.filter((g) => {
      if (statusFilter !== 'all' && g.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (g.insurance_operators?.name ?? '').toLowerCase().includes(s)
          || (g.reason ?? '').toLowerCase().includes(s)
          || g.insurance_invoice_period.includes(s);
      }
      return true;
    });
  }, [data, search, statusFilter]);

  const totalLoss = filtered
    .filter((g) => g.status === 'accepted')
    .reduce((s, g) => s + Number(g.glosa_amount), 0);
  const totalRecovered = filtered
    .filter((g) => g.status === 'recovered')
    .reduce((s, g) => s + Number(g.glosa_amount), 0);

  const handleStatus = async (id: string, status: Glosa['status']) => {
    try {
      await update.mutateAsync({ id, status });
      toast.success('Status atualizado');
    } catch (e: any) { toast.error(e?.message); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Total de glosas</p>
          <p className="font-semibold text-lg">{data.length}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Perdas aceitas</p>
          <p className="font-semibold text-lg text-red-600">{brl(totalLoss)}</p>
        </div>
        <div className="rounded-lg border p-3 col-span-2 sm:col-span-1">
          <p className="text-xs text-muted-foreground">Recuperado</p>
          <p className="font-semibold text-lg text-emerald-600">{brl(totalRecovered)}</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Buscar operadora, motivo ou período..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="identified">Identificadas</SelectItem>
            <SelectItem value="contested">Contestadas</SelectItem>
            <SelectItem value="accepted">Aceitas</SelectItem>
            <SelectItem value="recovered">Recuperadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isLoading && filtered.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
          Nenhuma glosa registrada.
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {filtered.map((g) => (
          <Card key={g.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{g.insurance_operators?.name ?? '—'}</p>
                    <Badge variant="outline" className="text-xs">{g.insurance_invoice_period}</Badge>
                    <Badge className={`text-xs ${statusClass[g.status]}`}>{statusLabel[g.status]}</Badge>
                  </div>
                  {g.reason && <p className="text-xs text-muted-foreground mt-1">{g.reason}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Esperado {brl(Number(g.expected_amount))} · Recebido {brl(Number(g.received_amount))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-semibold text-red-600">−{brl(Number(g.glosa_amount))}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-3 flex-wrap">
                {g.status !== 'contested' && g.status !== 'recovered' && (
                  <Button size="sm" variant="outline" onClick={() => handleStatus(g.id, 'contested')}>Contestar</Button>
                )}
                {g.status === 'contested' && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => handleStatus(g.id, 'recovered')}>Marcar como recuperada</Button>
                    <Button size="sm" variant="outline" onClick={() => handleStatus(g.id, 'accepted')}>Aceitar perda</Button>
                  </>
                )}
                {g.status === 'identified' && (
                  <Button size="sm" variant="outline" onClick={() => handleStatus(g.id, 'accepted')}>Aceitar perda</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
