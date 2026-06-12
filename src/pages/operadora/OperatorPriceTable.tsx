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
  Sparkles, ChevronDown, ChevronUp, Check, Eye,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { BRAZIL_STATES, stateName } from '@/lib/brazilStates';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PriceFileViewerDialog, type PriceFileLike } from '@/components/operadora/PriceFileViewerDialog';

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

  // active_states from insurance_operators
  const [activeStates, setActiveStates] = useState<string[]>([]);
  const [savingStates, setSavingStates] = useState(false);

  // all tables for this operator (one per UF in the new model)
  const [tables, setTables] = useState<PriceTable[]>([]);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [loadingTables, setLoadingTables] = useState(true);

  // selected UF + its data
  const [selectedUf, setSelectedUf] = useState<string | null>(null);
  const [items, setItems] = useState<PriceItem[]>([]);
  const [files, setFiles] = useState<PriceFile[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('__all__');
  const [showOthers, setShowOthers] = useState(false);

  // dialogs
  const [showAddState, setShowAddState] = useState(false);
  const [showNewItem, setShowNewItem] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [newItem, setNewItem] = useState<typeof BLANK_ITEM>({ ...BLANK_ITEM });
  const [planInput, setPlanInput] = useState('');

  // upload progress
  const [uploadStage, setUploadStage] = useState<null | 'reading' | 'ai' | 'saving'>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── load operator + tables ─────────────────────────────────────────────
  useEffect(() => {
    if (!operatorId) return;
    setLoadingTables(true);
    (async () => {
      const [{ data: op }, { data: ts }] = await Promise.all([
        supabase.from('insurance_operators').select('active_states').eq('id', operatorId).maybeSingle(),
        supabase.from('operator_price_tables').select('*').eq('operator_id', operatorId).order('created_at', { ascending: false }),
      ]);
      setActiveStates(((op as any)?.active_states ?? []) as string[]);
      const list = (ts ?? []) as PriceTable[];
      setTables(list);

      // counts per UF
      const { data: counts } = await supabase
        .from('operator_price_items')
        .select('table_id, operator_price_tables!inner(state, operator_id)')
        .eq('operator_price_tables.operator_id', operatorId);
      const map: Record<string, number> = {};
      const tableUfById = new Map(list.map((t) => [t.id, t.state ?? '']));
      (counts ?? []).forEach((row: any) => {
        const uf = tableUfById.get(row.table_id) ?? '';
        if (!uf) return;
        map[uf] = (map[uf] ?? 0) + 1;
      });
      setTableCounts(map);
      setLoadingTables(false);
    })();
  }, [operatorId]);

  // ── load items + files when UF changes ─────────────────────────────────
  useEffect(() => {
    if (!selectedUf) { setItems([]); setFiles([]); return; }
    const table = tables.find((t) => t.state === selectedUf);
    if (!table) { setItems([]); setFiles([]); return; }
    setLoadingContent(true);
    Promise.all([
      supabase.from('operator_price_items').select('*').eq('table_id', table.id).order('category').order('sort_order').order('procedure_name'),
      supabase.from('operator_price_files').select('*').eq('table_id', table.id).order('created_at', { ascending: false }),
    ]).then(([{ data: its }, { data: fls }]) => {
      setItems((its ?? []) as PriceItem[]);
      setFiles((fls ?? []) as PriceFile[]);
      setLoadingContent(false);
    });
  }, [selectedUf, tables]);

  // ── get-or-create table for UF ─────────────────────────────────────────
  async function getOrCreateTableForUf(uf: string): Promise<PriceTable | null> {
    if (!operatorId) return null;
    const existing = tables.find((t) => t.state === uf);
    if (existing) return existing;
    const { data, error } = await supabase
      .from('operator_price_tables')
      .insert({
        operator_id: operatorId,
        name: `Tabela ${uf}`,
        state: uf,
        valid_from: new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();
    if (error) { toast.error('Erro ao criar tabela: ' + error.message); return null; }
    const created = data as PriceTable;
    setTables((prev) => [created, ...prev]);
    return created;
  }

  // ── toggle active state ────────────────────────────────────────────────
  async function toggleActiveState(uf: string) {
    if (!operatorId) return;
    const next = activeStates.includes(uf)
      ? activeStates.filter((s) => s !== uf)
      : [...activeStates, uf];
    setSavingStates(true);
    const { error } = await supabase
      .from('insurance_operators')
      .update({ active_states: next })
      .eq('id', operatorId);
    setSavingStates(false);
    if (error) { toast.error(error.message); return; }
    setActiveStates(next);
  }

  // ── inline update item ─────────────────────────────────────────────────
  async function updateItemField(id: string, patch: Partial<PriceItem>) {
    const prev = items;
    setItems((cur) => cur.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    const { error } = await supabase.from('operator_price_items').update(patch).eq('id', id);
    if (error) {
      toast.error('Falha ao salvar: ' + error.message);
      setItems(prev);
    }
  }

  // ── create item ────────────────────────────────────────────────────────
  async function handleCreateItem() {
    if (!selectedUf) return;
    const table = await getOrCreateTableForUf(selectedUf);
    if (!table) return;
    if (!newItem.procedure_name.trim()) return toast.error('Informe o nome do procedimento');
    setSavingItem(true);
    const { data, error } = await supabase
      .from('operator_price_items')
      .insert({
        table_id: table.id,
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
      })
      .select()
      .single();
    setSavingItem(false);
    if (error) return toast.error('Erro ao salvar: ' + error.message);
    setItems((prev) => [...prev, data as PriceItem]);
    setTableCounts((c) => ({ ...c, [selectedUf]: (c[selectedUf] ?? 0) + 1 }));
    setShowNewItem(false);
    setNewItem({ ...BLANK_ITEM });
    setPlanInput('');
    toast.success('Procedimento adicionado');
  }

  async function handleDeleteItem(id: string) {
    const prev = items;
    setItems((cur) => cur.filter((i) => i.id !== id));
    const { error } = await supabase.from('operator_price_items').delete().eq('id', id);
    if (error) { toast.error(error.message); setItems(prev); return; }
    if (selectedUf) setTableCounts((c) => ({ ...c, [selectedUf]: Math.max(0, (c[selectedUf] ?? 1) - 1) }));
  }

  // ── upload + AI parse ──────────────────────────────────────────────────
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedUf || !operatorId) return;
    if (file.size > 20 * 1024 * 1024) { toast.error('Arquivo acima de 20 MB'); return; }

    setUploadStage('reading');
    const table = await getOrCreateTableForUf(selectedUf);
    if (!table) { setUploadStage(null); return; }

    // upload original to private bucket
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
    const path = `operators/${operatorId}/${table.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('operator-price-files').upload(path, file, { upsert: false });
    if (upErr) { toast.error('Upload falhou: ' + upErr.message); setUploadStage(null); return; }

    const { data: fileRec } = await supabase
      .from('operator_price_files')
      .insert({
        table_id: table.id,
        file_name: file.name,
        file_url: path,
        file_type: file.type || null,
        file_size: file.size,
      })
      .select()
      .single();
    if (fileRec) setFiles((prev) => [fileRec as PriceFile, ...prev]);

    setUploadStage('ai');
    try {
      const { data, error } = await supabase.functions.invoke('parse-price-table', {
        body: {
          table_id: table.id,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type,
        },
      });
      if (error) {
        const detail = (data as any)?.error || (data as any)?.detail || error.message;
        throw new Error(detail);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      const inserted = (data as any)?.inserted ?? 0;
      setUploadStage('saving');
      const { data: refreshed } = await supabase
        .from('operator_price_items').select('*').eq('table_id', table.id)
        .order('category').order('sort_order').order('procedure_name');
      setItems((refreshed ?? []) as PriceItem[]);
      setTableCounts((c) => ({ ...c, [selectedUf]: (refreshed ?? []).length }));
      toast.success(`${inserted} procedimento${inserted === 1 ? '' : 's'} importado${inserted === 1 ? '' : 's'}`);
    } catch (err: any) {
      toast.error('Falha na leitura por IA: ' + (err?.message ?? 'erro'));
    } finally {
      setUploadStage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDeleteFile(id: string, path: string) {
    const { error } = await supabase.from('operator_price_files').delete().eq('id', id);
    if (error) return toast.error(error.message);
    await supabase.storage.from('operator-price-files').remove([path]).catch(() => {});
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  async function handleDownloadFile(f: PriceFile) {
    const { data, error } = await supabase.storage
      .from('operator-price-files').createSignedUrl(f.file_url, 60, { download: f.file_name });
    if (error || !data?.signedUrl) { toast.error('Não foi possível gerar link'); return; }
    window.open(data.signedUrl, '_blank');
  }

  // ── filter ─────────────────────────────────────────────────────────────
  const filteredItems = items.filter((it) => {
    const q = search.toLowerCase();
    const matchQ = !q || it.procedure_name.toLowerCase().includes(q) || (it.tuss_code ?? '').toLowerCase().includes(q);
    const matchCat = filterCategory === '__all__' || it.category === filterCategory;
    return matchQ && matchCat;
  });
  const categories = [...new Set(items.map((i) => i.category))].sort();
  const inactiveStates = BRAZIL_STATES.filter((s) => !activeStates.includes(s.uf));

  // ── render ─────────────────────────────────────────────────────────────
  if (loadingTables) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // ─── state-detail view ────────────────────────────────────────────────
  if (selectedUf) {
    const table = tables.find((t) => t.state === selectedUf);
    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedUf(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm h-7 w-9">{selectedUf}</span>
                <h1 className="text-xl font-bold tracking-tight">{stateName(selectedUf)}</h1>
                {table?.valid_from && (
                  <Badge variant="outline" className="text-[11px]">Vigência {fmtDate(table.valid_from)}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {items.length} procedimento{items.length === 1 ? '' : 's'} cadastrado{items.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.csv,.ods"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={!!uploadStage}>
              {uploadStage ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {uploadStage === 'reading' ? 'Lendo arquivo…' : uploadStage === 'ai' ? 'Interpretando com IA…' : uploadStage === 'saving' ? 'Salvando…' : 'Importar arquivo'}
            </Button>
            <Button size="sm" onClick={() => setShowNewItem(true)}>
              <FilePlus2 className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>
        </div>

        <Tabs defaultValue="procedimentos">
          <TabsList>
            <TabsTrigger value="procedimentos">
              Procedimentos
              <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-4">{items.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="arquivos">
              Arquivos importados
              {files.length > 0 && <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-4">{files.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="procedimentos" className="space-y-4 mt-4">
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
                <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas as categorias</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              {(search || filterCategory !== '__all__') && (
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => { setSearch(''); setFilterCategory('__all__'); }}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {loadingContent ? (
              <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : filteredItems.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center py-10 gap-3">
                  <Table2 className="h-7 w-7 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    {items.length === 0 ? 'Nenhum procedimento neste estado' : 'Nenhum resultado'}
                  </p>
                  {items.length === 0 && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Sparkles className="h-4 w-4 mr-1" /> Importar planilha/PDF
                      </Button>
                      <Button size="sm" onClick={() => setShowNewItem(true)}>
                        <Plus className="h-4 w-4 mr-1" /> Adicionar manual
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-xs">Procedimento</TableHead>
                      <TableHead className="text-xs w-32">Cód. TUSS</TableHead>
                      <TableHead className="text-xs w-32">Cobrança</TableHead>
                      <TableHead className="text-xs w-28 text-right">Valor base (US)</TableHead>
                      <TableHead className="text-xs w-32 text-right">Valor R$</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id} className="text-sm">
                        <TableCell className="font-medium leading-tight">
                          <InlineText
                            value={item.procedure_name}
                            onCommit={(v) => updateItemField(item.id, { procedure_name: v })}
                            className="font-medium"
                          />
                          <Badge variant="outline" className="mt-1 text-[10px] px-1 py-0">{item.category}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <InlineText
                            value={item.tuss_code ?? ''}
                            placeholder="—"
                            onCommit={(v) => updateItemField(item.id, { tuss_code: v.trim() || null })}
                          />
                        </TableCell>
                        <TableCell className="text-xs">
                          <Select
                            value={item.charge_type}
                            onValueChange={(v) => updateItemField(item.id, { charge_type: v })}
                          >
                            <SelectTrigger className="h-7 text-xs border-transparent hover:border-input shadow-none px-2"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {CHARGE_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          <InlineNumber
                            value={item.value_us}
                            onCommit={(v) => updateItemField(item.id, { value_us: v })}
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-xs">
                          <InlineNumber
                            value={item.value_brl}
                            onCommit={(v) => updateItemField(item.id, { value_brl: v })}
                            highlight
                          />
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

          <TabsContent value="arquivos" className="space-y-3 mt-4">
            <Card className="border-dashed cursor-pointer hover:border-primary/60 transition-colors"
              onClick={() => fileInputRef.current?.click()}>
              <CardContent className="flex flex-col items-center py-8 gap-2">
                {uploadStage ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Upload className="h-6 w-6 text-muted-foreground/60" />}
                <p className="text-sm font-medium">
                  {uploadStage === 'reading' ? 'Lendo arquivo…' :
                   uploadStage === 'ai' ? 'Interpretando com IA…' :
                   uploadStage === 'saving' ? 'Salvando procedimentos…' :
                   'Clique para enviar planilha ou PDF'}
                </p>
                <p className="text-xs text-muted-foreground">
                  A IA lê o conteúdo e preenche a tabela automaticamente. PDF, XLSX, XLS, CSV — até 20 MB.
                </p>
              </CardContent>
            </Card>

            {files.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum arquivo enviado ainda</p>
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
                        <p className="text-xs text-muted-foreground">{fmtSize(f.file_size)} · {fmtDate(f.created_at)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDownloadFile(f)}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Baixar"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFile(f.id, f.file_url)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* New Item Dialog */}
        <NewItemDialog
          open={showNewItem}
          onOpenChange={setShowNewItem}
          item={newItem}
          setItem={setNewItem}
          planInput={planInput}
          setPlanInput={setPlanInput}
          saving={savingItem}
          onSave={handleCreateItem}
        />
      </div>
    );
  }

  // ─── overview: grid of states ─────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tabela de Valores por Estado</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Selecione os estados onde a operadora atua. Cada UF tem sua própria tabela de procedimentos e valores.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowAddState(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar estado
        </Button>
      </div>

      {/* Active states grid */}
      {activeStates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12 gap-4">
            <div className="rounded-full bg-primary/10 p-4"><MapPin className="h-7 w-7 text-primary" /></div>
            <div className="text-center">
              <p className="font-semibold">Nenhum estado ativo</p>
              <p className="text-sm text-muted-foreground mt-1">Adicione um ou mais estados para começar a cadastrar tabelas.</p>
            </div>
            <Button onClick={() => setShowAddState(true)}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar estados
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {activeStates.map((uf) => {
            const count = tableCounts[uf] ?? 0;
            return (
              <button
                key={uf}
                onClick={() => setSelectedUf(uf)}
                className="group relative rounded-xl border bg-card p-4 text-left hover:border-primary hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <span className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-base h-9 w-12">{uf}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleActiveState(uf); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive transition-opacity"
                    title="Remover estado"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-2 text-sm font-medium leading-tight">{stateName(uf)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {count} procedimento{count === 1 ? '' : 's'}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Inactive states (collapsed) */}
      {inactiveStates.length > 0 && (
        <Collapsible open={showOthers} onOpenChange={setShowOthers}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              {showOthers ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
              Ver outros estados ({inactiveStates.length})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2">
              {inactiveStates.map((s) => (
                <button
                  key={s.uf}
                  onClick={() => toggleActiveState(s.uf)}
                  disabled={savingStates}
                  className="rounded-md border border-dashed bg-muted/30 p-2 text-center hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                  title={s.name}
                >
                  <div className="text-xs font-semibold">{s.uf}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{s.name}</div>
                </button>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Add state dialog */}
      <Dialog open={showAddState} onOpenChange={setShowAddState}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Estados de atuação</DialogTitle>
            <DialogDescription>
              Selecione os estados onde a operadora possui rede credenciada e tabela de valores.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-[60vh] overflow-y-auto p-1">
            {BRAZIL_STATES.map((s) => {
              const active = activeStates.includes(s.uf);
              return (
                <button
                  key={s.uf}
                  onClick={() => toggleActiveState(s.uf)}
                  disabled={savingStates}
                  className={`relative rounded-lg border p-2 text-center transition-colors ${
                    active ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                  }`}
                >
                  {active && <Check className="absolute top-1 right-1 h-3 w-3 text-primary" />}
                  <div className="text-sm font-bold">{s.uf}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{s.name}</div>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowAddState(false)}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Inline editors ──────────────────────────────────────────────────────
function InlineText({ value, placeholder, onCommit, className }: { value: string; placeholder?: string; onCommit: (v: string) => void; className?: string; }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`w-full text-left rounded px-1 -mx-1 hover:bg-muted/60 truncate ${className ?? ''}`}
      >
        {value || <span className="text-muted-foreground">{placeholder ?? '—'}</span>}
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { setEditing(false); if (v !== value) onCommit(v); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') { setV(value); setEditing(false); }
      }}
      className="w-full bg-background border border-primary rounded px-1.5 py-0.5 text-sm outline-none"
    />
  );
}

function InlineNumber({ value, onCommit, highlight }: { value: number | null; onCommit: (v: number | null) => void; highlight?: boolean; }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value == null ? '' : String(value));
  useEffect(() => setV(value == null ? '' : String(value)), [value]);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`w-full text-right rounded px-1 -mx-1 hover:bg-muted/60 ${highlight ? 'font-semibold' : ''}`}
      >
        {fmtBRL(value)}
      </button>
    );
  }
  return (
    <input
      autoFocus
      type="number"
      step="0.01"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const parsed = v.trim() === '' ? null : Number(v.replace(',', '.'));
        if ((parsed ?? null) !== value) onCommit(Number.isFinite(parsed as number) ? (parsed as number) : null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') { setV(value == null ? '' : String(value)); setEditing(false); }
      }}
      className="w-full bg-background border border-primary rounded px-1.5 py-0.5 text-sm text-right outline-none"
    />
  );
}

// ── New Item Dialog (extracted) ────────────────────────────────────────
function NewItemDialog({
  open, onOpenChange, item, setItem, planInput, setPlanInput, saving, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: typeof BLANK_ITEM;
  setItem: React.Dispatch<React.SetStateAction<typeof BLANK_ITEM>>;
  planInput: string;
  setPlanInput: (v: string) => void;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Procedimento</DialogTitle>
          <DialogDescription>Preencha os dados do procedimento conforme a tabela.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome do procedimento *</Label>
            <Input
              placeholder="Ex.: Consulta odontológica inicial"
              value={item.procedure_name}
              onChange={(e) => setItem((p) => ({ ...p, procedure_name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Código TUSS</Label>
              <Input
                placeholder="Ex.: 81000014"
                value={item.tuss_code ?? ''}
                onChange={(e) => setItem((p) => ({ ...p, tuss_code: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={item.category} onValueChange={(v) => setItem((p) => ({ ...p, category: v }))}>
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
              <Select value={item.charge_type} onValueChange={(v) => setItem((p) => ({ ...p, charge_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHARGE_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor R$</Label>
              <Input
                type="number" min={0} step="0.01" placeholder="0,00"
                value={item.value_brl ?? ''}
                onChange={(e) => setItem((p) => ({ ...p, value_brl: e.target.value ? parseFloat(e.target.value) : null }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor base US/UCO</Label>
              <Input
                type="number" min={0} step="0.01" placeholder="0,00"
                value={item.value_us ?? ''}
                onChange={(e) => setItem((p) => ({ ...p, value_us: e.target.value ? parseFloat(e.target.value) : null }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Longevidade</Label>
              <Input
                placeholder="Ex.: 24 meses"
                value={item.longevity ?? ''}
                onChange={(e) => setItem((p) => ({ ...p, longevity: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch id="rx-new" checked={item.rx_required} onCheckedChange={(v) => setItem((p) => ({ ...p, rx_required: v }))} />
              <Label htmlFor="rx-new" className="cursor-pointer">Exige RX</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="foto-new" checked={item.photo_required} onCheckedChange={(v) => setItem((p) => ({ ...p, photo_required: v }))} />
              <Label htmlFor="foto-new" className="cursor-pointer">Exige foto</Label>
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
                    if (!item.plan_coverage.includes(p)) {
                      setItem((prev) => ({ ...prev, plan_coverage: [...prev.plan_coverage, p] }));
                    }
                    setPlanInput('');
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => {
                const p = planInput.trim();
                if (p && !item.plan_coverage.includes(p)) {
                  setItem((prev) => ({ ...prev, plan_coverage: [...prev.plan_coverage, p] }));
                  setPlanInput('');
                }
              }}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {item.plan_coverage.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {item.plan_coverage.map((p) => (
                  <Badge key={p} variant="secondary" className="gap-1 cursor-pointer"
                    onClick={() => setItem((prev) => ({ ...prev, plan_coverage: prev.plan_coverage.filter((x) => x !== p) }))}>
                    {p} <X className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}
            {item.plan_coverage.length === 0 && (
              <p className="text-xs text-muted-foreground">Deixe vazio para cobrir todos os planos</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Observações / diretrizes</Label>
            <Textarea
              placeholder="Diretrizes, longevidade, restrições..."
              rows={2}
              value={item.observations ?? ''}
              onChange={(e) => setItem((p) => ({ ...p, observations: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
