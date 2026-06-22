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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Types ─────────────────────────────────────────────────────────────────────

const TICKET_SUBJECT_OPTIONS = [
  'Achado / Divergência em Auditoria',
  'Atualização Cadastral Credenciado',
  'Autorizações',
  'Biometria',
  'Cancelamento - SE',
  'Comunicado Dentista',
  'Corpo Clínico',
  'Descredenciamento de Dentista',
  'Descredenciamento de Especialidade',
  'Diversas',
  'Elogio',
  'Inclusões de Procedimentos',
  'Pagamento de Dentista',
  'Produtividade',
  'Reajuste Tabela Credenciado',
  'Sistema',
  'Outro',
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

      return rawTickets.map((t) => ({
        ...t,
        creatorName: profileMap.get(t.created_by) ?? 'Profissional',
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
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={STATUS_VARIANT[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                      {t.priority !== 'normal' && (
                        <span className={`text-xs font-medium ${PRIORITY_COLOR[t.priority]}`}>
                          {PRIORITY_LABELS[t.priority]}
                        </span>
                      )}
                    </div>
                    <p className="font-medium truncate">{t.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      Por {t.creatorName} ·{' '}
                      {format(parseISO(t.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
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
          <div className="flex items-start justify-between gap-3 pr-6">
            <DialogTitle className="text-base leading-tight">{ticket.subject}</DialogTitle>
            <Badge variant={STATUS_VARIANT[ticket.status]} className="shrink-0">
              {STATUS_LABELS[ticket.status]}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>De {ticket.creatorName}</span>
            <span>·</span>
            <span>
              {format(parseISO(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
            {ticket.priority !== 'normal' && (
              <>
                <span>·</span>
                <span className={PRIORITY_COLOR[ticket.priority]}>
                  Prioridade {PRIORITY_LABELS[ticket.priority].toLowerCase()}
                </span>
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
                  {msg.support_ticket_attachments?.map((att) => (
                    <a
                      key={att.id}
                      href={att.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <Paperclip className="h-3 w-3" />
                      {att.file_name}
                    </a>
                  ))}
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
        <div className="border-t px-6 py-4 space-y-2">
          {isClosed ? (
            <p className="text-center text-sm text-muted-foreground">Este chamado está encerrado.</p>
          ) : (
            <>
              <Textarea
                placeholder="Escreva sua resposta... (Enter para enviar, Shift+Enter para nova linha)"
                rows={2}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer text-muted-foreground hover:text-primary transition-colors">
                    <Paperclip className="h-4 w-4" />
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      className="sr-only"
                      onChange={(e) =>
                        setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])
                      }
                    />
                  </label>
                  {files.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>{files.length} anexo(s)</span>
                      <button
                        type="button"
                        onClick={() => setFiles([])}
                        className="text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleCloseTicket}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Encerrar chamado
                  </button>
                </div>
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={sending || (!reply.trim() && files.length === 0)}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
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
  const [body, setBody] = useState('');
  const [clinicId, setClinicId] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

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

          <div className="space-y-2">
            <Label>Assunto</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o assunto" />
              </SelectTrigger>
              <SelectContent>
                {TICKET_SUBJECT_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Label>Mensagem</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Descreva a solicitação ou comunicado..."
              rows={5}
            />
          </div>

          <div className="space-y-2">
            <Label>Anexos <span className="font-normal text-muted-foreground text-xs">(opcional)</span></Label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary hover:bg-primary/5">
              <Paperclip className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {files.length > 0 ? `${files.length} arquivo(s) selecionado(s)` : 'Clique para anexar'}
              </span>
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                className="sr-only"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
            </label>
            {files.length > 0 && (
              <button
                type="button"
                onClick={() => setFiles([])}
                className="text-xs text-destructive hover:underline"
              >
                Remover anexos
              </button>
            )}
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
    </Dialog>
  );
}
