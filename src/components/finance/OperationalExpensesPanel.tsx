import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Plus, Receipt } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/EmptyState';
import { TransactionDialog } from '@/components/finance/TransactionDialog';

const CATEGORY_LABEL: Record<string, string> = {
  rent: 'Aluguel',
  supplies: 'Insumos',
  salary: 'Salário',
  utilities: 'Água / Luz',
  internet: 'Internet',
  marketing: 'Marketing',
  other: 'Outro',
};

interface Props {
  clinicId: string;
  periodStart: Date;
  periodEnd: Date;
  onChanged?: () => void;
}

const fmt = (v: number) =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export function OperationalExpensesPanel({ clinicId, periodStart, periodEnd, onChanged }: Props) {
  const [showNew, setShowNew] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: [
      'operational-expenses',
      clinicId,
      format(periodStart, 'yyyy-MM-dd'),
      format(periodEnd, 'yyyy-MM-dd'),
    ],
    enabled: !!clinicId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('financial_transactions')
        .select('id, due_date, paid_date, description, category, amount, status, notes')
        .eq('clinic_id', clinicId)
        .eq('is_operational', true)
        .gte('due_date', format(periodStart, 'yyyy-MM-dd'))
        .lte('due_date', format(periodEnd, 'yyyy-MM-dd'))
        .order('due_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(
    () => rows.filter((r: any) => statusFilter === 'all' || r.status === statusFilter),
    [rows, statusFilter],
  );

  const totalPaid = rows
    .filter((r: any) => r.status === 'paid')
    .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const totalPending = rows
    .filter((r: any) => r.status === 'pending')
    .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Despesas operacionais</h3>
          <p className="text-xs text-muted-foreground">
            Aluguel, insumos, salários e contas fixas. Comissões e glosas têm telas próprias.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="paid">Pagas</SelectItem>
              <SelectItem value="overdue">Vencidas</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="gap-1.5" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4" /> Nova despesa
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-3 border-border/50">
          <p className="text-xs text-muted-foreground">Pagas no período</p>
          <p className="text-lg font-semibold text-foreground">{fmt(totalPaid)}</p>
        </Card>
        <Card className="p-3 border-border/50">
          <p className="text-xs text-muted-foreground">A pagar</p>
          <p className="text-lg font-semibold text-warning">{fmt(totalPending)}</p>
        </Card>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Carregando…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Sem despesas operacionais no período"
          description="Lance aluguel, contas fixas, insumos e outras saídas operacionais."
          actionLabel="Nova despesa"
          onAction={() => setShowNew(true)}
        />
      ) : (
        <Card className="shadow-card border-border/50 overflow-hidden">
          <div className="w-full overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground">
                      {r.due_date ? format(parseISO(r.due_date), 'dd/MM/yyyy') : '—'}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {r.description ?? CATEGORY_LABEL[r.category] ?? r.category}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {CATEGORY_LABEL[r.category] ?? r.category}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          r.status === 'paid'
                            ? 'border-success/30 text-success'
                            : r.status === 'overdue'
                              ? 'border-destructive/30 text-destructive'
                              : 'border-warning/30 text-warning'
                        }
                      >
                        {r.status === 'paid' ? 'Paga' : r.status === 'overdue' ? 'Vencida' : 'Pendente'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-destructive">
                      -{fmt(Number(r.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <TransactionDialog
        open={showNew}
        onOpenChange={setShowNew}
        defaultType="expense"
        defaultCategory="rent"
        onSuccess={() => {
          refetch();
          onChanged?.();
        }}
      />
    </div>
  );
}