import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DocumentFullscreenViewer, type FullscreenDocFile } from '@/components/operadora/DocumentFullscreenViewer';
import {
  Loader2,
  Paperclip,
  Send,
  ChevronRight,
  MessageSquareDot,
  CheckCheck,
  X,
  Plus,
  AlertCircle,
  ClipboardCheck,
  FileSearch,
  UserCog,
  Fingerprint,
  XCircle,
  Megaphone,
  Users,
  UserMinus,
  CircleMinus,
  MoreHorizontal,
  Star,
  ListPlus,
  Wallet,
  TrendingUp,
  RefreshCw,
  Monitor,
  PenLine,
  Info,
  FileText,
  Eye,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Types ─────────────────────────────────────────────────────────────────────

const PRESET_SUBJECTS = [
  { id: 'auditoria',          label: 'Achado / Divergência em Auditoria',   icon: FileSearch,    color: 'text-orange-600 dark:text-orange-400',  bg: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800' },
  { id: 'atualizacao',        label: 'Atualização Cadastral Credenciado',   icon: UserCog,       color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' },
  { id: 'autorizacoes',       label: 'Autorizações',                        icon: ClipboardCheck,color: 'text-green-600 dark:text-green-400',     bg: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' },
  { id: 'biometria',          label: 'Biometria',                           icon: Fingerprint,   color: 'text-purple-600 dark:text-purple-400',   bg: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800' },
  { id: 'cancelamento',       label: 'Cancelamento - SE',                   icon: XCircle,       color: 'text-red-600 dark:text-red-400',         bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' },
  { id: 'comunicado',         label: 'Comunicado Dentista',                 icon: Megaphone,     color: 'text-yellow-600 dark:text-yellow-400',   bg: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800' },
  { id: 'corpo-clinico',      label: 'Corpo Clínico',                       icon: Users,         color: 'text-indigo-600 dark:text-indigo-400',   bg: 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800' },
  { id: 'desc-dentista',      label: 'Descredenciamento de Dentista',       icon: UserMinus,     color: 'text-rose-600 dark:text-rose-400',       bg: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800' },
  { id: 'desc-especialidade', label: 'Descredenciamento de Especialidade',  icon: CircleMinus,   color: 'text-pink-600 dark:text-pink-400',       bg: 'bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800' },
  { id: 'diversas',           label: 'Diversas',                            icon: MoreHorizontal,color: 'text-slate-600 dark:text-slate-400',     bg: 'bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800' },
  { id: 'elogio',             label: 'Elogio',                              icon: Star,          color: 'text-amber-500 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' },
  { id: 'inclusao-proc',      label: 'Inclusões de Procedimentos',          icon: ListPlus,      color: 'text-teal-600 dark:text-teal-400',       bg: 'bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800' },
  { id: 'pagamento',          label: 'Pagamento de Dentista',               icon: Wallet,        color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' },
  { id: 'produtividade',      label: 'Produtividade',                       icon: TrendingUp,    color: 'text-cyan-600 dark:text-cyan-400',       bg: 'bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800' },
  { id: 'reajuste',           label: 'Reajuste Tabela Credenciado',         icon: RefreshCw,     color: 'text-violet-600 dark:text-violet-400',   bg: 'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800' },
  { id: 'sistema',            label: 'Sistema',                             icon: Monitor,       color: 'text-gray-600 dark:text-gray-400',       bg: 'bg-gray-50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-800' },
  { id: 'outro',              label: 'Outro',                               icon: PenLine,       color: 'text-muted-foreground',                  bg: 'bg-muted/40 border-border' },
];

interface Ticket {
  id: string;
  subject: string;
  status: 'pending_owner' | 'open' | 'answered' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_by: string;
  clinic_id: string | null;
  operator_id: string | null;
  created_at: string;
  updated_at: string;
  creatorName?: string;
  clinicName?: string;
  clinicLogo?: string | null;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  support_ticket_attachments: TicketAttachment[];
}

interface TicketAttachment {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentsList({
  files,
  onRemove,
  onView,
}: {
  files: File[];
  onRemove: (idx: number) => void;
  onView: (file: File) => void;
}) {
  if (files.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {files.map((file, idx) => {
        const isImage = file.type.startsWith('image/');
        return (
          <div
            key={`${file.name}-${idx}`}
            className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background border border-border">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(file.size)}
                {isImage ? ' · Imagem' : file.type.includes('pdf') ? ' · PDF' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onView(file)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
              title="Visualizar"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Remover"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  open: 'Aguardando resposta',
  answered: 'Respondido',
  closed: 'Fechado',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  open: 'default',
  answered: 'outline',
  closed: 'destructive',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

const PRIORITY_COLOR: Record<string, string> = {
  low: 'text-muted-foreground',
  normal: 'text-muted-foreground',
  high: 'text-amber-600 dark:text-amber-400',
  urgent: 'text-destructive',
};

type StatusFilter = 'open' | 'answered' | 'closed' | 'all';

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OperatorTickets() {
  const { operatorId, user } = useAuth();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['operator-tickets', operatorId, statusFilter],
    enabled: !!operatorId,
    queryFn: async () => {
      let q = supabase
        .from('support_tickets')
        .select('*')
        .eq('operator_id', operatorId!)
        .neq('status', 'pending_owner')
        .order('updated_at', { ascending: false });

      if (statusFilter !== 'all') {
        q = q.eq('status', statusFilter);
      }

      const { data: rawTickets, error } = await q;
      if (error) throw error;
      if (!rawTickets || rawTickets.length === 0) return [];

      const creatorIds = [...new Set(rawTickets.map((t) => t.created_by))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', creatorIds);
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? 'Profissional']));

      const clinicIds = [...new Set(rawTickets.map((t) => t.clinic_id).filter(Boolean) as string[])];
      const { data: clinicRows } = clinicIds.length
        ? await supabase.from('clinics').select('id, name, logo_url').in('id', clinicIds)
        : { data: [] as any[] };
      const clinicMap = new Map((clinicRows ?? []).map((c: any) => [c.id, { name: c.name as string, logo: (c.logo_url ?? null) as string | null }]));

      return rawTickets.map((t) => ({
        ...t,
        creatorName: profileMap.get(t.created_by) ?? 'Profissional',
        clinicName: t.clinic_id ? clinicMap.get(t.clinic_id)?.name ?? 'Clínica' : 'Clínica',
        clinicLogo: t.clinic_id ? clinicMap.get(t.clinic_id)?.logo ?? null : null,
      })) as Ticket[];
    },
  });

  // Separate count so the badge stays accurate regardless of current filter
  const { data: openCount = 0 } = useQuery({
    queryKey: ['operator-tickets-open-count', operatorId],
    enabled: !!operatorId,
    queryFn: async () => {
      const { count } = await supabase
        .from('support_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('operator_id', operatorId!)
        .eq('status', 'open');
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  const TABS: { value: StatusFilter; label: string }[] = [
    { value: 'open', label: 'Abertos' },
    { value: 'answered', label: 'Respondidos' },
    { value: 'closed', label: 'Fechados' },
    { value: 'all', label: 'Todos' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Chamados</h1>
          <p className="text-sm text-muted-foreground">
            Converse com clínicas e profissionais credenciados
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo chamado
        </Button>
      </div>

      {/* Status tabs */}
      <div className="inline-flex rounded-xl bg-muted p-1 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`relative px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              statusFilter === tab.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.value === 'open' && openCount > 0 && statusFilter !== 'open' && (
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                {openCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <MessageSquareDot className="h-10 w-10 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">Nenhum chamado encontrado</p>
            <p className="text-sm text-muted-foreground">
              Os chamados enviados pelos profissionais aparecerão aqui
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <button key={t.id} onClick={() => setSelectedTicket(t)} className="w-full text-left">
              <Card className="rounded-xl hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <Badge variant={STATUS_VARIANT[t.status]} className="shrink-0 text-[10px] px-2 py-0.5">
                      {STATUS_LABELS[t.status]}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {format(parseISO(t.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Avatar className="h-11 w-11 shrink-0">
                      {t.clinicLogo && <AvatarImage src={t.clinicLogo} alt={t.clinicName ?? 'Clínica'} />}
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                        {(t.clinicName ?? 'C').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold leading-tight truncate">{t.clinicName ?? 'Clínica'}</p>
                      {(() => {
                        const preset = PRESET_SUBJECTS.find(
                          (s) => s.label.toLowerCase() === t.subject.trim().toLowerCase(),
                        ) ?? PRESET_SUBJECTS.find((s) => s.id === 'outro')!;
                        const Icon = preset.icon;
                        return (
                          <span
                            className={`mt-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${preset.bg} ${preset.color}`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {t.subject}
                          </span>
                        );
                      })()}
                      {t.priority !== 'normal' && (
                        <p className={`text-[11px] mt-0.5 ${PRIORITY_COLOR[t.priority]}`}>
                          Prioridade {PRIORITY_LABELS[t.priority].toLowerCase()}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground self-center" />
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      {selectedTicket && (
        <OperatorTicketDialog
          ticket={selectedTicket}
          operatorUserId={user!.id}
          onClose={() => setSelectedTicket(null)}
          onUpdated={(updated) => {
            setSelectedTicket(updated);
            qc.invalidateQueries({ queryKey: ['operator-tickets'] });
          }}
        />
      )}

      {showCreate && operatorId && (
        <CreateOperatorTicketDialog
          operatorId={operatorId}
          userId={user!.id}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ['operator-tickets'] });
          }}
        />
      )}
    </div>
  );
}

// ── Ticket dialog for operator ────────────────────────────────────────────────

function OperatorTicketDialog({
  ticket,
  operatorUserId,
  onClose,
  onUpdated,
}: {
  ticket: Ticket;
  operatorUserId: string;
  onClose: () => void;
  onUpdated: (t: Ticket) => void;
}) {
  const [reply, setReply] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [profileNames, setProfileNames] = useState<Map<string, string>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [viewerFile, setViewerFile] = useState<FullscreenDocFile | null>(null);
  const viewerUrlRef = useRef<string | null>(null);
  const openLocalFileViewer = (file: File) => {
    if (viewerUrlRef.current) URL.revokeObjectURL(viewerUrlRef.current);
    const url = URL.createObjectURL(file);
    viewerUrlRef.current = url;
    setViewerFile({ url, file_name: file.name });
  };
  const closeViewer = () => {
    setViewerFile(null);
    if (viewerUrlRef.current) {
      URL.revokeObjectURL(viewerUrlRef.current);
      viewerUrlRef.current = null;
    }
  };

  const { data: messages = [], refetch } = useQuery({
    queryKey: ['ticket-messages', ticket.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_ticket_messages')
        .select('*, support_ticket_attachments(*)')
        .eq('ticket_id', ticket.id)
        .order('created_at');
      if (error) throw error;
      return data as TicketMessage[];
    },
  });

  useEffect(() => {
    if (messages.length === 0) return;
    const senderIds = [...new Set(messages.map((m) => m.sender_id))];
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', senderIds)
      .then(({ data }) => {
        const map = new Map((data ?? []).map((p) => [p.id, p.full_name ?? 'Usuário']));
        setProfileNames(map);
      });
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!reply.trim() && files.length === 0) return;
    setSending(true);
    try {
      const { data: msg, error } = await supabase
        .from('support_ticket_messages')
        .insert({
          ticket_id: ticket.id,
          sender_id: operatorUserId,
          content: reply.trim() || '(anexo)',
        })
        .select()
        .single();
      if (error) throw error;

      for (const file of files) {
        const path = `tickets/${ticket.id}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from('clinic-assets').upload(path, file);
        if (upErr) continue;
        const { data: urlData } = supabase.storage.from('clinic-assets').getPublicUrl(path);
        await supabase.from('support_ticket_attachments').insert({
          message_id: msg.id,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
        });
      }

      // Mark as answered after operator responds
      if (ticket.status === 'open') {
        await supabase
          .from('support_tickets')
          .update({ status: 'answered' })
          .eq('id', ticket.id);
        onUpdated({ ...ticket, status: 'answered' });
      }

      setReply('');
      setFiles([]);
      refetch();
      toast.success('Resposta enviada');
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao enviar resposta');
    } finally {
      setSending(false);
    }
  };

  const handleCloseTicket = async () => {
    try {
      await supabase.from('support_tickets').update({ status: 'closed' }).eq('id', ticket.id);
      onUpdated({ ...ticket, status: 'closed' });
      toast.success('Chamado encerrado');
    } catch {
      toast.error('Erro ao encerrar chamado');
    }
  };

  const isClosed = ticket.status === 'closed';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between gap-3 pr-6 mb-2">
            <Badge variant={STATUS_VARIANT[ticket.status]} className="shrink-0 text-[10px] px-2 py-0.5">
              {STATUS_LABELS[ticket.status]}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {format(parseISO(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-11 w-11 shrink-0">
                {ticket.clinicLogo && <AvatarImage src={ticket.clinicLogo} alt={ticket.clinicName ?? 'Clínica'} />}
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {(ticket.clinicName ?? 'C').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <DialogTitle className="text-base leading-tight">{ticket.clinicName ?? 'Clínica'}</DialogTitle>
                {(() => {
                  const preset = PRESET_SUBJECTS.find(
                    (s) => s.label.toLowerCase() === ticket.subject.trim().toLowerCase(),
                  ) ?? PRESET_SUBJECTS.find((s) => s.id === 'outro')!;
                  const Icon = preset.icon;
                  return (
                    <span
                      className={`mt-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${preset.bg} ${preset.color}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {ticket.subject}
                    </span>
                  );
                })()}
                {ticket.priority !== 'normal' && (
                  <p className={`text-[11px] mt-0.5 ${PRIORITY_COLOR[ticket.priority]}`}>
                    Prioridade {PRIORITY_LABELS[ticket.priority].toLowerCase()}
                  </p>
                )}
              </div>
            </div>
            {!isClosed && (
              <>
                <button
                  type="button"
                  onClick={handleCloseTicket}
                  className="hidden sm:flex shrink-0 items-center gap-1.5 text-xs font-medium rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Encerrar chamado
                </button>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Mais opções"
                      className="sm:hidden shrink-0 flex items-center justify-center h-8 w-8 rounded-full border border-border hover:bg-muted transition-colors text-muted-foreground"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-52 p-1">
                    <button
                      type="button"
                      onClick={handleCloseTicket}
                      className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    >
                      <CheckCheck className="h-4 w-4" />
                      Encerrar chamado
                    </button>
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>
        </DialogHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 px-6 py-4 min-h-[180px] max-h-[400px]">
          {messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nenhuma mensagem ainda.
            </p>
          )}
          {messages.map((msg) => {
            const isOp = msg.sender_id === operatorUserId;
            const senderName = isOp
              ? 'Operadora'
              : (profileNames.get(msg.sender_id) ?? 'Profissional');
            return (
              <div key={msg.id} className={`flex gap-2.5 ${isOp ? 'flex-row-reverse' : ''}`}>
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback
                    className={`text-[10px] ${
                      isOp ? 'bg-orange-100 text-orange-700' : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {senderName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`max-w-[75%] space-y-1 flex flex-col ${
                    isOp ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm ${
                      isOp
                        ? 'bg-orange-500 text-white rounded-tr-sm'
                        : 'bg-muted rounded-tl-sm'
                    }`}
                  >
                    <p className="text-[10px] font-medium mb-1 opacity-70">{senderName}</p>
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                  {msg.support_ticket_attachments?.map((att) => {
                    const isImg = /\.(png|jpe?g|webp|gif|bmp|svg)($|\?)/i.test(att.file_name);
                    const isPdf = /\.pdf($|\?)/i.test(att.file_name);
                    return (
                      <button
                        key={att.id}
                        type="button"
                        onClick={() => setViewerFile({ url: att.file_url, file_name: att.file_name })}
                        className="flex w-full items-center gap-2 rounded-xl border border-border bg-background hover:bg-muted/50 transition-colors px-3 py-2 text-left max-w-[260px]"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted border border-border">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-foreground">{att.file_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {isImg ? 'Imagem' : isPdf ? 'PDF' : 'Arquivo'} · Clique para visualizar
                          </p>
                        </div>
                        <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    );
                  })}
                  <span className="text-[10px] text-muted-foreground">
                    {format(parseISO(msg.created_at), 'HH:mm', { locale: ptBR })}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply area */}
        <div className="px-6 py-4 space-y-2 bg-transparent">
          {isClosed ? (
            <p className="text-center text-sm text-muted-foreground">Este chamado está encerrado.</p>
          ) : (
            <>
              <AttachmentsList
                files={files}
                onRemove={(idx) => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                onView={openLocalFileViewer}
              />
              <div className="flex items-end gap-2 rounded-2xl border bg-transparent px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0">
                <label className="shrink-0 cursor-pointer p-2 text-muted-foreground hover:text-primary transition-colors rounded-full">
                  <Paperclip className="h-5 w-5" />
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    className="sr-only"
                    onChange={(e) => {
                      const picked = Array.from(e.target.files ?? []);
                      setFiles((prev) => [...prev, ...picked]);
                      e.target.value = '';
                    }}
                  />
                </label>
                <Textarea
                  placeholder="Escreva sua resposta..."
                  rows={1}
                  value={reply}
                  onChange={(e) => {
                    setReply(e.target.value);
                    const el = e.currentTarget;
                    el.style.height = 'auto';
                    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
                  }}
                  ref={(el) => {
                    if (el) {
                      el.style.height = 'auto';
                      el.style.height = Math.min(el.scrollHeight, 160) + 'px';
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="flex-1 min-h-[40px] max-h-40 resize-none overflow-y-auto border-0 bg-transparent px-1 py-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={sending || (!reply.trim() && files.length === 0)}
                  className="shrink-0 rounded-full bg-orange-500 hover:bg-orange-600 text-white h-10 w-10"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
      <DocumentFullscreenViewer file={viewerFile} open={!!viewerFile} onClose={closeViewer} />
    </Dialog>
  );
}

// ── Create Ticket Dialog (operator → clinic) ──────────────────────────────────

interface ClinicOption {
  id: string;
  name: string;
}

function CreateOperatorTicketDialog({
  operatorId,
  userId,
  onClose,
  onCreated,
}: {
  operatorId: string;
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [freeText, setFreeText] = useState(false);
  const [body, setBody] = useState('');
  const [clinicId, setClinicId] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const [viewerFile, setViewerFile] = useState<FullscreenDocFile | null>(null);
  const viewerUrlRef = useRef<string | null>(null);

  const openLocalFileViewer = (file: File) => {
    if (viewerUrlRef.current) URL.revokeObjectURL(viewerUrlRef.current);
    const url = URL.createObjectURL(file);
    viewerUrlRef.current = url;
    setViewerFile({ url, file_name: file.name });
  };
  const closeViewer = () => {
    setViewerFile(null);
    if (viewerUrlRef.current) {
      URL.revokeObjectURL(viewerUrlRef.current);
      viewerUrlRef.current = null;
    }
  };

  const matchedPreset = PRESET_SUBJECTS.find(
    (s) => s.label.toLowerCase() === subject.trim().toLowerCase()
  );
  const suggestions = PRESET_SUBJECTS.filter(
    (s) => !subject || s.label.toLowerCase().includes(subject.toLowerCase())
  );
  const handleSelectSuggestion = (label: string, id: string) => {
    if (id === 'outro') {
      setSubject('');
      setFreeText(true);
      setShowSuggestions(false);
      setTimeout(() => subjectInputRef.current?.focus(), 50);
    } else {
      setSubject(label);
      setFreeText(false);
      setShowSuggestions(false);
      subjectInputRef.current?.blur();
    }
  };

  const { data: clinics = [], isLoading: loadingClinics } = useQuery({
    queryKey: ['operator-credentialed-clinics', operatorId],
    queryFn: async () => {
      const { data: creds } = await supabase
        .from('operator_credentialings')
        .select('clinic_id')
        .eq('operator_id', operatorId)
        .eq('status', 'approved')
        .not('clinic_id', 'is', null);
      const ids = [...new Set((creds ?? []).map((c) => c.clinic_id as string))];
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from('clinics')
        .select('id, name')
        .in('id', ids)
        .order('name');
      return (data ?? []) as ClinicOption[];
    },
  });

  const canSubmit = !!subject.trim() && !!body.trim() && !!clinicId;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const { data: ticket, error: tErr } = await supabase
        .from('support_tickets')
        .insert({
          subject: subject.trim(),
          status: 'open',
          priority,
          created_by: userId,
          clinic_id: clinicId,
          operator_id: operatorId,
        })
        .select()
        .single();
      if (tErr) throw tErr;

      const { data: msg, error: mErr } = await supabase
        .from('support_ticket_messages')
        .insert({ ticket_id: ticket.id, sender_id: userId, content: body.trim() })
        .select()
        .single();
      if (mErr) throw mErr;

      for (const file of files) {
        const path = `tickets/${ticket.id}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from('clinic-assets').upload(path, file);
        if (upErr) continue;
        const { data: urlData } = supabase.storage.from('clinic-assets').getPublicUrl(path);
        await supabase.from('support_ticket_attachments').insert({
          message_id: msg.id,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
        });
      }

      toast.success('Chamado enviado à clínica');
      onCreated();
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao criar chamado');
    } finally {
      setSaving(false);
    }
  };

  if (!loadingClinics && clinics.length === 0) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Sem clínicas credenciadas</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Você ainda não possui clínicas credenciadas aprovadas para enviar chamados.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo chamado para clínica</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Clínica destinatária</Label>
            <Select value={clinicId} onValueChange={setClinicId} disabled={loadingClinics}>
              <SelectTrigger>
                <SelectValue placeholder={loadingClinics ? 'Carregando...' : 'Selecione a clínica'} />
              </SelectTrigger>
              <SelectContent>
                {clinics.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Assunto <span className="text-destructive">*</span></Label>
            <div className="relative">
              <div className="relative flex items-center">
                {matchedPreset && (
                  <matchedPreset.icon className={`absolute left-3 h-4 w-4 shrink-0 ${matchedPreset.color}`} />
                )}
                <Input
                  ref={subjectInputRef}
                  placeholder="Digite ou selecione o assunto..."
                  value={subject}
                  className={matchedPreset ? 'pl-9' : ''}
                  onChange={(e) => { setSubject(e.target.value); setFreeText(false); setShowSuggestions(true); }}
                  onFocus={() => { if (!freeText) setShowSuggestions(true); }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  autoComplete="off"
                />
                {subject && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => { setSubject(''); setFreeText(false); setShowSuggestions(true); subjectInputRef.current?.focus(); }}
                    className="absolute right-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border bg-popover shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                  {suggestions.map((s) => {
                    const Icon = s.icon;
                    const isSelected = subject === s.label;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onMouseDown={() => handleSelectSuggestion(s.label, s.id)}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors hover:bg-muted ${
                          isSelected ? 'bg-muted/60' : ''
                        }`}
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${s.bg}`}>
                          <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                        </span>
                        <span className="font-medium">{s.label}</span>
                        {isSelected && (
                          <span className="ml-auto text-xs text-primary">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Mensagem <span className="text-destructive">*</span></Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                subject
                  ? `Descreva com detalhes sobre "${subject}"...\n\nInclua informações como: protocolo, dentista, paciente, data, etc.`
                  : 'Selecione o assunto acima e descreva a solicitação em detalhes...'
              }
              rows={5}
            />
          </div>

          <div className="space-y-2">
            <Label>Anexos <span className="font-normal text-muted-foreground text-xs">(opcional)</span></Label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary hover:bg-primary/5">
              <Paperclip className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {files.length > 0 ? 'Adicionar mais arquivos' : 'Clique para anexar (você pode enviar vários)'}
              </span>
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                className="sr-only"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  setFiles((prev) => [...prev, ...picked]);
                  e.target.value = '';
                }}
              />
            </label>
            <AttachmentsList
              files={files}
              onRemove={(idx) => setFiles((prev) => prev.filter((_, i) => i !== idx))}
              onView={openLocalFileViewer}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !canSubmit}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar chamado
          </Button>
        </DialogFooter>
      </DialogContent>
      <DocumentFullscreenViewer file={viewerFile} open={!!viewerFile} onClose={closeViewer} />
    </Dialog>
  );
}
