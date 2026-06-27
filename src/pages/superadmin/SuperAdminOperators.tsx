import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { HeartPulse, Search, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  const [filterApproval, setFilterApproval] = useState<string>('all');
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
          {operators.length > 0 && (
            <span className="ml-2">
              {pendingCount > 0 && (
                <span className="text-amber-600 dark:text-amber-400">· {pendingCount} em análise </span>
              )}
              <span className="text-emerald-600 dark:text-emerald-400">· {approvedCount} aprovada{approvedCount !== 1 ? 's' : ''}</span>
              {rejectedCount > 0 && (
                <span className="text-rose-600 dark:text-rose-400"> · {rejectedCount} recusada{rejectedCount !== 1 ? 's' : ''}</span>
              )}
            </span>
          )}
        </p>
      </div>

      {pendingCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              {pendingCount} operadora{pendingCount !== 1 ? 's' : ''} aguardando aprovação
            </p>
            <p className="text-amber-700/80 dark:text-amber-300/80 text-xs">
              Clique em uma operadora "Em análise" para revisar os dados e aprovar ou recusar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFilterApproval('pending')}
            className="text-xs font-medium text-amber-700 dark:text-amber-300 underline hover:no-underline"
          >
            Filtrar pendentes
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

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, CNPJ, código ANS ou e-mail..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="medico">Médico</SelectItem>
            <SelectItem value="odonto">Odontológico</SelectItem>
            <SelectItem value="ambos">Médico + Odonto</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterApproval} onValueChange={setFilterApproval}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Em análise</SelectItem>
            <SelectItem value="approved">Aprovadas</SelectItem>
            <SelectItem value="rejected">Recusadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">
          Nenhuma operadora encontrada para os filtros selecionados.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          {/* Header */}
          <div className="hidden md:grid grid-cols-[1fr_140px_100px_160px_120px] gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b">
            <span>Operadora</span>
            <span>Tipo</span>
            <span>Código ANS</span>
            <span>Contato</span>
            <span>Status</span>
          </div>

          <div className="divide-y">
            {filtered.map(op => {
              const approval = APPROVAL_BADGE[op.approval_status ?? 'pending'];
              const ApprovalIcon = approval.icon;
              return (
              <button
                key={op.id}
                type="button"
                onClick={() => setSelected(op)}
                className="w-full text-left grid grid-cols-1 md:grid-cols-[1fr_140px_100px_160px_120px] gap-2 px-4 py-3 items-center hover:bg-muted/30 transition-colors"
              >
                {/* Nome + razão social */}
                <div className="flex items-center gap-3">
                  {/* Logo ou inicial */}
                  {op.logo_url ? (
                    <img
                      src={op.logo_url}
                      alt={op.name}
                      className="h-8 w-8 rounded object-contain border bg-white p-0.5 shrink-0"
                    />
                  ) : (
                    <div
                      className="h-8 w-8 rounded flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: op.brand_color ?? '#6366f1' }}
                    >
                      {op.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{op.name}</p>
                    {op.legal_name && op.legal_name !== op.name && (
                      <p className="text-xs text-muted-foreground truncate">{op.legal_name}</p>
                    )}
                    {op.cnpj && (
                      <p className="text-xs text-muted-foreground font-mono">{op.cnpj}</p>
                    )}
                  </div>
                </div>

                {/* Tipo */}
                <div className="hidden md:block">
                  <Badge variant="outline" className={TYPE_COLORS[op.type] ?? ''}>
                    {TYPE_LABELS[op.type] ?? op.type}
                  </Badge>
                </div>

                {/* Código ANS */}
                <span className="text-sm font-mono text-muted-foreground hidden md:block">
                  {op.ans_code ?? '—'}
                </span>

                {/* Contato */}
                <div className="hidden md:block text-xs text-muted-foreground space-y-0.5">
                  {op.contact_email && <p className="truncate">{op.contact_email}</p>}
                  {op.contact_phone && <p>{op.contact_phone}</p>}
                  {op.responsible_name && <p className="italic">{op.responsible_name}</p>}
                  {!op.contact_email && !op.contact_phone && !op.responsible_name && <span>—</span>}
                </div>

                {/* Approval status */}
                <div className="hidden md:flex flex-col gap-0.5">
                  <Badge variant="outline" className={`${approval.cls} w-fit gap-1`}>
                    <ApprovalIcon className="h-3 w-3" />
                    {approval.label}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(op.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </span>
                </div>

                {/* Mobile */}
                <div className="flex items-center gap-2 md:hidden flex-wrap text-xs text-muted-foreground">
                  <Badge variant="outline" className={`text-xs ${approval.cls}`}>
                    {approval.label}
                  </Badge>
                  <Badge variant="outline" className={`text-xs ${TYPE_COLORS[op.type] ?? ''}`}>
                    {TYPE_LABELS[op.type] ?? op.type}
                  </Badge>
                  {op.ans_code && <span>ANS: {op.ans_code}</span>}
                  {op.contact_email && <span>{op.contact_email}</span>}
                </div>
              </button>
              );
            })}
          </div>
        </div>
      )}

      <OperatorApprovalDialog
        operator={selected}
        onOpenChange={(open) => { if (!open) setSelected(null); }}
      />
    </div>
  );
}
