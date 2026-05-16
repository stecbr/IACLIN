import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, parseISO, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DollarSign, TrendingUp, TrendingDown, Clock, Plus, Upload, Filter,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Financial() {
  const { user, currentClinicId, isPersonalMode, clinics } = useAuth();
  const queryClient = useQueryClient();
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
        .select('*, patients(full_name)')
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

  // Filtered transactions
  const filtered = transactions.filter((tx: any) => {
    if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
    return true;
  });

  // KPIs
  const totalIncome = transactions.filter((t: any) => t.type === 'income' && t.status === 'paid').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const totalExpense = transactions.filter((t: any) => t.type === 'expense' && t.status === 'paid').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const pendingIncome = transactions.filter((t: any) => t.type === 'income' && t.status === 'pending').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const pendingExpense = transactions.filter((t: any) => t.type === 'expense' && t.status === 'pending').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  // Monthly chart data (last 6 months)
  const chartData = useMemo(() => {
    const months: Record<string, { income: number; expense: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(now, i);
      const key = format(m, 'MMM', { locale: ptBR });
      months[key] = { income: 0, expense: 0 };
    }
    transactions.forEach((tx: any) => {
      if (tx.status !== 'paid') return;
      const key = format(parseISO(tx.paid_date || tx.due_date), 'MMM', { locale: ptBR });
      if (months[key]) {
        if (tx.type === 'income') months[key].income += Number(tx.amount);
        else months[key].expense += Number(tx.amount);
      }
    });
    return Object.entries(months).map(([month, data]) => ({ month, ...data }));
  }, [transactions]);

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <PageHeader title={contextLabel} description={contextDescription}>
        <Badge variant="outline" className="gap-1.5 mr-1">
          {currentClinicId ? <Building2 className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
          {currentClinicId ? 'Clínica' : 'Pessoal'}
        </Badge>
        <Button variant="outline" className="gap-2" onClick={() => setShowImport(true)}>
          <Sparkles className="h-4 w-4" />
          Importar Extrato (IA)
        </Button>
        <Button className="gap-2" onClick={() => setShowNewTx(true)}>
          <Plus className="h-4 w-4" />
          Nova Transação
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
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="transactions">Transações</TabsTrigger>
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
                {transactions.filter((t: any) => t.type === 'income' && t.status === 'pending').length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhum valor a receber</p>
                ) : (
                  <div className="space-y-2">
                    {transactions.filter((t: any) => t.type === 'income' && t.status === 'pending').slice(0, 5).map((tx: any) => (
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
                {transactions.filter((t: any) => t.type === 'expense' && t.status === 'pending').length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhum valor a pagar</p>
                ) : (
                  <div className="space-y-2">
                    {transactions.filter((t: any) => t.type === 'expense' && t.status === 'pending').slice(0, 5).map((tx: any) => (
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
          <div className="flex flex-wrap gap-3">
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Mês Atual</SelectItem>
                <SelectItem value="last">Mês Anterior</SelectItem>
                <SelectItem value="last3">Últimos 3 Meses</SelectItem>
                <SelectItem value="last6">Últimos 6 Meses</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="income">Receitas</SelectItem>
                <SelectItem value="expense">Despesas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
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
              <Table>
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
                        <Badge variant="outline" className={`text-xs rounded-full gap-1 ${
                          tx.status === 'paid' ? 'border-success/30 text-success' :
                          tx.status === 'overdue' ? 'border-destructive/30 text-destructive' :
                          'border-warning/30 text-warning'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            tx.status === 'paid' ? 'bg-success' :
                            tx.status === 'overdue' ? 'bg-destructive' :
                            'bg-warning'
                          }`} />
                          {tx.status === 'paid' ? 'Pago' : tx.status === 'overdue' ? 'Vencido' : 'Pendente'}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                        {tx.type === 'income' ? '+' : '-'}{fmt(Number(tx.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {importedTxs.length > 0 && (
          <TabsContent value="review" className="space-y-4">
            <ReviewImportedTransactions transactions={importedTxs} onComplete={() => queryClient.invalidateQueries({ queryKey: ['imported-transactions'] })} />
          </TabsContent>
        )}
      </Tabs>

      <NewTransactionDialog open={showNewTx} onOpenChange={setShowNewTx} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['financial-transactions'] })} />
      <ImportStatementDialog open={showImport} onOpenChange={setShowImport} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['imported-transactions'] })} />
    </div>
  );
}

// ---- New Transaction Dialog ----
function NewTransactionDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (o: boolean) => void; onSuccess: () => void }) {
  const { user, currentClinicId, clinics } = useAuth();
  const frozenClinicId = useRef<string | null>(null);
  const [contextName, setContextName] = useState<string>('Pessoal');
  useEffect(() => {
    if (open) {
      frozenClinicId.current = currentClinicId;
      const c = clinics.find((x) => x.clinic_id === currentClinicId);
      setContextName(currentClinicId ? (c?.clinic_name ?? 'Clínica') : 'Pessoal');
    }
  }, [open, currentClinicId, clinics]);
  const [form, setForm] = useState({
    type: 'income',
    category: 'consultation',
    description: '',
    amount: '',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    status: 'pending',
    payment_method: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (frozenClinicId.current !== currentClinicId) {
      toast.error('O contexto foi alterado. Reabra o formulário para continuar.');
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('financial_transactions').insert({
        type: form.type,
        category: form.category,
        description: form.description || null,
        amount: parseFloat(form.amount),
        due_date: form.due_date,
        status: form.status,
        payment_method: form.payment_method || null,
        notes: form.notes || null,
        dentist_id: user.id,
        clinic_id: frozenClinicId.current ?? null,
      });
      if (error) throw error;
      toast.success('Transação registrada!');
      onOpenChange(false);
      onSuccess();
      setForm({ type: 'income', category: 'consultation', description: '', amount: '', due_date: format(new Date(), 'yyyy-MM-dd'), status: 'pending', payment_method: '', notes: '' });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nova Transação</DialogTitle></DialogHeader>
        <div className="text-xs text-muted-foreground -mt-2 mb-1">
          Será registrada em: <span className="font-medium text-foreground">{contextName}</span>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultation">Consulta</SelectItem>
                  <SelectItem value="procedure">Procedimento</SelectItem>
                  <SelectItem value="rent">Aluguel</SelectItem>
                  <SelectItem value="supplies">Material</SelectItem>
                  <SelectItem value="salary">Salário</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição da transação" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label>Vencimento</Label>
              <Input type="date" required value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Forma Pgto</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="credit_card">Cartão Crédito</SelectItem>
                  <SelectItem value="debit_card">Cartão Débito</SelectItem>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="bank_transfer">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Transação'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Import Statement Dialog (AI) ----
function ImportStatementDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (o: boolean) => void; onSuccess: () => void }) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<any[]>([]);
  const [step, setStep] = useState<'upload' | 'review'>('upload');

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

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setStep('upload'); setParsed([]); setFile(null); } }}>
      <DialogContent className="max-w-lg">
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
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                id="statement-upload"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <label htmlFor="statement-upload" className="cursor-pointer">
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">{file ? file.name : 'Clique para selecionar o arquivo'}</p>
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
            <div className="max-h-64 overflow-y-auto space-y-2">
              {parsed.map((tx) => (
                <div
                  key={tx._id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                    tx._selected ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/20 opacity-60'
                  }`}
                  onClick={() => toggleItem(tx._id)}
                >
                  <div className={`h-5 w-5 rounded border-2 flex items-center justify-center ${tx._selected ? 'border-primary bg-primary' : 'border-border'}`}>
                    {tx._selected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">{tx.date}</p>
                  </div>
                  <span className={`text-sm font-semibold whitespace-nowrap ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                    {tx.type === 'income' ? '+' : '-'}R$ {Number(tx.amount).toFixed(2)}
                  </span>
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
function ReviewImportedTransactions({ transactions, onComplete }: { transactions: any[]; onComplete: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const approveTransaction = async (tx: any) => {
    if (!user) return;
    try {
      // Insert into financial_transactions
      await supabase.from('financial_transactions').insert({
        type: tx.type,
        category: tx.category || 'imported',
        description: tx.description,
        amount: tx.amount,
        due_date: tx.transaction_date,
        status: 'paid',
        paid_date: tx.transaction_date,
        dentist_id: user.id,
      });
      // Mark as approved
      await supabase.from('imported_transactions').update({ status: 'approved' }).eq('id', tx.id);
      toast.success('Transação aprovada!');
      onComplete();
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
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
    for (const tx of transactions) {
      await approveTransaction(tx);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{transactions.length} transações aguardando revisão</p>
        <Button size="sm" onClick={approveAll} className="gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Aprovar Todas
        </Button>
      </div>
      <div className="space-y-2">
        {transactions.map((tx: any) => (
          <Card key={tx.id} className="shadow-card border-border/50 p-4">
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
                <Button size="icon" variant="ghost" className="h-8 w-8 text-success hover:bg-success/10" onClick={() => approveTransaction(tx)}>
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => rejectTransaction(tx)}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
