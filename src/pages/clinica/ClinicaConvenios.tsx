import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Search, Receipt, Building2, MapPin, CalendarDays, Camera, FileImage,
  Eye, Loader2, ChevronDown, ChevronRight, Info, FileText, Download,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PriceFileViewerDialog, type PriceFileLike } from '@/components/operadora/PriceFileViewerDialog';

// ── Types ────────────────────────────────────────────────────────────────
interface OperatorOption {
  id: string;
  name: string;
  logo_url: string | null;
  brand_color: string | null;
}
interface PriceTable {
  id: string;
  name: string;
  region: string | null;
  state: string | null;
  city: string | null;
  valid_from: string;
  valid_until: string | null;
}
interface PriceItem {
  id: string;
  category: string;
  procedure_name: string;
  tuss_code: string | null;
  charge_type: string;
  value_brl: number | null;
  value_us: number | null;
  rx_required: boolean;
  photo_required: boolean;
  longevity: string | null;
  observations: string | null;
  plan_coverage: string[];
}
interface PriceFile {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

const brl = (n: number | null) =>
  n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const sb = supabase as any; // types não regenerados ainda

export default function ClinicaConvenios() {
  const { currentClinicId } = useAuth();

  const [operators, setOperators] = useState<OperatorOption[]>([]);
  const [tables, setTables] = useState<PriceTable[]>([]);
  const [items, setItems] = useState<PriceItem[]>([]);

  const [operatorId, setOperatorId] = useState<string | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);

  const [loadingOps, setLoadingOps] = useState(true);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<PriceItem | null>(null);
  const [files, setFiles] = useState<PriceFile[]>([]);
  const [previewFile, setPreviewFile] = useState<PriceFileLike | null>(null);

