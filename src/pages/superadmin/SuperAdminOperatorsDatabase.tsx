import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Database,
  Plus,
  Search,
  Pencil,
  Trash2,
  Hash,
  Package,
  ChevronLeft,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import iaclinLogo from '@/assets/logo-iaclin.png';

// ── Tipos ───────────────────────────────────────────────────────
interface Operator {
  id: string;
  name: string;
  legal_name: string | null;
  cnpj: string | null;
  ans_code: string | null;
  type: 'medico' | 'odonto' | 'ambos';
  contact_email: string | null;
  contact_phone: string | null;
  responsible_name: string | null;
  logo_url: string | null;
  brand_color: string | null;
  is_active: boolean;
  owner_id: string | null;
  approval_status?: string;
  brand_group: string | null;
}

interface CatalogPlan {
  id: string;
  operator_id: string | null;
  operator_name: string;
  plan_name: string;
  type: 'medico' | 'odonto' | 'ambos';
  ans_code: string | null;
  is_active: boolean;
  vigencia: string | null;
  contratacao: string | null;
  segmentacao_assistencial: string | null;
  cobertura: string | null;
  tipo_financiamento: string | null;
  abrangencia_cobertura: string | null;
  fator_moderador: string | null;
  acomodacao_hospitalar: string | null;
  livre_escolha: string | null;
  obstetricia: string | null;
  has_odontologico: boolean | null;
  situacao_plano: string | null;
  porte_operadora: string | null;
  dt_situacao: string | null;
  dt_registro_plano: string | null;
}

const CONTRATACAO_OPTIONS = ['Individual ou familiar', 'Coletivo empresarial', 'Coletivo por adesão'];
const COBERTURA_OPTIONS = ['Médico-hospitalar', 'Odontológica'];
const TIPO_FINANCIAMENTO_OPTIONS = ['Preestabelecido', 'Pós-estabelecido', 'Misto'];
const ABRANGENCIA_OPTIONS = ['Nacional', 'Grupo de estados', 'Estadual', 'Grupo de municípios', 'Municipal', 'Outras'];
const FATOR_MODERADOR_OPTIONS = ['Ausente', 'Coparticipação', 'Franquia', 'Franquia + Coparticipação'];
const ACOMODACAO_OPTIONS = ['Coletiva', 'Individual', 'Não se Aplica'];
const LIVRE_ESCOLHA_OPTIONS = ['Ausente', 'Total', 'Parcial com internação', 'Parcial sem internação'];
const OBSTETRICIA_OPTIONS = ['Com Obstetrícia', 'Sem Obstetrícia', 'Não se Aplica'];
const SITUACAO_PLANO_OPTIONS = ['Ativo', 'Suspenso', 'Cancelado', 'Transferido'];
const PORTE_OPTIONS = ['Pequeno', 'Médio', 'Grande'];
const VIGENCIA_OPTIONS: Record<string, string> = { A: 'Anterior à Lei 9.656/1998', P: 'Posterior à Lei 9.656/1998' };

// Colapsa espaços duplicados/sobrando para busca por substring não falhar
// com nomes vindos "sujos" da base da ANS (ex.: "UNIMED  FLORIANO").
const normSpace = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

const TYPE_LABELS: Record<string, string> = {
  medico: 'Médico',
  odonto: 'Odontológico',
  ambos: 'Médico + Odonto',
};
const TYPE_COLORS: Record<string, string> = {
  medico: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300',
  odonto: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300',
  ambos: 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-950 dark:text-violet-300',
};

