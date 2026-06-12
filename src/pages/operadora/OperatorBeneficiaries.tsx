import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import BeneficiaryFormDialog from '@/components/operadora/BeneficiaryFormDialog';
import BeneficiaryDetailDialog from '@/components/operadora/BeneficiaryDetailDialog';

export interface Beneficiary {
  id: string;
  full_name: string;
  cpf: string | null;
  card_number: string;
  plan_name: string | null;
  plan_type: string;
  status: string;
  due_day: number | null;
  next_due_date: string | null;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  enrolled_at: string | null;
  notes: string | null;
  dependents_count?: number;
}

const statusVariants: Record<string, { label: string; cls: string }> = {
  em_dia: { label: 'Em dia', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
  inadimplente: { label: 'Inadimplente', cls: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30' },
  suspenso: { label: 'Suspenso', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  cancelado: { label: 'Cancelado', cls: 'bg-muted text-muted-foreground border-border' },
};

function maskCpf(cpf: string | null) {
  if (!cpf) return '—';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
}

export default function OperatorBeneficiaries() {
  const { operatorId } = useAuth();
  const [rows, setRows] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Beneficiary | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  async function load() {
    if (!operatorId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('operator_beneficiaries')
      .select('*, dependents:operator_beneficiary_dependents(id)')
      .eq('operator_id', operatorId)
      .order('full_name');
    if (error) {
      toast.error('Erro ao carregar beneficiários');
      setLoading(false);
      return;
    }
    const list = (data ?? []).map((r: any) => ({ ...r, dependents_count: r.dependents?.length ?? 0 }));
    setRows(list);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatorId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (planFilter !== 'all' && r.plan_type !== planFilter) return false;
      if (!q) return true;
      return (
        r.full_name.toLowerCase().includes(q) ||
        (r.cpf ?? '').replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
        r.card_number.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter, planFilter]);

  const totals = useMemo(() => {
    const total = rows.length;
    const emDia = rows.filter((r) => r.status === 'em_dia').length;
    const inad = rows.filter((r) => r.status === 'inadimplente').length;
    const susp = rows.filter((r) => r.status === 'suspenso').length;
    return { total, emDia, inad, susp };
  }, [rows]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(b: Beneficiary) {
    setEditing(b);
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Beneficiários</h1>
          <p className="text-sm text-muted-foreground">Clientes da operadora, planos e gastos na rede credenciada</p>
        </div>
        <Button onClick={openCreate} className="rounded-xl">
          <Plus className="h-4 w-4 mr-2" /> Novo beneficiário
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: totals.total, cls: 'text-foreground' },
          { label: 'Em dia', value: totals.emDia, cls: 'text-emerald-600' },
          { label: 'Inadimplentes', value: totals.inad, cls: 'text-red-600' },
          { label: 'Suspensos', value: totals.susp, cls: 'text-amber-600' },
        ].map((k) => (
          <Card key={k.label} className="rounded-xl p-4">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className={`text-2xl font-semibold mt-1 ${k.cls}`}>{loading ? '—' : k.value}</div>
          </Card>
        ))}
      </div>

      <Card className="rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF ou carteirinha"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[170px] rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="em_dia">Em dia</SelectItem>
              <SelectItem value="inadimplente">Inadimplente</SelectItem>
              <SelectItem value="suspenso">Suspenso</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-[170px] rounded-xl"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="familiar">Familiar</SelectItem>
              <SelectItem value="empresarial">Empresarial</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Carteirinha</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-center">Deps</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10">
                    <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum beneficiário encontrado.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((b) => {
                  const sv = statusVariants[b.status] ?? statusVariants.cancelado;
                  return (
                    <TableRow key={b.id} className="cursor-pointer" onClick={() => setDetailId(b.id)}>
                      <TableCell className="font-medium">{b.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{maskCpf(b.cpf)}</TableCell>
                      <TableCell className="font-mono text-xs">{b.card_number}</TableCell>
                      <TableCell>{b.plan_name ?? '—'}</TableCell>
                      <TableCell className="capitalize">{b.plan_type}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${sv.cls} rounded-full`}>{sv.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {b.next_due_date ? new Date(b.next_due_date + 'T00:00:00').toLocaleDateString('pt-BR') : (b.due_day ? `Dia ${b.due_day}` : '—')}
                      </TableCell>
                      <TableCell className="text-center">
                        {b.dependents_count ? <Badge variant="secondary" className="rounded-full">{b.dependents_count}</Badge> : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <BeneficiaryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        operatorId={operatorId}
        beneficiary={editing}
        onSaved={() => { setFormOpen(false); load(); }}
      />

      <BeneficiaryDetailDialog
        beneficiaryId={detailId}
        onOpenChange={(o) => { if (!o) setDetailId(null); }}
        onEdit={(b) => { setDetailId(null); openEdit(b); }}
        onDeleted={() => { setDetailId(null); load(); }}
      />
    </div>
  );
}