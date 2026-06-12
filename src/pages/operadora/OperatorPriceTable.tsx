import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Plus, Trash2, Upload, FileText, Download, Loader2, MapPin,
  CalendarDays, Table2, FilePlus2, Search, X, CheckSquare, ArrowLeft,
  Sparkles, ChevronDown, ChevronUp, Check,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { BRAZIL_STATES, stateName } from '@/lib/brazilStates';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// ── Types ──────────────────────────────────────────────────────────────────
interface PriceTable {
  id: string;
  operator_id: string;
  name: string;
  region: string | null;
  state: string | null;
  city: string | null;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
}

interface PriceItem {
  id: string;
  table_id: string;
  category: string;
  procedure_name: string;
  tuss_code: string | null;
  charge_type: string;
  value_us: number | null;
  value_brl: number | null;
  rx_required: boolean;
  longevity: string | null;
  observations: string | null;
  photo_required: boolean;
  plan_coverage: string[];
  sort_order: number;
}

interface PriceFile {
  id: string;
  table_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

const CHARGE_TYPES = ['Geral', 'Dente', 'Arcada', 'Hemi-arcada', 'Sextante', 'Região'];
const CATEGORIES = [
  'Consulta', 'Diagnóstico', 'Urgência', 'Prevenção', 'Odontopediatria',
  'Dentística Restauradora', 'Cirurgia Simples', 'Oral Menor', 'Periodontia',
  'Endodontia', 'Prótese', 'Ortodontia', 'Geral', 'Clínica Médica',
  'Cardiologia', 'Exames', 'Outros',
];

const BLANK_ITEM: Omit<PriceItem, 'id' | 'table_id' | 'created_at'> = {
  category: 'Consulta',
  procedure_name: '',
  tuss_code: '',
  charge_type: 'Geral',
  value_us: null,
  value_brl: null,
  rx_required: false,
  longevity: '',
  observations: '',
  photo_required: false,
  plan_coverage: [],
  sort_order: 0,
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd/MM/yyyy', { locale: ptBR }); } catch { return d; }
}

function fmtBRL(v: number | null) {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function OperatorPriceTable() {
  const { operatorId } = useAuth();

  const [tables, setTables] = useState<PriceTable[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);

  const [items, setItems] = useState<PriceItem[]>([]);
  const [files, setFiles] = useState<PriceFile[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');

  // dialogs
  const [showNewTable, setShowNewTable] = useState(false);
  const [showNewItem, setShowNewItem] = useState(false);
  const [savingTable, setSavingTable] = useState(false);
  const [savingItem, setSavingItem] = useState(false);

  const [newTable, setNewTable] = useState({ name: '', region: '', state: '', city: '', valid_from: '', valid_until: '' });
  const [newItem, setNewItem] = useState<typeof BLANK_ITEM>({ ...BLANK_ITEM });
  const [planInput, setPlanInput] = useState('');

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // load tables
  useEffect(() => {
    if (!operatorId) return;
    setLoadingTables(true);
    supabase
      .from('operator_price_tables')
      .select('*')
      .eq('operator_id', operatorId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const list = (data ?? []) as PriceTable[];
        setTables(list);
        if (list.length > 0 && !activeTableId) setActiveTableId(list[0].id);
        setLoadingTables(false);
      });
  }, [operatorId]);

  // load items + files when active table changes
  useEffect(() => {
    if (!activeTableId) { setItems([]); setFiles([]); return; }
    setLoadingContent(true);
    Promise.all([
      supabase.from('operator_price_items').select('*').eq('table_id', activeTableId).order('category').order('sort_order').order('procedure_name'),
      supabase.from('operator_price_files').select('*').eq('table_id', activeTableId).order('created_at', { ascending: false }),
    ]).then(([{ data: its }, { data: fls }]) => {
      setItems((its ?? []) as PriceItem[]);
      setFiles((fls ?? []) as PriceFile[]);
      setLoadingContent(false);
    });
  }, [activeTableId]);

  // ── create table ──────────────────────────────────────────────────────────
  const handleCreateTable = async () => {
    if (!operatorId || !newTable.name.trim()) return toast.error('Informe o nome da tabela');
    setSavingTable(true);
    const { data, error } = await supabase
      .from('operator_price_tables')
      .insert({
        operator_id: operatorId,
        name: newTable.name.trim(),
        region: newTable.region || null,
        state: newTable.state || null,
        city: newTable.city || null,
        valid_from: newTable.valid_from || new Date().toISOString().slice(0, 10),
        valid_until: newTable.valid_until || null,
      })
      .select()
      .single();
    setSavingTable(false);
    if (error) return toast.error('Erro ao criar tabela: ' + error.message);
    const created = data as PriceTable;
    setTables((prev) => [created, ...prev]);
    setActiveTableId(created.id);
    setShowNewTable(false);
    setNewTable({ name: '', region: '', state: '', city: '', valid_from: '', valid_until: '' });
    toast.success('Tabela criada');
  };

  // ── delete table ──────────────────────────────────────────────────────────
  const handleDeleteTable = async (id: string) => {
    if (!confirm('Excluir esta tabela e todos os seus itens?')) return;
    const { error } = await supabase.from('operator_price_tables').delete().eq('id', id);
    if (error) return toast.error(error.message);
    setTables((prev) => prev.filter((t) => t.id !== id));
    if (activeTableId === id) setActiveTableId(tables.find((t) => t.id !== id)?.id ?? null);
    toast.success('Tabela excluída');
  };

  // ── create item ───────────────────────────────────────────────────────────
  const handleCreateItem = async () => {
    if (!activeTableId) return;
    if (!newItem.procedure_name.trim()) return toast.error('Informe o nome do procedimento');
    setSavingItem(true);
    const payload = {
      table_id: activeTableId,
      category: newItem.category,
      procedure_name: newItem.procedure_name.trim(),
      tuss_code: newItem.tuss_code?.trim() || null,
      charge_type: newItem.charge_type,
      value_us: newItem.value_us,
      value_brl: newItem.value_brl,
      rx_required: newItem.rx_required,
      longevity: newItem.longevity?.trim() || null,
      observations: newItem.observations?.trim() || null,
      photo_required: newItem.photo_required,
      plan_coverage: newItem.plan_coverage,
      sort_order: items.length,
    };
    const { data, error } = await supabase
      .from('operator_price_items')
      .insert(payload)
      .select()
      .single();
    setSavingItem(false);
    if (error) return toast.error('Erro ao salvar: ' + error.message);
    setItems((prev) => [...prev, data as PriceItem]);
    setShowNewItem(false);
    setNewItem({ ...BLANK_ITEM });
    setPlanInput('');
    toast.success('Procedimento adicionado');
  };

  // ── delete item ───────────────────────────────────────────────────────────
  const handleDeleteItem = async (id: string) => {
    const { error } = await supabase.from('operator_price_items').delete().eq('id', id);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // ── upload file ───────────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeTableId || !operatorId) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `operators/${operatorId}/price-tables/${activeTableId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('clinic-assets').upload(path, file, { upsert: true });
    if (upErr) { toast.error('Erro no upload: ' + upErr.message); setUploading(false); return; }
    const { data: pub } = supabase.storage.from('clinic-assets').getPublicUrl(path);
    const { data: rec, error: dbErr } = await supabase
      .from('operator_price_files')
      .insert({
        table_id: activeTableId,
        file_name: file.name,
        file_url: pub.publicUrl,
        file_type: file.type || null,
        file_size: file.size,
      })
      .select()
      .single();
    setUploading(false);
    if (dbErr) return toast.error(dbErr.message);
    setFiles((prev) => [rec as PriceFile, ...prev]);
    toast.success('Arquivo enviado');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteFile = async (id: string) => {
    const { error } = await supabase.from('operator_price_files').delete().eq('id', id);
    if (error) return toast.error(error.message);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // ── filter ────────────────────────────────────────────────────────────────
  const filteredItems = items.filter((it) => {
    const q = search.toLowerCase();
    const matchQ = !q || it.procedure_name.toLowerCase().includes(q) || (it.tuss_code ?? '').toLowerCase().includes(q);
    const matchCat = !filterCategory || it.category === filterCategory;
    return matchQ && matchCat;
  });

  const activeTable = tables.find((t) => t.id === activeTableId);
  const categories = [...new Set(items.map((i) => i.category))].sort();

  // ── render ────────────────────────────────────────────────────────────────
  if (loadingTables) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tabela de Valores</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie os procedimentos cobertos e valores por plano e região
          </p>
        </div>
        <Button onClick={() => setShowNewTable(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Tabela
        </Button>
      </div>

      {/* Empty state */}
      {tables.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="rounded-full bg-primary/10 p-4">
              <Table2 className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Nenhuma tabela criada</p>
              <p className="text-sm text-muted-foreground mt-1">
                Crie a primeira tabela de valores para definir procedimentos e preços por plano.
              </p>
            </div>
            <Button onClick={() => setShowNewTable(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeira tabela
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Table list + content */}
      {tables.length > 0 && (
        <div className="flex gap-5 items-start">
          {/* Sidebar: table list */}
          <div className="w-64 shrink-0 space-y-2">
            {tables.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTableId(t.id)}
                className={`w-full text-left rounded-xl border p-3 transition-colors group ${
                  activeTableId === t.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/30'
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="text-sm font-semibold leading-tight line-clamp-2">{t.name}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDeleteTable(t.id); }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {(t.state || t.city || t.region) && (
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{[t.city, t.state, t.region].filter(Boolean).join(' · ')}</span>
                  </div>
                )}
                <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarDays className="h-3 w-3 shrink-0" />
                  <span>Vigência: {fmtDate(t.valid_from)}</span>
                </div>
              </button>
            ))}
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setShowNewTable(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Nova tabela
            </Button>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {loadingContent ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : activeTable ? (
              <Tabs defaultValue="procedimentos">
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <TabsList>
                    <TabsTrigger value="procedimentos">
                      Procedimentos
                      <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-4">{items.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="arquivos">
                      Arquivos
                      {files.length > 0 && (
                        <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-4">{files.length}</Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Procedimentos tab */}
                <TabsContent value="procedimentos" className="space-y-4 mt-0">
                  <div className="flex gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar procedimento ou código TUSS..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8 h-9"
                      />
                    </div>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger className="w-44 h-9">
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todas as categorias</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(search || filterCategory) && (
                      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => { setSearch(''); setFilterCategory(''); }}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="sm" className="h-9" onClick={() => setShowNewItem(true)}>
                      <FilePlus2 className="h-4 w-4 mr-2" />
                      Adicionar
                    </Button>
                  </div>

                  {filteredItems.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="flex flex-col items-center py-10 gap-3">
                        <Table2 className="h-7 w-7 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">
                          {items.length === 0 ? 'Nenhum procedimento cadastrado' : 'Nenhum resultado para o filtro'}
                        </p>
                        {items.length === 0 && (
                          <Button variant="outline" size="sm" onClick={() => setShowNewItem(true)}>
                            <Plus className="h-4 w-4 mr-1" />
                            Adicionar procedimento
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="rounded-xl border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="text-xs">Procedimento</TableHead>
                            <TableHead className="text-xs w-28">Cód. TUSS</TableHead>
                            <TableHead className="text-xs w-24">Categoria</TableHead>
                            <TableHead className="text-xs w-24">Cobrança</TableHead>
                            <TableHead className="text-xs w-24 text-right">US (R$)</TableHead>
                            <TableHead className="text-xs w-28 text-right">Valor R$</TableHead>
                            <TableHead className="text-xs w-12 text-center">RX</TableHead>
                            <TableHead className="text-xs w-36">Planos</TableHead>
                            <TableHead className="w-8" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredItems.map((item) => (
                            <TableRow key={item.id} className="text-sm">
                              <TableCell className="font-medium leading-tight">
                                <div>{item.procedure_name}</div>
                                {item.longevity && (
                                  <div className="text-[11px] text-muted-foreground">Long.: {item.longevity}</div>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground font-mono text-xs">{item.tuss_code || '—'}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[11px] px-1.5 py-0">
                                  {item.category}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{item.charge_type}</TableCell>
                              <TableCell className="text-right tabular-nums text-xs">{fmtBRL(item.value_us)}</TableCell>
                              <TableCell className="text-right tabular-nums font-semibold text-xs">{fmtBRL(item.value_brl)}</TableCell>
                              <TableCell className="text-center">
                                {item.rx_required && <CheckSquare className="h-3.5 w-3.5 text-primary mx-auto" />}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-0.5">
                                  {item.plan_coverage.map((p) => (
                                    <Badge key={p} variant="secondary" className="text-[10px] px-1 py-0">{p}</Badge>
                                  ))}
                                  {item.plan_coverage.length === 0 && (
                                    <span className="text-[11px] text-muted-foreground">Todos</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="p-1 rounded text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                {/* Arquivos tab */}
                <TabsContent value="arquivos" className="space-y-4 mt-0">
                  <Card className="border-dashed cursor-pointer hover:border-primary/60 transition-colors"
                    onClick={() => fileInputRef.current?.click()}>
                    <CardContent className="flex flex-col items-center py-10 gap-3">
                      {uploading ? (
                        <Loader2 className="h-7 w-7 animate-spin text-primary" />
                      ) : (
                        <Upload className="h-7 w-7 text-muted-foreground/60" />
                      )}
                      <div className="text-center">
                        <p className="text-sm font-medium">
                          {uploading ? 'Enviando...' : 'Clique para enviar arquivo'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          PDF, Excel (.xlsx), CSV — máximo 20 MB
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.xlsx,.xls,.csv,.ods"
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  {files.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum arquivo enviado
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {files.map((f) => (
                        <Card key={f.id}>
                          <CardContent className="flex items-center gap-3 py-3 px-4">
                            <div className="rounded-md bg-primary/10 p-2 shrink-0">
                              <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{f.file_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {fmtSize(f.file_size)} · {fmtDate(f.created_at)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <a
                                href={f.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                title="Baixar"
                              >
                                <Download className="h-4 w-4" />
                              </a>
                              <button
                                type="button"
                                onClick={() => handleDeleteFile(f.id)}
                                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Dialog: New Table ─────────────────────────────────────────────── */}
      <Dialog open={showNewTable} onOpenChange={setShowNewTable}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Tabela de Valores</DialogTitle>
            <DialogDescription>
              Defina o nome, vigência e abrangência geográfica desta tabela.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome da tabela *</Label>
              <Input
                placeholder="Ex.: Tabela Padrão 2024"
                value={newTable.name}
                onChange={(e) => setNewTable((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Vigência início</Label>
                <Input
                  type="date"
                  value={newTable.valid_from}
                  onChange={(e) => setNewTable((p) => ({ ...p, valid_from: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Vigência fim</Label>
                <Input
                  type="date"
                  value={newTable.valid_until}
                  onChange={(e) => setNewTable((p) => ({ ...p, valid_until: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Região (opcional)</Label>
              <Input
                placeholder="Ex.: Nordeste, Sul, Nacional"
                value={newTable.region}
                onChange={(e) => setNewTable((p) => ({ ...p, region: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Estado (UF)</Label>
                <Input
                  placeholder="Ex.: CE"
                  maxLength={2}
                  value={newTable.state}
                  onChange={(e) => setNewTable((p) => ({ ...p, state: e.target.value.toUpperCase() }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input
                  placeholder="Ex.: Fortaleza"
                  value={newTable.city}
                  onChange={(e) => setNewTable((p) => ({ ...p, city: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTable(false)}>Cancelar</Button>
            <Button onClick={handleCreateTable} disabled={savingTable}>
              {savingTable && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Tabela
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: New Item ──────────────────────────────────────────────── */}
      <Dialog open={showNewItem} onOpenChange={setShowNewItem}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Procedimento</DialogTitle>
            <DialogDescription>
              Preencha os dados do procedimento conforme a tabela TUSS.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do procedimento *</Label>
              <Input
                placeholder="Ex.: Consulta odontológica inicial"
                value={newItem.procedure_name}
                onChange={(e) => setNewItem((p) => ({ ...p, procedure_name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Código TUSS</Label>
                <Input
                  placeholder="Ex.: 81000014"
                  value={newItem.tuss_code ?? ''}
                  onChange={(e) => setNewItem((p) => ({ ...p, tuss_code: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={newItem.category} onValueChange={(v) => setNewItem((p) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo de cobrança</Label>
                <Select value={newItem.charge_type} onValueChange={(v) => setNewItem((p) => ({ ...p, charge_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHARGE_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Valor R$</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0,00"
                  value={newItem.value_brl ?? ''}
                  onChange={(e) => setNewItem((p) => ({ ...p, value_brl: e.target.value ? parseFloat(e.target.value) : null }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>USO (valor US)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0,00"
                  value={newItem.value_us ?? ''}
                  onChange={(e) => setNewItem((p) => ({ ...p, value_us: e.target.value ? parseFloat(e.target.value) : null }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Longevidade</Label>
                <Input
                  placeholder="Ex.: 24 meses"
                  value={newItem.longevity ?? ''}
                  onChange={(e) => setNewItem((p) => ({ ...p, longevity: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="rx"
                  checked={newItem.rx_required}
                  onCheckedChange={(v) => setNewItem((p) => ({ ...p, rx_required: v }))}
                />
                <Label htmlFor="rx" className="cursor-pointer">Exige RX</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="foto"
                  checked={newItem.photo_required}
                  onCheckedChange={(v) => setNewItem((p) => ({ ...p, photo_required: v }))}
                />
                <Label htmlFor="foto" className="cursor-pointer">Exige Fotografia</Label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Planos cobertos</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do plano (Enter para adicionar)"
                  value={planInput}
                  onChange={(e) => setPlanInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && planInput.trim()) {
                      e.preventDefault();
                      const p = planInput.trim();
                      if (!newItem.plan_coverage.includes(p)) {
                        setNewItem((prev) => ({ ...prev, plan_coverage: [...prev.plan_coverage, p] }));
                      }
                      setPlanInput('');
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const p = planInput.trim();
                    if (p && !newItem.plan_coverage.includes(p)) {
                      setNewItem((prev) => ({ ...prev, plan_coverage: [...prev.plan_coverage, p] }));
                      setPlanInput('');
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {newItem.plan_coverage.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {newItem.plan_coverage.map((p) => (
                    <Badge key={p} variant="secondary" className="gap-1 cursor-pointer"
                      onClick={() => setNewItem((prev) => ({ ...prev, plan_coverage: prev.plan_coverage.filter((x) => x !== p) }))}>
                      {p} <X className="h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              )}
              {newItem.plan_coverage.length === 0 && (
                <p className="text-xs text-muted-foreground">Deixe vazio para cobrir todos os planos</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                placeholder="Observações adicionais..."
                rows={2}
                value={newItem.observations ?? ''}
                onChange={(e) => setNewItem((p) => ({ ...p, observations: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewItem(false)}>Cancelar</Button>
            <Button onClick={handleCreateItem} disabled={savingItem}>
              {savingItem && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