// ── Página ──────────────────────────────────────────────────────
export default function SuperAdminOperatorsDatabase() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [selected, setSelected] = useState<Operator | null>(null);
  const [editing, setEditing] = useState<Operator | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<Operator | null>(null);

  const { data: operators = [], isLoading } = useQuery({
    queryKey: ['platform-operators-catalog'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('admin_get_all_operators');
      if (error) throw error;
      return (data ?? []) as Operator[];
    },
  });

  const brandGroups = useMemo(
    () => Array.from(new Set(operators.map((o) => o.brand_group).filter(Boolean))).sort() as string[],
    [operators],
  );

  const filtered = useMemo(() => {
    const q = normSpace(search);
    return operators.filter((o) => {
      const matchSearch =
        !q ||
        normSpace(o.name).includes(q) ||
        normSpace(o.legal_name ?? '').includes(q) ||
        (o.cnpj ?? '').includes(q) ||
        (o.ans_code ?? '').toLowerCase().includes(q) ||
        normSpace(o.brand_group ?? '').includes(q);
      const matchType = filterType === 'all' || o.type === filterType;
      const matchGroup = filterGroup === 'all' || o.brand_group === filterGroup;
      return matchSearch && matchType && matchGroup;
    });
  }, [operators, search, filterType, filterGroup]);

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc('admin_delete_operator', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Operadora excluída');
      qc.invalidateQueries({ queryKey: ['platform-operators-catalog'] });
      setToDelete(null);
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao excluir'),
  });

  if (selected) {
    return (
      <OperatorPlansView
        operator={selected}
        onBack={() => setSelected(null)}
        onEdit={() => setEditing(selected)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Banco de dados de operadoras
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {operators.length} operadora{operators.length !== 1 ? 's' : ''} no catálogo · cadastre operadoras e seus planos para vincular convênios em toda a plataforma.
          </p>
        </div>
        <Button onClick={() => setEditing('new')} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova operadora
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, CNPJ ou código ANS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="medico">Médico</SelectItem>
            <SelectItem value="odonto">Odontológico</SelectItem>
            <SelectItem value="ambos">Médico + Odonto</SelectItem>
          </SelectContent>
        </Select>
        {brandGroups.length > 0 && (
          <Select value={filterGroup} onValueChange={setFilterGroup}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Grupo/marca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os grupos</SelectItem>
              {brandGroups.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm rounded-lg border border-dashed">
          Nenhuma operadora encontrada.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((op) => (
            <div
              key={op.id}
              className="rounded-lg border bg-card hover:border-foreground/20 transition-colors p-4 flex flex-col gap-3 min-w-0"
            >
              <button
                type="button"
                onClick={() => setSelected(op)}
                className="text-left flex items-start gap-3 min-w-0"
              >
                <img
                  src={op.logo_url || iaclinLogo}
                  alt={op.name}
                  className="h-10 w-10 rounded object-contain border bg-white p-0.5 shrink-0"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = iaclinLogo;
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{op.name}</p>
                  {op.legal_name && op.legal_name !== op.name && (
                    <p className="text-xs text-muted-foreground truncate">{op.legal_name}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <Badge variant="outline" className={`${TYPE_COLORS[op.type]} text-[10px]`}>
                      {TYPE_LABELS[op.type]}
                    </Badge>
                    {op.ans_code && (
                      <Badge variant="outline" className="text-[10px] gap-1 font-mono">
                        <Hash className="h-3 w-3" /> {op.ans_code}
                      </Badge>
                    )}
                    {op.brand_group && (
                      <Badge variant="outline" className="text-[10px] bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300">
                        {op.brand_group}
                      </Badge>
                    )}
                    {op.owner_id && (
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300">
                        Com conta
                      </Badge>
                    )}
                  </div>
                </div>
              </button>

              <div className="flex items-center justify-between pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setSelected(op)}
                  className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                >
                  <Package className="h-3.5 w-3.5" /> Ver planos
                </button>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEditing(op)}
                    title="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setToDelete(op)}
                    title="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <OperatorFormDialog
        operator={editing === 'new' ? null : editing}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir operadora?</AlertDialogTitle>
            <AlertDialogDescription>
              A operadora <strong>{toDelete?.name}</strong> e seus planos do catálogo serão removidos. Convênios já cadastrados em clínicas continuarão existindo, mas ficarão sem vínculo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && deleteMut.mutate(toDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Form da operadora ───────────────────────────────────────────
function OperatorFormDialog({
  operator,
  open,
  onOpenChange,
}: {
  operator: Operator | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Operator>>({});

  // Reseta o form quando abrir
  useMemo(() => {
    if (open) {
      setForm(
        operator ?? {
          name: '',
          type: 'ambos',
          is_active: true,
        },
      );
    }
  }, [open, operator]);

  const saveMut = useMutation({
    mutationFn: async (payload: Partial<Operator>) => {
      const { data, error } = await (supabase as any).rpc('admin_upsert_operator', { payload });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(operator ? 'Operadora atualizada' : 'Operadora cadastrada');
      qc.invalidateQueries({ queryKey: ['platform-operators-catalog'] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao salvar'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) {
      toast.error('Informe o nome da operadora');
      return;
    }
    saveMut.mutate({ ...form, id: operator?.id });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{operator ? 'Editar operadora' : 'Nova operadora'}</DialogTitle>
          <DialogDescription>
            Operadoras cadastradas aqui ficam disponíveis para vincular convênios em toda a plataforma, mesmo sem conta própria no sistema.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Nome fantasia *</Label>
              <Input
                value={form.name ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex.: Amil"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Razão social</Label>
              <Input
                value={form.legal_name ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, legal_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input
                value={form.cnpj ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
              />
            </div>
            <div>
              <Label>Código ANS</Label>
              <Input
                value={form.ans_code ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, ans_code: e.target.value }))}
              />
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select
                value={form.type ?? 'ambos'}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="medico">Médico</SelectItem>
                  <SelectItem value="odonto">Odontológico</SelectItem>
                  <SelectItem value="ambos">Médico + Odonto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>E-mail de contato</Label>
              <Input
                type="email"
                value={form.contact_email ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={form.contact_phone ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Grupo/marca</Label>
              <Input
                value={form.brand_group ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, brand_group: e.target.value || null }))}
                placeholder="Ex.: Unimed, Uniodonto (deixe em branco se não fizer parte de um grupo)"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Drilldown: planos da operadora ───────────────────────────────
function OperatorPlansView({
  operator,
  onBack,
  onEdit,
}: {
  operator: Operator;
  onBack: () => void;
  onEdit: () => void;
}) {
  const qc = useQueryClient();
  const [planEditing, setPlanEditing] = useState<CatalogPlan | 'new' | null>(null);
  const [planToDelete, setPlanToDelete] = useState<CatalogPlan | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['operator-plans', operator.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('admin_get_operator_plans', {
        p_operator_id: operator.id,
      });
      if (error) throw error;
      return (data ?? []) as CatalogPlan[];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc('admin_delete_catalog_plan', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Plano removido');
      qc.invalidateQueries({ queryKey: ['operator-plans', operator.id] });
      setPlanToDelete(null);
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao excluir'),
  });

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ChevronLeft className="h-4 w-4" /> Voltar
      </button>

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <img
            src={operator.logo_url || iaclinLogo}
            alt={operator.name}
            className="h-12 w-12 rounded object-contain border bg-white p-0.5 shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = iaclinLogo;
            }}
          />
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{operator.name}</h1>
            <div className="flex flex-wrap gap-1 mt-1">
              <Badge variant="outline" className={`${TYPE_COLORS[operator.type]} text-xs`}>
                {TYPE_LABELS[operator.type]}
              </Badge>
              {operator.ans_code && (
                <Badge variant="outline" className="text-xs gap-1 font-mono">
                  <Hash className="h-3 w-3" /> {operator.ans_code}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit} className="gap-2">
          <Pencil className="h-3.5 w-3.5" /> Editar operadora
        </Button>
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <div>
          <h2 className="text-base font-semibold">Planos / convênios</h2>
          <p className="text-xs text-muted-foreground">
            {plans.length} plano{plans.length !== 1 ? 's' : ''} no catálogo desta operadora
          </p>
        </div>
        <Button size="sm" onClick={() => setPlanEditing('new')} className="gap-2">
          <Plus className="h-4 w-4" /> Novo plano
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground rounded-lg border border-dashed">
          Nenhum plano cadastrado.
        </div>
      ) : (
        <div className="space-y-2">
          {plans.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{p.plan_name}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Badge variant="outline" className={`${TYPE_COLORS[p.type]} text-[10px]`}>
                    {TYPE_LABELS[p.type]}
                  </Badge>
                  {p.ans_code && (
                    <Badge variant="outline" className="text-[10px] gap-1 font-mono">
                      <Hash className="h-3 w-3" /> {p.ans_code}
                    </Badge>
                  )}
                  {p.contratacao && (
                    <Badge variant="outline" className="text-[10px]">{p.contratacao}</Badge>
                  )}
                  {p.abrangencia_cobertura && (
                    <Badge variant="outline" className="text-[10px]">{p.abrangencia_cobertura}</Badge>
                  )}
                  {p.situacao_plano && p.situacao_plano !== 'Ativo' && (
                    <Badge variant="outline" className="text-[10px]">{p.situacao_plano}</Badge>
                  )}
                  {!p.is_active && (
                    <Badge variant="outline" className="text-[10px]">Inativo</Badge>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPlanEditing(p)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setPlanToDelete(p)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <CatalogPlanFormDialog
        operatorId={operator.id}
        operatorType={operator.type}
        plan={planEditing === 'new' ? null : planEditing}
        open={planEditing !== null}
        onOpenChange={(o) => !o && setPlanEditing(null)}
      />

      <AlertDialog open={!!planToDelete} onOpenChange={(o) => !o && setPlanToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano?</AlertDialogTitle>
            <AlertDialogDescription>
              O plano <strong>{planToDelete?.plan_name}</strong> será removido do catálogo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => planToDelete && deleteMut.mutate(planToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CatalogPlanFormDialog({
  operatorId,
  operatorType,
  plan,
  open,
  onOpenChange,
}: {
  operatorId: string;
  operatorType: Operator['type'];
  plan: CatalogPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<CatalogPlan>>({});

  useMemo(() => {
    if (open) {
      setForm(
        plan ?? {
          plan_name: '',
          type: operatorType,
          is_active: true,
        },
      );
    }
  }, [open, plan, operatorType]);

  const saveMut = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await (supabase as any).rpc('admin_upsert_catalog_plan', { payload });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(plan ? 'Plano atualizado' : 'Plano cadastrado');
      qc.invalidateQueries({ queryKey: ['operator-plans', operatorId] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao salvar'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.plan_name?.trim()) {
      toast.error('Informe o nome do plano');
      return;
    }
    saveMut.mutate({
      id: plan?.id,
      operator_id: operatorId,
      plan_name: form.plan_name,
      type: form.type ?? operatorType,
      ans_code: form.ans_code ?? null,
      is_active: form.is_active ?? true,
      vigencia: form.vigencia ?? null,
      contratacao: form.contratacao ?? null,
      segmentacao_assistencial: form.segmentacao_assistencial ?? null,
      cobertura: form.cobertura ?? null,
      tipo_financiamento: form.tipo_financiamento ?? null,
      abrangencia_cobertura: form.abrangencia_cobertura ?? null,
      fator_moderador: form.fator_moderador ?? null,
      acomodacao_hospitalar: form.acomodacao_hospitalar ?? null,
      livre_escolha: form.livre_escolha ?? null,
      obstetricia: form.obstetricia ?? null,
      has_odontologico: form.has_odontologico ?? false,
      situacao_plano: form.situacao_plano ?? null,
      porte_operadora: form.porte_operadora ?? null,
      dt_situacao: form.dt_situacao ?? null,
      dt_registro_plano: form.dt_registro_plano ?? null,
    });
  };

  const selectField = (
    label: string,
    key: keyof CatalogPlan,
    options: string[],
  ) => (
    <div>
      <Label>{label}</Label>
      <Select
        value={(form[key] as string) ?? '__none'}
        onValueChange={(v) => setForm((f) => ({ ...f, [key]: v === '__none' ? null : v }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Não informado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">Não informado</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? 'Editar plano' : 'Novo plano'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome do plano *</Label>
            <Input
              value={form.plan_name ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, plan_name: e.target.value }))}
              placeholder="Ex.: Amil 400"
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select
                value={form.type ?? operatorType}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="medico">Médico</SelectItem>
                  <SelectItem value="odonto">Odontológico</SelectItem>
                  <SelectItem value="ambos">Médico + Odonto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Código ANS</Label>
              <Input
                value={form.ans_code ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, ans_code: e.target.value }))}
              />
            </div>
            {selectField('Vigência', 'vigencia', Object.keys(VIGENCIA_OPTIONS))}
          </div>

          <div className="border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Características do produto (ANS)</p>
            <div className="grid grid-cols-2 gap-3">
              {selectField('Contratação', 'contratacao', CONTRATACAO_OPTIONS)}
              {selectField('Cobertura', 'cobertura', COBERTURA_OPTIONS)}
              {selectField('Financiamento', 'tipo_financiamento', TIPO_FINANCIAMENTO_OPTIONS)}
              {selectField('Abrangência', 'abrangencia_cobertura', ABRANGENCIA_OPTIONS)}
              {selectField('Fator moderador', 'fator_moderador', FATOR_MODERADOR_OPTIONS)}
              {selectField('Acomodação hospitalar', 'acomodacao_hospitalar', ACOMODACAO_OPTIONS)}
              {selectField('Livre escolha', 'livre_escolha', LIVRE_ESCOLHA_OPTIONS)}
              {selectField('Obstetrícia', 'obstetricia', OBSTETRICIA_OPTIONS)}
              {selectField('Porte da operadora', 'porte_operadora', PORTE_OPTIONS)}
              {selectField('Situação do plano', 'situacao_plano', SITUACAO_PLANO_OPTIONS)}
              <div>
                <Label>Segmentação assistencial</Label>
                <Input
                  value={form.segmentacao_assistencial ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, segmentacao_assistencial: e.target.value }))}
                  placeholder="Ex.: Ambulatorial + Hospitalar com obstetrícia"
                />
              </div>
              <div className="flex items-end pb-1.5">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.has_odontologico ?? false}
                    onChange={(e) => setForm((f) => ({ ...f, has_odontologico: e.target.checked }))}
                    className="h-4 w-4 rounded border-input"
                  />
                  Inclui cobertura odontológica
                </label>
              </div>
              <div>
                <Label>Data da situação</Label>
                <Input
                  type="date"
                  value={form.dt_situacao ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, dt_situacao: e.target.value || null }))}
                />
              </div>
              <div>
                <Label>Data de registro na ANS</Label>
                <Input
                  type="date"
                  value={form.dt_registro_plano ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, dt_registro_plano: e.target.value || null }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}