  // 1. Operadoras credenciadas
  useEffect(() => {
    if (!currentClinicId) {
      setOperators([]);
      setLoadingOps(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingOps(true);
      const { data, error } = await sb
        .from('operator_credentialings')
        .select('operator_id, status, insurance_operators:operator_id(id, name, logo_url, brand_color)')
        .eq('clinic_id', currentClinicId)
        .eq('status', 'approved');
      if (cancelled) return;
      if (error) {
        setOperators([]);
      } else {
        const list: OperatorOption[] = (data ?? [])
          .map((r: any) => r.insurance_operators)
          .filter(Boolean);
        // dedupe
        const dedup = Array.from(new Map(list.map((o) => [o.id, o])).values());
        setOperators(dedup);
        if (dedup.length && !operatorId) setOperatorId(dedup[0].id);
      }
      setLoadingOps(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentClinicId]);

  // 2. Tabelas da operadora selecionada
  useEffect(() => {
    if (!operatorId) {
      setTables([]);
      setTableId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingTables(true);
      const { data, error } = await sb
        .from('operator_price_tables')
        .select('id, name, region, state, city, valid_from, valid_until')
        .eq('operator_id', operatorId)
        .order('valid_from', { ascending: false });
      if (cancelled) return;
      if (error) {
        setTables([]);
        setTableId(null);
      } else {
        const list = (data ?? []) as PriceTable[];
        setTables(list);
        setTableId(list[0]?.id ?? null);
      }
      setLoadingTables(false);
    })();
    return () => { cancelled = true; };
  }, [operatorId]);

  // 3. Itens da tabela selecionada
  useEffect(() => {
    if (!tableId) {
      setItems([]);
      setFiles([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingItems(true);
      const { data, error } = await sb
        .from('operator_price_items')
        .select('id, category, procedure_name, tuss_code, charge_type, value_brl, value_us, rx_required, photo_required, longevity, observations, plan_coverage')
        .eq('table_id', tableId)
        .order('category', { ascending: true })
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      if (error) setItems([]);
      else setItems((data ?? []) as PriceItem[]);
      setLoadingItems(false);

      const { data: fileRows } = await sb
        .from('operator_price_files')
        .select('id, file_name, file_url, file_type, file_size, created_at')
        .eq('table_id', tableId)
        .order('created_at', { ascending: false });
      if (!cancelled) setFiles((fileRows ?? []) as PriceFile[]);
    })();
    return () => { cancelled = true; };
  }, [tableId]);

  async function downloadFile(f: PriceFile) {
    const { data } = await supabase.storage
      .from('operator-price-files').createSignedUrl(f.file_url, 120, { download: f.file_name });
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  function fmtSize(n: number | null) {
    if (!n) return '';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Filtragem
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter((it) => {
      if (categoryFilter && it.category !== categoryFilter) return false;
      if (!s) return true;
      return (
        it.procedure_name.toLowerCase().includes(s) ||
        (it.tuss_code ?? '').toLowerCase().includes(s)
      );
    });
  }, [items, search, categoryFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, PriceItem[]>();
    filtered.forEach((it) => {
      const k = it.category || 'Outros';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => set.add(it.category || 'Outros'));
    return Array.from(set).sort();
  }, [items]);

  const selectedOperator = operators.find((o) => o.id === operatorId) ?? null;
  const selectedTable = tables.find((t) => t.id === tableId) ?? null;

  // ── Render ──────────────────────────────────────────────────────────────

  if (loadingOps) {
    return (
      <div className="space-y-6">
        <PageHeader title="Convênios e Tabelas de Valores" description="Valores acordados com as operadoras credenciadas." />
        <Card><CardContent className="p-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>
      </div>
    );
  }

  if (operators.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Convênios e Tabelas de Valores" description="Valores acordados com as operadoras credenciadas." />
        <Card>
          <CardContent className="p-10 text-center space-y-2">
            <Receipt className="mx-auto h-10 w-10 text-muted-foreground/60" />
            <p className="text-sm font-medium">Sua clínica ainda não está credenciada com nenhuma operadora.</p>
            <p className="text-xs text-muted-foreground">As tabelas de valores aparecem aqui assim que um credenciamento for aprovado.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Convênios e Tabelas de Valores" description="Consulte os valores acordados com as operadoras credenciadas." />

      {/* Seletor operadora + tabela */}
      <Card>
        <CardContent className="p-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Operadora</label>
            <Select value={operatorId ?? ''} onValueChange={setOperatorId}>
              <SelectTrigger><SelectValue placeholder="Selecione a operadora" /></SelectTrigger>
              <SelectContent>
                {operators.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    <span className="flex items-center gap-2">
                      {op.logo_url
                        ? <img src={op.logo_url} alt="" className="h-4 w-4 rounded object-cover" />
                        : <Building2 className="h-4 w-4 text-muted-foreground" />}
                      {op.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tabela de valores</label>
            <Select value={tableId ?? ''} onValueChange={setTableId} disabled={!tables.length}>
              <SelectTrigger>
                <SelectValue placeholder={
                  loadingTables ? 'Carregando…' :
                  tables.length ? 'Selecione a tabela' : 'Nenhuma tabela disponível'
                } />
              </SelectTrigger>
              <SelectContent>
                {tables.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.region ? ` · ${t.region}` : ''}
                    {t.city ? ` · ${t.city}/${t.state ?? ''}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>

        {selectedTable && (
          <CardContent className="px-4 pb-4 pt-0 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />Vigência: {format(parseISO(selectedTable.valid_from), 'dd/MM/yyyy', { locale: ptBR })}
              {selectedTable.valid_until ? ` até ${format(parseISO(selectedTable.valid_until), 'dd/MM/yyyy', { locale: ptBR })}` : ' (sem prazo)'}
            </span>
            {selectedTable.region && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{selectedTable.region}</span>}
            {selectedOperator?.name && <Badge variant="secondary">{selectedOperator.name}</Badge>}
          </CardContent>
        )}
      </Card>

      {/* Busca + filtro de categoria */}
      {tableId && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar procedimento ou código TUSS…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <Badge
                  variant={categoryFilter == null ? 'default' : 'secondary'}
                  className="cursor-pointer"
                  onClick={() => setCategoryFilter(null)}
                >
                  Todas
                </Badge>
                {categories.map((c) => (
                  <Badge
                    key={c}
                    variant={categoryFilter === c ? 'default' : 'secondary'}
                    className="cursor-pointer"
                    onClick={() => setCategoryFilter(categoryFilter === c ? null : c)}
                  >
                    {c}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lista agrupada */}
      {loadingItems ? (
        <Card><CardContent className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>
      ) : !tableId ? null : grouped.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            {items.length === 0 ? 'Nenhum procedimento cadastrado nesta tabela.' : 'Nenhum procedimento corresponde aos filtros.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {grouped.map(([cat, list]) => {
            const isCollapsed = collapsed[cat];
            return (
              <Card key={cat} className="overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
                  onClick={() => setCollapsed((s) => ({ ...s, [cat]: !s[cat] }))}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {cat}
                  </span>
                  <Badge variant="secondary">{list.length}</Badge>
                </button>
                {!isCollapsed && (
                  <div className="divide-y">
                    {list.map((it) => (
                      <div key={it.id} className="px-4 py-3 grid gap-3 md:grid-cols-[1fr_auto] items-start">
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-sm">{it.procedure_name}</p>
                            {it.tuss_code && (
                              <span className="text-xs text-muted-foreground font-mono">TUSS {it.tuss_code}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <Badge variant="outline">{it.charge_type}</Badge>
                            {it.rx_required && (
                              <Badge variant="secondary" className="gap-1"><FileImage className="h-3 w-3" />RX</Badge>
                            )}
                            {it.photo_required && (
                              <Badge variant="secondary" className="gap-1"><Camera className="h-3 w-3" />Foto</Badge>
                            )}
                            {it.plan_coverage.slice(0, 4).map((p) => (
                              <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                            ))}
                            {it.plan_coverage.length > 4 && (
                              <span className="text-xs text-muted-foreground">+{it.plan_coverage.length - 4}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 md:justify-end">
                          <div className="text-right">
                            <p className="text-base font-semibold">{brl(it.value_brl)}</p>
                            {it.value_us != null && (
                              <p className="text-[10px] text-muted-foreground">US$ {it.value_us}</p>
                            )}
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => setDetail(it)} title="Detalhes">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog detalhes */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              {detail?.procedure_name}
            </DialogTitle>
            {detail?.tuss_code && (
              <DialogDescription className="font-mono">TUSS {detail.tuss_code}</DialogDescription>
            )}
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Valor R$</p>
                  <p className="font-semibold">{brl(detail.value_brl)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cobrança</p>
                  <p>{detail.charge_type}</p>
                </div>
                {detail.longevity && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Longevidade</p>
                    <p>{detail.longevity}</p>
                  </div>
                )}
              </div>
              {detail.plan_coverage.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Planos cobertos</p>
                  <div className="flex flex-wrap gap-1">
                    {detail.plan_coverage.map((p) => (
                      <Badge key={p} variant="outline">{p}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {detail.observations && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Observações</p>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{detail.observations}</p>
                </div>
              )}
              <div className="flex gap-2 text-xs">
                {detail.rx_required && <Badge variant="secondary" className="gap-1"><FileImage className="h-3 w-3" />Exige RX</Badge>}
                {detail.photo_required && <Badge variant="secondary" className="gap-1"><Camera className="h-3 w-3" />Exige foto</Badge>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Arquivos enviados pela operadora (somente leitura) */}
      {tableId && files.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Arquivos originais da operadora</p>
                <p className="text-xs text-muted-foreground">PDFs e planilhas enviados pela operadora. Somente leitura.</p>
              </div>
              <Badge variant="secondary">{files.length}</Badge>
            </div>
            <div className="space-y-2">
              {files.map((f) => (
                <div key={f.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                  <div className="rounded-md bg-primary/10 p-2 shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtSize(f.file_size)} · {format(parseISO(f.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewFile(f)}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                    title="Visualizar"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadFile(f)}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                    title="Baixar"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <PriceFileViewerDialog
        file={previewFile}
        open={!!previewFile}
        onOpenChange={(o) => { if (!o) setPreviewFile(null); }}
      />
    </div>
  );
}