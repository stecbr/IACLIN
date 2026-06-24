import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, parseISO, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DollarSign, TrendingUp, TrendingDown, Clock, Plus, Upload, Filter, Pencil,
  CheckCircle2, XCircle, ArrowUpRight, ArrowDownRight, FileText, Sparkles,
  Building2, User as UserIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TransactionDialog } from '@/components/finance/TransactionDialog';
import { ClinicHealthPanel } from '@/components/finance/ClinicHealthPanel';
import { CommissionsPanel } from '@/components/finance/CommissionsPanel';
import { generateCommissionsForTransaction } from '@/lib/commissions';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useSoloMode } from '@/hooks/useSoloMode';
import { canManageClinicFinance } from '@/lib/financePermissions';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';

export default function Financial() {
  const { user, currentClinicId, isPersonalMode, clinics, isClinicOwner } = useAuth();
  const queryClient = useQueryClient();
  const { effectiveRole } = useRoleAccess();
  const { isSolo } = useSoloMode();
  const canApprove = canManageClinicFinance({
    isSolo,
    role: effectiveRole as any,
    hasClinic: !!currentClinicId,
  });
  const [showNewTx, setShowNewTx] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('current');
  const [activeTab, setActiveTab] = useState('overview');

  // Period calculation
  const now = new Date();
  const getPeriodRange = () => {
    if (periodFilter === 'current') return { start: startOfMonth(now), end: endOfMonth(now) };
    if (periodFilter === 'last') return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
    if (periodFilter === 'last3') return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
    return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) };
  };
  const period = getPeriodRange();

  // Context: clinic vs personal
  const activeClinic = clinics.find((c) => c.clinic_id === currentClinicId) ?? null;
  const contextLabel = currentClinicId
    ? `Financeiro · ${activeClinic?.clinic_name ?? 'Clínica'}`
    : 'Financeiro Pessoal';
  const contextDescription = currentClinicId
    ? 'Movimentações desta clínica.'
    : 'Movimentações vinculadas apenas ao seu espaço pessoal.';

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['financial-transactions', period.start.toISOString(), period.end.toISOString(), currentClinicId, user?.id, isPersonalMode],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from('financial_transactions')
        .select('*, patients(full_name, insurance_provider)')
        .gte('due_date', format(period.start, 'yyyy-MM-dd'))
        .lte('due_date', format(period.end, 'yyyy-MM-dd'))
        .order('due_date', { ascending: false });
      if (currentClinicId) {
        query = query.eq('clinic_id', currentClinicId);
      } else if (user) {
        // Personal mode: isolate by dentist to avoid mixing other professionals' personal data
        query = query.is('clinic_id', null).eq('dentist_id', user.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Transactions awaiting approval (only relevant in clinic mode)
  const { data: awaitingApproval = [] } = useQuery({
    queryKey: ['financial-awaiting-approval', currentClinicId],
    enabled: !!user && !!currentClinicId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('*, patients(full_name)')
        .eq('clinic_id', currentClinicId!)
        .eq('approval_status', 'awaiting_approval')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Imported transactions (pending review)
  const { data: importedTxs = [] } = useQuery({
    queryKey: ['imported-transactions', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('imported_transactions')
        .select('*')
        .eq('status', 'pending')
        .eq('user_id', user!.id)
        .order('transaction_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Filtered transactions (only fully approved ones show up in the main lists)
  const approvedTx = transactions.filter((tx: any) =>
    !tx.approval_status || tx.approval_status === 'approved'
  );

  // Dedicated 6-month chart query — always fetches last 6 months by paid_date, independent of periodFilter
  const chartStart = startOfMonth(subMonths(now, 5));
  const chartEnd = endOfMonth(now);
  const { data: chartTxRaw = [] } = useQuery({
    queryKey: ['financial-chart-6m', format(chartStart, 'yyyy-MM'), currentClinicId, user?.id, isPersonalMode],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from('financial_transactions')
        .select('type, amount, paid_date')
        .eq('status', 'paid')
        .gte('paid_date', format(chartStart, 'yyyy-MM-dd'))
        .lte('paid_date', format(chartEnd, 'yyyy-MM-dd'));
      if (currentClinicId) {
        q = q.eq('clinic_id', currentClinicId);
      } else if (user) {
        q = q.is('clinic_id', null).eq('dentist_id', user.id);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'paid' | 'pending' | 'overdue' }) => {
      const patch: any = { status };
      if (status === 'paid') patch.paid_date = format(new Date(), 'yyyy-MM-dd');
      else patch.paid_date = null;
      const { error } = await supabase.from('financial_transactions').update(patch).eq('id', id);
      if (error) throw error;
      if (status === 'paid') {
        try { await generateCommissionsForTransaction(id, 'after_payment'); } catch (_) {}
      }
    },
    onSuccess: () => {
      toast.success('Status atualizado');
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['patient-financial-status'] });
      queryClient.invalidateQueries({ queryKey: ['patients-financial-status-bulk'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = approvedTx.filter((tx: any) => {
    if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
    return true;
  });

  // KPIs
  const totalIncome = approvedTx.filter((t: any) => t.type === 'income' && t.status === 'paid').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const totalExpense = approvedTx.filter((t: any) => t.type === 'expense' && t.status === 'paid').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const pendingIncome = approvedTx.filter((t: any) => t.type === 'income' && t.status === 'pending').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const pendingExpense = approvedTx.filter((t: any) => t.type === 'expense' && t.status === 'pending').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  // Monthly chart data — always last 6 months, grouped by paid_date
  const chartData = useMemo(() => {
    const months: Record<string, { income: number; expense: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(now, i);
      const key = format(m, 'MMM', { locale: ptBR });
      months[key] = { income: 0, expense: 0 };
    }
    chartTxRaw.forEach((tx: any) => {
      if (!tx.paid_date) return;
      const key = format(parseISO(tx.paid_date), 'MMM', { locale: ptBR });
      if (months[key]) {
        if (tx.type === 'income') months[key].income += Number(tx.amount);
        else months[key].expense += Number(tx.amount);
      }
    });
    return Object.entries(months).map(([month, data]) => ({ month, ...data }));
  }, [chartTxRaw]);

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <PageHeader title={contextLabel} description={contextDescription}>
        <Badge variant="outline" className="gap-1.5">
          {currentClinicId ? <Building2 className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
          {currentClinicId ? 'Clínica' : 'Pessoal'}
        </Badge>
        <Button variant="outline" size="sm" className="gap-2" asChild>
          <a href="/financeiro/faturas-convenio">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Faturas Convênio</span>
            <span className="sm:hidden">Convênio</span>
          </a>
        </Button>
        <Button variant="outline" size="sm" className="gap-2 flex-1 sm:flex-none sm:size-default" onClick={() => setShowImport(true)}>
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">Importar Extrato (IA)</span>
          <span className="sm:hidden">Importar</span>
        </Button>
        <Button size="sm" className="gap-2 flex-1 sm:flex-none sm:size-default" onClick={() => setShowNewTx(true)}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nova Transação</span>
          <span className="sm:hidden">Nova</span>
        </Button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Receita', value: fmt(totalIncome), icon: TrendingUp, color: 'text-success', bg: 'bg-success/10' },
          { title: 'Despesas', value: fmt(totalExpense), icon: TrendingDown, color: 'text-destructive', bg: 'bg-destructive/10' },
          { title: 'Saldo', value: fmt(balance), icon: DollarSign, color: balance >= 0 ? 'text-success' : 'text-destructive', bg: balance >= 0 ? 'bg-success/10' : 'bg-destructive/10' },
          { title: 'A Receber', value: fmt(pendingIncome), icon: Clock, color: 'text-warning', bg: 'bg-warning/10' },
        ].map((kpi) => (
          <Card key={kpi.title} className="shadow-card border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
              <div className={`h-8 w-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-foreground">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto overflow-x-auto">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="transactions">Transações</TabsTrigger>
          {isClinicOwner && currentClinicId && (
            <TabsTrigger value="clinic-health">Saúde da Clínica</TabsTrigger>
          )}
          {isClinicOwner && currentClinicId && (
            <TabsTrigger value="commissions">Comissões</TabsTrigger>
          )}
          {canApprove && currentClinicId && (
            <TabsTrigger value="approvals">
              Aprovações
              {awaitingApproval.length > 0 && (
                <Badge variant="destructive" className="ml-2 text-[10px] h-5 px-1.5">{awaitingApproval.length}</Badge>
              )}
            </TabsTrigger>
          )}
          {importedTxs.length > 0 && (
            <TabsTrigger value="review">
              Revisão IA
              <Badge variant="destructive" className="ml-2 text-[10px] h-5 px-1.5">{importedTxs.length}</Badge>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Cash Flow Chart */}
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Fluxo de Caixa - Últimos 6 Meses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => fmt(value)}
                      contentStyle={{ borderRadius: '0.5rem', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                    />
                    <Legend />
                    <Bar dataKey="income" name="Receita" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="Despesa" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Pending summary */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="shadow-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-success" /> A Receber
                </CardTitle>
              </CardHeader>
              <CardContent>
                {approvedTx.filter((t: any) => t.type === 'income' && t.status === 'pending').length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhum valor a receber</p>
                ) : (
                  <div className="space-y-2">
                    {approvedTx.filter((t: any) => t.type === 'income' && t.status === 'pending').slice(0, 5).map((tx: any) => (
                      <div key={tx.id} className="flex justify-between py-1.5 border-b border-border/50 last:border-0 text-sm">
                        <span className="text-foreground truncate">{tx.patients?.full_name ?? tx.description}</span>
                        <span className="font-medium text-success whitespace-nowrap ml-2">{fmt(Number(tx.amount))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="shadow-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ArrowDownRight className="h-4 w-4 text-destructive" /> A Pagar
                </CardTitle>
              </CardHeader>
              <CardContent>
                {approvedTx.filter((t: any) => t.type === 'expense' && t.status === 'pending').length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhum valor a pagar</p>
                ) : (
                  <div className="space-y-2">
                    {approvedTx.filter((t: any) => t.type === 'expense' && t.status === 'pending').slice(0, 5).map((tx: any) => (
                      <div key={tx.id} className="flex justify-between py-1.5 border-b border-border/50 last:border-0 text-sm">
                        <span className="text-foreground truncate">{tx.description}</span>
                        <span className="font-medium text-destructive whitespace-nowrap ml-2">{fmt(Number(tx.amount))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Mês Atual</SelectItem>
                <SelectItem value="last">Mês Anterior</SelectItem>
                <SelectItem value="last3">Últimos 3 Meses</SelectItem>
                <SelectItem value="last6">Últimos 6 Meses</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="income">Receitas</SelectItem>
                <SelectItem value="expense">Despesas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full col-span-2 sm:col-span-1 sm:w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="overdue">Vencidos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="Nenhuma transação encontrada"
              description="Registre transações ou importe extratos para começar."
              actionLabel="Nova Transação"
              onAction={() => setShowNewTx(true)}
            />
          ) : (
            <Card className="shadow-card border-border/50 overflow-hidden">
              <div className="w-full overflow-x-auto">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-semibold">Data</TableHead>
                    <TableHead className="font-semibold">Descrição</TableHead>
                    <TableHead className="font-semibold">Paciente</TableHead>
                    <TableHead className="font-semibold">Tipo</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="text-right font-semibold">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((tx: any) => (
                    <TableRow key={tx.id} className="hover:bg-muted/40 transition-colors duration-150">
                      <TableCell className="text-muted-foreground">{format(parseISO(tx.due_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="font-medium text-foreground">{tx.description ?? tx.category}</TableCell>
                      <TableCell className="text-muted-foreground">{tx.patients?.full_name ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={tx.type === 'income' ? 'default' : 'secondary'} className={`text-xs rounded-full gap-1 ${tx.type === 'income' ? 'bg-success/10 text-success hover:bg-success/20' : 'bg-destructive/10 text-destructive hover:bg-destructive/20'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${tx.type === 'income' ? 'bg-success' : 'bg-destructive'}`} />
                          {tx.type === 'income' ? 'Receita' : 'Despesa'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors hover:bg-muted/60 ${
                                tx.status === 'paid' ? 'border-success/30 text-success' :
                                tx.status === 'overdue' ? 'border-destructive/30 text-destructive' :
                                'border-warning/30 text-warning'
                              }`}
                              title="Alterar status"
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                tx.status === 'paid' ? 'bg-success' :
                                tx.status === 'overdue' ? 'bg-destructive' :
                                'bg-warning'
                              }`} />
                              {tx.status === 'paid' ? 'Pago' : tx.status === 'overdue' ? 'Vencido' : 'Pendente'}
                              <ChevronDown className="h-3 w-3 opacity-60" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-44">
                            <DropdownMenuLabel className="text-xs">Alterar status</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={tx.status === 'paid' || updateStatusMutation.isPending}
                              onSelect={() => updateStatusMutation.mutate({ id: tx.id, status: 'paid' })}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-success mr-2" /> Marcar como pago
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={tx.status === 'pending' || updateStatusMutation.isPending}
                              onSelect={() => updateStatusMutation.mutate({ id: tx.id, status: 'pending' })}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-warning mr-2" /> Marcar como pendente
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={tx.status === 'overdue' || updateStatusMutation.isPending}
                              onSelect={() => updateStatusMutation.mutate({ id: tx.id, status: 'overdue' })}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-destructive mr-2" /> Marcar como vencido
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                        {tx.type === 'income' ? '+' : '-'}{fmt(Number(tx.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        {isClinicOwner && currentClinicId && (
          <TabsContent value="clinic-health" className="space-y-4">
            <ClinicHealthPanel
              clinicId={currentClinicId}
              transactions={approvedTx}
              period={period}
            />
          </TabsContent>
        )}

        {isClinicOwner && currentClinicId && (
          <TabsContent value="commissions" className="space-y-4">
            <CommissionsPanel
              clinicId={currentClinicId}
              transactions={approvedTx}
            />
          </TabsContent>
        )}

        {importedTxs.length > 0 && (
          <TabsContent value="review" className="space-y-4">
            <ReviewImportedTransactions
              transactions={importedTxs}
              clinicId={currentClinicId ?? null}
              onComplete={() => {
                queryClient.invalidateQueries({ queryKey: ['imported-transactions'] });
                queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
                queryClient.invalidateQueries({ queryKey: ['financial-chart-6m'] });
                queryClient.invalidateQueries({ queryKey: ['financial-awaiting-approval'] });
              }}
            />
          </TabsContent>
        )}

        {canApprove && currentClinicId && (
          <TabsContent value="approvals" className="space-y-4">
            <ApprovalsList
              transactions={awaitingApproval}
              onComplete={() => {
                queryClient.invalidateQueries({ queryKey: ['financial-awaiting-approval'] });
                queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
                queryClient.invalidateQueries({ queryKey: ['patient-financial-status'] });
                queryClient.invalidateQueries({ queryKey: ['patients-financial-status-bulk'] });
              }}
            />
          </TabsContent>
        )}
      </Tabs>

      <TransactionDialog
        open={showNewTx}
        onOpenChange={setShowNewTx}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
          queryClient.invalidateQueries({ queryKey: ['financial-awaiting-approval'] });
          queryClient.invalidateQueries({ queryKey: ['patient-financial-status'] });
          queryClient.invalidateQueries({ queryKey: ['patients-financial-status-bulk'] });
        }}
      />
      <ImportStatementDialog
        open={showImport}
        onOpenChange={setShowImport}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['imported-transactions'] })}
      />
    </div>
  );
}

// ---- Approvals List ----
function ApprovalsList({ transactions, onComplete }: { transactions: any[]; onComplete: () => void }) {
  const { user } = useAuth();
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [rejectTarget, setRejectTarget] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const approve = async (tx: any) => {
    if (approvingIds.has(tx.id)) return;
    setApprovingIds((prev) => new Set(prev).add(tx.id));
    const { error } = await supabase
      .from('financial_transactions')
      .update({
        approval_status: 'approved',
        approval_decided_by: user?.id ?? null,
        approval_decided_at: new Date().toISOString(),
      })
      .eq('id', tx.id);
    setApprovingIds((prev) => { const s = new Set(prev); s.delete(tx.id); return s; });
    if (error) toast.error(error.message);
    else {
      try { await generateCommissionsForTransaction(tx.id, 'after_procedure'); } catch (_) {}
      toast.success('Cobrança aprovada');
      onComplete();
    }
  };

  const openReject = (tx: any) => {
    setRejectTarget(tx);
    setRejectReason('');
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    const { error } = await supabase
      .from('financial_transactions')
      .update({
        approval_status: 'rejected',
        approval_decided_by: user?.id ?? null,
        approval_decided_at: new Date().toISOString(),
        approval_rejection_reason: rejectReason.trim() || null,
      })
      .eq('id', rejectTarget.id);
    setRejecting(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Cobrança recusada');
    setRejectTarget(null);
    onComplete();
  };

  if (transactions.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma cobrança aguardando aprovação.</p>;
  }

  return (
    <>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Cobranças criadas por dentistas aguardando sua aprovação.
        </p>
        {transactions.map((tx) => (
          <Card key={tx.id} className="p-4 border-border/50">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {tx.description ?? tx.category}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span>{format(parseISO(tx.due_date), 'dd/MM/yyyy')}</span>
                  {tx.patients?.full_name && <span>· {tx.patients.full_name}</span>}
                </div>
              </div>
              <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                {tx.type === 'income' ? '+' : '-'} R$ {Number(tx.amount).toFixed(2).replace('.', ',')}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => openReject(tx)}>
                  <XCircle className="h-4 w-4 mr-1" /> Recusar
                </Button>
                <Button
                  size="sm"
                  onClick={() => approve(tx)}
                  disabled={approvingIds.has(tx.id)}
                >
                  {approvingIds.has(tx.id)
                    ? <span className="mr-1 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent inline-block" />
                    : <CheckCircle2 className="h-4 w-4 mr-1" />
                  }
                  Aprovar
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Recusar cobrança</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reject-reason">Motivo da recusa (opcional)</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Descreva o motivo..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={rejecting}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmReject} disabled={rejecting}>
              {rejecting && <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent inline-block" />}
              Recusar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---- Import Statement Dialog (AI) ----
function ImportStatementDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (o: boolean) => void; onSuccess: () => void }) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<any[]>([]);
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [dragOver, setDragOver] = useState(false);

  const acceptFile = (f: File | null | undefined) => {
    if (!f) return;
    const ok = f.type.startsWith('image/') || f.type === 'application/pdf' || /\.(png|jpe?g|pdf)$/i.test(f.name);
    if (!ok) { toast.error('Envie uma imagem (PNG/JPG) ou PDF.'); return; }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file || !user) return;
    setParsing(true);
    try {
      // Upload file to storage
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('statements').upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData, error: urlError } = await supabase.storage.from('statements').createSignedUrl(path, 600);
      if (urlError || !urlData?.signedUrl) throw urlError || new Error('Failed to create signed URL');
      const fileUrl = urlData.signedUrl;

      // Call AI edge function
      const { data, error } = await supabase.functions.invoke('parse-statement', {
        body: { fileUrl, fileType: file.type },
      });
      if (error) throw error;

      if (data?.transactions?.length > 0) {
        setParsed(data.transactions.map((t: any, i: number) => ({ ...t, _id: i, _selected: true, _sourceUrl: fileUrl })));
        setStep('review');
      } else {
        toast.info('Nenhuma transação encontrada no documento. Tente com outra imagem.');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setParsing(false);
    }
  };

  const handleApprove = async () => {
    if (!user) return;
    const selected = parsed.filter((t) => t._selected);
    if (selected.length === 0) {
      toast.error('Selecione pelo menos uma transação');
      return;
    }

    try {
      const rows = selected.map((t) => ({
        user_id: user.id,
        source_file_url: t._sourceUrl,
        description: t.description,
        amount: t.amount,
        transaction_date: t.date,
        type: t.type,
        category: 'imported',
        status: 'pending',
      }));
      const { error } = await supabase.from('imported_transactions').insert(rows);
      if (error) throw error;
      toast.success(`${selected.length} transações importadas para revisão!`);
      onOpenChange(false);
      onSuccess();
      setStep('upload');
      setParsed([]);
      setFile(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleItem = (id: number) => {
    setParsed((prev) => prev.map((t) => t._id === id ? { ...t, _selected: !t._selected } : t));
  };

  const updateItem = (id: number, patch: Partial<any>) => {
    setParsed((prev) => prev.map((t) => t._id === id ? { ...t, ...patch } : t));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setStep('upload'); setParsed([]); setFile(null); } }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Importar Extrato com IA
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Envie uma imagem ou PDF do extrato bancário. A IA vai extrair as transações para revisão manual.
            </p>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                acceptFile(e.dataTransfer.files?.[0]);
              }}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                id="statement-upload"
                onChange={(e) => acceptFile(e.target.files?.[0])}
              />
              <label htmlFor="statement-upload" className="cursor-pointer">
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">
                  {file ? file.name : (dragOver ? 'Solte o arquivo aqui' : 'Arraste o arquivo ou clique para selecionar')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG ou PDF</p>
              </label>
            </div>
            <Button onClick={handleUpload} disabled={!file || parsing} className="w-full gap-2">
              {parsing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Analisando com IA...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Analisar Extrato
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A IA encontrou {parsed.length} transações. Revise e desmarque as que não deseja importar.
            </p>
            <p className="text-xs text-muted-foreground">Dica: clique nos campos para corrigir o que a IA errou.</p>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {parsed.map((tx) => (
                <div
                  key={tx._id}
                  className={`p-3 rounded-lg border transition-colors ${
                    tx._selected ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/20 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleItem(tx._id)}
                      className={`mt-1 h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center ${tx._selected ? 'border-primary bg-primary' : 'border-border'}`}
                    >
                      {tx._selected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                    </button>
                    <div className="flex-1 min-w-0 space-y-2">
                      <Input
                        value={tx.description ?? ''}
                        onChange={(e) => updateItem(tx._id, { description: e.target.value })}
                        placeholder="Descrição"
                        className="h-8 text-sm"
                      />
                       <div className="grid grid-cols-[160px_1fr_140px] gap-2">
                        <Input
                          type="date"
                          value={tx.date ?? ''}
                          onChange={(e) => updateItem(tx._id, { date: e.target.value })}
                          className="h-9 text-sm"
                        />
                        <Input
                          inputMode="numeric"
                          value={formatBRL(tx.amount ?? 0)}
                          onChange={(e) => updateItem(tx._id, { amount: parseBRL(e.target.value) })}
                          className="h-9 text-sm font-medium"
                          placeholder="R$ 0,00"
                        />
                        <Select value={tx.type} onValueChange={(v) => updateItem(tx._id, { type: v })}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="income">Receita</SelectItem>
                            <SelectItem value="expense">Despesa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setStep('upload'); setParsed([]); }}>
                Voltar
              </Button>
              <Button className="flex-1 gap-2" onClick={handleApprove}>
                <CheckCircle2 className="h-4 w-4" />
                Importar {parsed.filter((t) => t._selected).length} Selecionadas
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---- Review Imported Transactions ----
function ReviewImportedTransactions({ transactions, onComplete, clinicId }: { transactions: any[]; onComplete: () => void; clinicId: string | null }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [approvingAll, setApprovingAll] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>({});

  const buildFinancialRow = (tx: any) => ({
    type: tx.type,
    category: tx.category || 'imported',
    description: tx.description,
    amount: tx.amount,
    due_date: tx.transaction_date,
    status: 'paid',
    paid_date: tx.transaction_date,
    dentist_id: user?.id,
    clinic_id: clinicId ?? null,
    approval_status: 'approved',
    approval_decided_by: user?.id,
    approval_decided_at: new Date().toISOString(),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
    queryClient.invalidateQueries({ queryKey: ['financial-chart-6m'] });
    queryClient.invalidateQueries({ queryKey: ['financial-awaiting-approval'] });
    queryClient.invalidateQueries({ queryKey: ['imported-transactions'] });
  };

  const startEdit = (tx: any) => {
    setEditingId(tx.id);
    setDraft({
      description: tx.description ?? '',
      amount: tx.amount,
      transaction_date: tx.transaction_date,
      type: tx.type,
    });
  };

  const saveEdit = async (tx: any) => {
    try {
      const { error } = await supabase.from('imported_transactions').update({
        description: draft.description,
        amount: Number(draft.amount) || 0,
        transaction_date: draft.transaction_date,
        type: draft.type,
      }).eq('id', tx.id);
      if (error) throw error;
      setEditingId(null);
      toast.success('Atualizado');
      onComplete();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const approveTransaction = async (tx: any) => {
    if (!user) return;
    try {
      const { error: insErr } = await supabase.from('financial_transactions').insert(buildFinancialRow(tx));
      if (insErr) throw insErr;
      await supabase.from('imported_transactions').update({ status: 'approved' }).eq('id', tx.id);
      toast.success('Transação aprovada!');
      invalidateAll();
      onComplete();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const rejectTransaction = async (tx: any) => {
    try {
      await supabase.from('imported_transactions').update({ status: 'rejected' }).eq('id', tx.id);
      toast.success('Transação rejeitada');
      onComplete();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const approveAll = async () => {
    setApprovingAll(true);
    let failed = 0;
    for (const tx of transactions) {
      try {
        const { error: insErr } = await supabase.from('financial_transactions').insert(buildFinancialRow(tx));
        if (insErr) throw insErr;
        await supabase.from('imported_transactions').update({ status: 'approved' }).eq('id', tx.id);
      } catch {
        failed++;
      }
    }
    setApprovingAll(false);
    if (failed > 0) toast.error(`${failed} transação(ões) falharam ao aprovar`);
    const succeeded = transactions.length - failed;
    if (succeeded > 0) {
      toast.success(`${succeeded} transação(ões) aprovadas`);
      invalidateAll();
      onComplete();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {transactions.length} transações aguardando revisão
          {clinicId ? '' : ' (serão lançadas no contexto Pessoal)'}
        </p>
        <Button size="sm" onClick={approveAll} disabled={approvingAll} className="gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {approvingAll ? 'Aprovando…' : 'Aprovar Todas'}
        </Button>
      </div>
      <div className="space-y-2">
        {transactions.map((tx: any) => (
          <Card key={tx.id} className="shadow-card border-border/50 p-4">
            {editingId === tx.id ? (
              <div className="space-y-2">
                <Input
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="Descrição"
                  className="h-8 text-sm"
                />
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    type="date"
                    value={draft.transaction_date}
                    onChange={(e) => setDraft({ ...draft, transaction_date: e.target.value })}
                    className="h-8 text-xs"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={draft.amount}
                    onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                    className="h-8 text-xs"
                  />
                  <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Receita</SelectItem>
                      <SelectItem value="expense">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                  <Button size="sm" onClick={() => saveEdit(tx)}>Salvar</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{tx.description}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">{format(parseISO(tx.transaction_date), 'dd/MM/yyyy')}</span>
                    <Badge variant="outline" className="text-xs">{tx.type === 'income' ? 'Receita' : 'Despesa'}</Badge>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                  R$ {Number(tx.amount).toFixed(2)}
                </span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(tx)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-success hover:bg-success/10" onClick={() => approveTransaction(tx)}>
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => rejectTransaction(tx)}>
                    <XCircle className="h-4 w-4" />
                </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
