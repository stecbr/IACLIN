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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Plus,
  Paperclip,
  Send,
  ChevronRight,
  MessageSquareDot,
  X,
  ClipboardCheck,
  AlertCircle,
  HelpCircle,
  CreditCard,
  BadgeCheck,
  RotateCcw,
  Clock,
  PenLine,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Ticket {
  id: string;
  subject: string;
  status: 'pending_owner' | 'open' | 'answered' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  clinic_id: string | null;
  operator_id: string | null;
  forwarded_by: string | null;
  forwarded_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
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
  file_size: number | null;
}

interface Operator {
  id: string;
  name: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending_owner: 'Aguardando clínica',
  open: 'Aguardando operadora',
  answered: 'Respondido',
  closed: 'Fechado',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending_owner: 'secondary',
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SupportTickets() {
  const { user, currentClinicId, isClinicOwner } = useAuth();
  const qc = useQueryClient();

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState<'mine' | 'clinic'>('mine');

  const { data: myTickets = [], isLoading } = useQuery({
    queryKey: ['my-tickets', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('created_by', user!.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Ticket[];
    },
  });

  const { data: clinicTickets = [] } = useQuery({
    queryKey: ['clinic-tickets', currentClinicId],
    enabled: !!currentClinicId && !!isClinicOwner,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('clinic_id', currentClinicId!)
        .eq('status', 'pending_owner')
        .neq('created_by', user!.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Ticket[];
    },
  });

  const { data: operators = [], isLoading: loadingOperators } = useQuery({
    queryKey: ['credentialed-operators', user?.id, currentClinicId],
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase
        .from('operator_credentialings')
        .select('operator_id')
        .eq('status', 'approved');

      if (currentClinicId) {
        q = q.eq('clinic_id', currentClinicId);
      } else {
        q = q.eq('professional_user_id', user!.id);
      }

      const { data: creds } = await q;
      const ids = [...new Set((creds ?? []).map((c) => c.operator_id as string))];
      if (ids.length === 0) return [];

      const { data } = await supabase
        .from('insurance_operators')
        .select('id, name')
        .in('id', ids)
        .eq('is_active', true)
        .order('name');
      return (data ?? []) as Operator[];
    },
  });

  const displayTickets = tab === 'mine' ? myTickets : clinicTickets;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Chamados</h1>
          <p className="text-sm text-muted-foreground">
            Envie dúvidas e solicitações às operadoras de saúde
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Chamado
        </Button>
      </div>

      {isClinicOwner && (
        <div className="flex gap-2">
          <button
            onClick={() => setTab('mine')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'mine'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            Meus chamados
          </button>
          <button
            onClick={() => setTab('clinic')}
            className={`relative rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'clinic'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            Da clínica
            {clinicTickets.length > 0 && (
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                {clinicTickets.length}
              </span>
            )}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : displayTickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <MessageSquareDot className="h-10 w-10 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">Nenhum chamado encontrado</p>
            <p className="text-sm text-muted-foreground">
              Clique em "Novo Chamado" para iniciar uma conversa com a operadora
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayTickets.map((t) => (
            <button key={t.id} onClick={() => setSelectedTicket(t)} className="w-full text-left">
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant={STATUS_VARIANT[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                      {t.priority !== 'normal' && (
                        <Badge variant="outline" className="text-xs">
                          {PRIORITY_LABELS[t.priority]}
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium truncate">{t.subject}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Atualizado{' '}
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

      {showCreate && (
        <CreateTicketDialog
          operators={operators}
          loadingOperators={loadingOperators}
          currentClinicId={currentClinicId}
          userId={user!.id}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ['my-tickets'] });
          }}
        />
      )}

      {selectedTicket && (
        <TicketDetailDialog
          ticket={selectedTicket}
          userId={user!.id}
          isClinicOwner={isClinicOwner}
          operators={operators}
          onClose={() => setSelectedTicket(null)}
          onUpdated={(updated) => {
            setSelectedTicket(updated);
            qc.invalidateQueries({ queryKey: ['my-tickets'] });
            qc.invalidateQueries({ queryKey: ['clinic-tickets'] });
          }}
        />
      )}
    </div>
  );
}

// ── Pre-defined subjects ──────────────────────────────────────────────────────

const PRESET_SUBJECTS = [
  { id: 'autorizacao', label: 'Autorização de Procedimento', icon: ClipboardCheck, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' },
  { id: 'glosa',       label: 'Recurso de Glosa',           icon: AlertCircle,    color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' },
  { id: 'cobertura',   label: 'Dúvida sobre Cobertura',     icon: HelpCircle,     color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800' },
  { id: 'faturamento', label: 'Faturamento e Pagamento',    icon: CreditCard,     color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' },
  { id: 'credencial',  label: 'Credenciamento',             icon: BadgeCheck,     color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800' },
  { id: 'reembolso',   label: 'Reembolso',                  icon: RotateCcw,      color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' },
  { id: 'prazo',       label: 'Prazo de Atendimento',       icon: Clock,          color: 'text-cyan-600 dark:text-cyan-400',    bg: 'bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800' },
  { id: 'outro',       label: 'Outro',                      icon: PenLine,        color: 'text-muted-foreground',               bg: 'bg-muted/40 border-border' },
];

// ── Create Dialog ─────────────────────────────────────────────────────────────

function CreateTicketDialog({
  operators,
  loadingOperators,
  currentClinicId,
  userId,
  onClose,
  onCreated,
}: {
  operators: Operator[];
  loadingOperators: boolean;
  currentClinicId: string | null;
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [body, setBody] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const subjectInputRef = useRef<HTMLInputElement>(null);

  const isSolo = !currentClinicId;
  const matchedPreset = PRESET_SUBJECTS.find(
    (s) => s.label.toLowerCase() === subject.trim().toLowerCase()
  );

  const suggestions = PRESET_SUBJECTS.filter(
    (s) => !subject || s.label.toLowerCase().includes(subject.toLowerCase())
  );

  const handleSelectSuggestion = (label: string, id: string) => {
    if (id === 'outro') {
      setSubject('');
      setShowSuggestions(false);
      setTimeout(() => subjectInputRef.current?.focus(), 50);
    } else {
      setSubject(label);
      setShowSuggestions(false);
      subjectInputRef.current?.blur();
    }
  };

  const handleSubmit = async () => {
    if (!subject.trim()) { toast.error('Informe o assunto do chamado'); return; }
    if (!operatorId) { toast.error('Selecione a operadora'); return; }
    if (!body.trim()) { toast.error('Descreva sua solicitação'); return; }

    setSaving(true);
    try {
      const { data: ticket, error: tErr } = await supabase
        .from('support_tickets')
        .insert({
          subject: subject.trim(),
          status: isSolo ? 'open' : 'pending_owner',
          created_by: userId,
          clinic_id: currentClinicId ?? null,
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

      toast.success('Chamado aberto com sucesso');
      onCreated();
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao criar chamado');
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = !!subject.trim() && !!body.trim() && !!operatorId;

  // ── No operators: show empty-state dialog ──
  if (!loadingOperators && operators.length === 0) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Sem vínculo com operadoras</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-foreground">
                Nenhuma operadora vinculada
              </p>
              <p className="text-sm text-muted-foreground">
                {currentClinicId
                  ? 'Sua clínica não possui vínculo ativo com nenhuma operadora no momento. Entre em contato com o responsável da clínica para solicitar um credenciamento.'
                  : 'Você não possui vínculo ativo com nenhuma operadora no momento. Acesse a área de Credenciamentos para solicitar vínculo.'}
              </p>
            </div>
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
      <DialogContent className="w-[92vw] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Novo Chamado</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Descreva sua solicitação à operadora de saúde
          </p>
        </DialogHeader>

        <div className="space-y-5 py-1">

          {/* ── Assunto com autocomplete ── */}
          <div className="space-y-1.5">
            <Label>
              Assunto <span className="text-destructive">*</span>
            </Label>
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
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  autoComplete="off"
                />
                {subject && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => { setSubject(''); setShowSuggestions(true); subjectInputRef.current?.focus(); }}
                    className="absolute right-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Dropdown de sugestões */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border bg-popover shadow-lg overflow-hidden">
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

          {/* ── Operadora ── */}
          <div className="space-y-1.5">
            <Label>
              Operadora <span className="text-destructive">*</span>
            </Label>
            <Select value={operatorId} onValueChange={setOperatorId} disabled={loadingOperators}>
              <SelectTrigger>
                <SelectValue placeholder={loadingOperators ? 'Carregando...' : 'Selecione a operadora'} />
              </SelectTrigger>
              <SelectContent>
                {operators.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isSolo && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>Após enviar, o chamado passará pelo dono da clínica antes de chegar à operadora.</span>
              </div>
            )}
          </div>

          {/* ── Descrição ── */}
          <div className="space-y-1.5">
            <Label>
              Descrição <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder={
                subject
                  ? `Descreva com detalhes sua solicitação sobre "${subject}"...\n\nInclua informações como: número do paciente, data do procedimento, código TUSS, protocolo, etc.`
                  : 'Informe o assunto acima e descreva sua solicitação em detalhes...'
              }
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          {/* ── Anexos ── */}
          <div className="space-y-2">
            <Label>
              Anexos{' '}
              <span className="font-normal text-muted-foreground text-xs">(opcional)</span>
            </Label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary hover:bg-primary/5">
              <Paperclip className="h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {files.length > 0
                    ? `${files.length} arquivo(s) selecionado(s)`
                    : 'Clique para anexar arquivos'}
                </p>
                <p className="text-xs text-muted-foreground/70">PDFs, imagens, Word</p>
              </div>
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                className="sr-only"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
            </label>
            {files.length > 0 && (
              <div className="space-y-1 rounded-lg border bg-muted/30 p-2">
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Paperclip className="h-3 w-3 shrink-0" />
                      <span className="truncate">{f.name}</span>
                      <span className="shrink-0 text-muted-foreground/60">
                        ({(f.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="ml-2 shrink-0 rounded p-0.5 text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !canSubmit}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Abrir chamado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Detail Dialog ─────────────────────────────────────────────────────────────

function TicketDetailDialog({
  ticket,
  userId,
  isClinicOwner,
  operators,
  onClose,
  onUpdated,
}: {
  ticket: Ticket;
  userId: string;
  isClinicOwner: boolean;
  operators: Operator[];
  onClose: () => void;
  onUpdated: (t: Ticket) => void;
}) {
  const [reply, setReply] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [forwarding, setForwarding] = useState(false);
  // Pre-populate with the operator already chosen by the doctor at ticket creation
  const [forwardOpId, setForwardOpId] = useState(ticket.operator_id ?? '');
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
          sender_id: userId,
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

      if (ticket.status === 'answered') {
        await supabase.from('support_tickets').update({ status: 'open' }).eq('id', ticket.id);
        onUpdated({ ...ticket, status: 'open' });
      }

      setReply('');
      setFiles([]);
      refetch();
      toast.success('Mensagem enviada');
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleForward = async () => {
    if (!forwardOpId) { toast.error('Selecione a operadora'); return; }
    setForwarding(true);
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({
          operator_id: forwardOpId,
          status: 'open',
          forwarded_by: userId,
          forwarded_at: new Date().toISOString(),
        })
        .eq('id', ticket.id);
      if (error) throw error;
      toast.success('Chamado encaminhado para a operadora');
      onUpdated({ ...ticket, status: 'open', operator_id: forwardOpId, forwarded_by: userId });
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao encaminhar');
    } finally {
      setForwarding(false);
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
  const canForward = isClinicOwner && ticket.status === 'pending_owner';

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
          <p className="text-xs text-muted-foreground">
            Aberto em{' '}
            {format(parseISO(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </DialogHeader>

        {/* Forward panel (clinic owner only) */}
        {canForward && (
          <div className="mx-6 mt-4 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20 p-3 space-y-2">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Encaminhar para operadora
            </p>
            {operators.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>Sua clínica não possui operadoras credenciadas para encaminhar este chamado.</span>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select value={forwardOpId} onValueChange={setForwardOpId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione a operadora" />
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map((op) => (
                      <SelectItem key={op.id} value={op.id}>
                        {op.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleForward} disabled={forwarding}>
                  {forwarding && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                  Encaminhar
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 px-6 py-4 min-h-[180px] max-h-[400px]">
          {messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nenhuma mensagem ainda.
            </p>
          )}
          {messages.map((msg) => {
            const isMe = msg.sender_id === userId;
            const senderName = isMe ? 'Você' : (profileNames.get(msg.sender_id) ?? 'Usuário');
            return (
              <div key={msg.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {senderName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`max-w-[75%] space-y-1 flex flex-col ${
                    isMe ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm ${
                      isMe
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
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
                placeholder="Escreva uma mensagem... (Enter para enviar, Shift+Enter para nova linha)"
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
                    <span className="text-xs text-muted-foreground">{files.length} anexo(s)</span>
                  )}
                  {ticket.created_by === userId && (
                    <button
                      type="button"
                      onClick={handleCloseTicket}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Encerrar chamado
                    </button>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={sending || (!reply.trim() && files.length === 0)}
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
