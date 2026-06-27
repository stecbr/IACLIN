import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { HeartPulse, Search, CheckCircle2, XCircle, Clock, Mail, Phone, User as UserIcon, Hash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { OperatorApprovalDialog } from '@/components/superadmin/OperatorApprovalDialog';

// ── Tipos ────────────────────────────────────────────────────
interface PlatformOperator {
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
  created_at: string;
  approval_status?: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  reviewed_at?: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  medico: 'Médico',
  odonto: 'Odontológico',
  ambos:  'Médico + Odonto',
};

const TYPE_COLORS: Record<string, string> = {
  medico: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300',
  odonto: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300',
  ambos:  'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-950 dark:text-violet-300',
};

const APPROVAL_BADGE: Record<string, { label: string; cls: string; icon: any }> = {
  pending:  { label: 'Em análise', cls: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300', icon: Clock },
  approved: { label: 'Aprovada',   cls: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300', icon: CheckCircle2 },
  rejected: { label: 'Recusada',   cls: 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300', icon: XCircle },
};

// ── Busca ────────────────────────────────────────────────────
async function fetchOperators(): Promise<PlatformOperator[]> {
  const { data, error } = await (supabase as any).rpc('admin_get_operators');
  if (error) {
    console.error('[SuperAdmin] admin_get_operators error:', error.message, error.code);
    throw error;
  }
  return Array.isArray(data) ? data : [];
}

// ── Componente ───────────────────────────────────────────────
export default function SuperAdminOperators() {
  const [search,     setSearch]     = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterApproval, setFilterApproval] = useState<string>('pending');
  const [selected, setSelected] = useState<PlatformOperator | null>(null);

  const { data: operators = [], isLoading, error } = useQuery({
    queryKey: ['platform-operators'],
    queryFn: fetchOperators,
    retry: 1,
  });

  const filtered = operators.filter(op => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      op.name.toLowerCase().includes(q) ||
      (op.legal_name ?? '').toLowerCase().includes(q) ||
      (op.cnpj ?? '').includes(q) ||
      (op.ans_code ?? '').toLowerCase().includes(q) ||
      (op.contact_email ?? '').toLowerCase().includes(q);

    const matchType   = filterType === 'all'   || op.type === filterType;
    const matchApproval =
      filterApproval === 'all' || (op.approval_status ?? 'pending') === filterApproval;

    return matchSearch && matchType && matchApproval;
  });

  const pendingCount  = operators.filter(o => (o.approval_status ?? 'pending') === 'pending').length;
  const approvedCount = operators.filter(o => o.approval_status === 'approved').length;
  const rejectedCount = operators.filter(o => o.approval_status === 'rejected').length;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <HeartPulse className="h-6 w-6 text-rose-500" />
          Operadoras de Saúde
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {operators.length} operadora{operators.length !== 1 ? 's' : ''} cadastrada{operators.length !== 1 ? 's' : ''} na plataforma
        </p>
      </div>

      {pendingCount > 0 && filterApproval !== 'pending' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              {pendingCount} operadora{pendingCount !== 1 ? 's' : ''} aguardando aprovação
            </p>
            <p className="text-amber-700/80 dark:text-amber-300/80 text-xs">
              Vá para a aba "Em análise" para revisar e aprovar ou recusar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFilterApproval('pending')}
            className="text-xs font-medium text-amber-700 dark:text-amber-300 underline hover:no-underline"
          >
            Abrir
          </button>
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4 text-sm text-red-700 dark:text-red-300">
          <strong>Erro ao carregar operadoras:</strong>{' '}
          {(error as any)?.message ?? 'Execute o SQL de permissões no Supabase.'}
        </div>
      )}

      {/* Tabs de status */}
      <Tabs value={filterApproval} onValueChange={setFilterApproval}>
        <TabsList className="grid grid-cols-3 w-full sm:w-auto sm:inline-grid">
          <TabsTrigger value="pending" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Em análise</span>
            <span className="sm:hidden">Análise</span>
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{pendingCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Aprovadas
            {approvedCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{approvedCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-1.5">
            <XCircle className="h-3.5 w-3.5" />
            Recusadas
            {rejectedCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{rejectedCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, CNPJ, código ANS ou e-mail..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="medico">Médico</SelectItem>
            <SelectItem value="odonto">Odontológico</SelectItem>
            <SelectItem value="ambos">Médico + Odonto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid de cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm rounded-lg border border-dashed">
          Nenhuma operadora encontrada.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(op => {
            const approval = APPROVAL_BADGE[op.approval_status ?? 'pending'];
            const ApprovalIcon = approval.icon;
            return (
              <button
                key={op.id}
                type="button"
                onClick={() => setSelected(op)}
                className="text-left rounded-lg border bg-card hover:bg-muted/30 hover:border-foreground/20 transition-colors p-4 flex flex-col gap-3 min-w-0"
              >
                {/* Header */}
                <div className="flex items-start gap-3 min-w-0">
                  {op.logo_url ? (
                    <img
                      src={op.logo_url}
                      alt={op.name}
                      className="h-10 w-10 rounded object-contain border bg-white p-0.5 shrink-0"
                    />
                  ) : (
                    <div
                      className="h-10 w-10 rounded flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: op.brand_color ?? '#6366f1' }}
                    >
                      {op.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{op.name}</p>
                    {op.legal_name && op.legal_name !== op.name && (
                      <p className="text-xs text-muted-foreground truncate">{op.legal_name}</p>
                    )}
                    {op.cnpj && (
                      <p className="text-[11px] text-muted-foreground font-mono truncate">{op.cnpj}</p>
                    )}
                  </div>
                  <Badge variant="outline" className={`${approval.cls} gap-1 shrink-0`}>
                    <ApprovalIcon className="h-3 w-3" />
                    <span className="hidden sm:inline">{approval.label}</span>
                  </Badge>
                </div>

                {/* Badges tipo + ANS */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className={`${TYPE_COLORS[op.type] ?? ''} text-xs`}>
                    {TYPE_LABELS[op.type] ?? op.type}
                  </Badge>
                  {op.ans_code && (
                    <Badge variant="outline" className="text-xs gap-1 font-mono">
                      <Hash className="h-3 w-3" /> {op.ans_code}
                    </Badge>
                  )}
                </div>

                {/* Contato */}
                <div className="text-xs text-muted-foreground space-y-1 min-w-0">
                  {op.contact_email && (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{op.contact_email}</span>
                    </div>
                  )}
                  {op.contact_phone && (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span className="truncate">{op.contact_phone}</span>
                    </div>
                  )}
                  {op.responsible_name && (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <UserIcon className="h-3 w-3 shrink-0" />
                      <span className="truncate italic">{op.responsible_name}</span>
                    </div>
                  )}
                </div>

                {/* Rodapé */}
                <div className="pt-2 border-t text-[10px] text-muted-foreground flex justify-between">
                  <span>Cadastro</span>
                  <span>{format(new Date(op.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <OperatorApprovalDialog
        operator={selected}
        onOpenChange={(open) => { if (!open) setSelected(null); }}
      />
    </div>
  );
}
