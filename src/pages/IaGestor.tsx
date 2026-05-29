import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Brain, Plus, Trash2, Send, Loader2, MessageSquare, Download, Image as ImageIcon, Calendar, Users, DollarSign, FileText, Settings as SettingsIcon, Sparkles, MapPin, Clock, Edit, ArrowRight, Folder, FolderPlus, MoreHorizontal, ChevronRight, FolderInput, Pencil, Check, X, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const FN_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/gestor-ia-chat`;

type ThreadRow = { id: string; title: string; updated_at: string; folder_id: string | null };
type FolderRow = { id: string; name: string; color: string };

const FOLDER_COLORS: { id: string; label: string; dot: string; bg: string }[] = [
  { id: 'rose',    label: 'Rosa',     dot: 'bg-rose-400',    bg: 'bg-rose-500/10' },
  { id: 'amber',   label: 'Âmbar',    dot: 'bg-amber-400',   bg: 'bg-amber-500/10' },
  { id: 'emerald', label: 'Verde',    dot: 'bg-emerald-400', bg: 'bg-emerald-500/10' },
  { id: 'sky',     label: 'Azul',     dot: 'bg-sky-400',     bg: 'bg-sky-500/10' },
  { id: 'violet',  label: 'Violeta',  dot: 'bg-violet-400',  bg: 'bg-violet-500/10' },
  { id: 'slate',   label: 'Cinza',    dot: 'bg-slate-400',   bg: 'bg-slate-500/10' },
];

function colorDot(color: string) {
  return FOLDER_COLORS.find((c) => c.id === color)?.dot ?? 'bg-muted-foreground';
}

function ThreadItem({
  thread, active, folders, onSelect, onRename, onDelete, onMove,
}: {
  thread: ThreadRow; active: boolean; folders: FolderRow[];
  onSelect: () => void;
  onRename: (newTitle: string) => void;
  onDelete: () => void;
  onMove: (folderId: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(thread.title);

  const submit = () => {
    const v = value.trim();
    if (v && v !== thread.title) onRename(v);
    setEditing(false);
  };

  return (
    <div
      onClick={() => !editing && onSelect()}
      className={cn(
        'group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors',
        active ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      )}
    >
      <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
      {editing ? (
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); submit(); }
            if (e.key === 'Escape') { setEditing(false); setValue(thread.title); }
          }}
          onBlur={submit}
          className="h-6 px-1 py-0 text-sm flex-1"
        />
      ) : (
        <span className="flex-1 truncate">{thread.title}</span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <button
            className="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 text-muted-foreground hover:text-foreground transition-opacity p-0.5 rounded"
            aria-label="Opções"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onSelect={() => { setValue(thread.title); setEditing(true); }}>
            <Pencil className="h-3.5 w-3.5 mr-2" /> Renomear
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderInput className="h-3.5 w-3.5 mr-2" /> Mover para
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onSelect={() => onMove(null)}>
                <Folder className="h-3.5 w-3.5 mr-2 opacity-50" /> Sem pasta
              </DropdownMenuItem>
              {folders.length > 0 && <DropdownMenuSeparator />}
              {folders.map((f) => (
                <DropdownMenuItem key={f.id} onSelect={() => onMove(f.id)}>
                  <span className={cn('h-2 w-2 rounded-full mr-2', colorDot(f.color))} />
                  {f.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function FolderItem({
  folder, children, onRename, onDelete, onSetColor, onAddThread,
}: {
  folder: FolderRow; children: React.ReactNode;
  onRename: (newName: string) => void;
  onDelete: () => void;
  onSetColor: (color: string) => void;
  onAddThread: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(folder.name);

  const submit = () => {
    const v = value.trim();
    if (v && v !== folder.name) onRename(v);
    setEditing(false);
  };

  return (
    <div className="space-y-0.5">
      <div className="group flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
          <ChevronRight className={cn('h-3 w-3 text-muted-foreground transition-transform', open && 'rotate-90')} />
          <span className={cn('h-2 w-2 rounded-full flex-shrink-0', colorDot(folder.color))} />
          {editing ? (
            <Input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); submit(); }
                if (e.key === 'Escape') { setEditing(false); setValue(folder.name); }
              }}
              onBlur={submit}
              className="h-6 px-1 py-0 text-xs font-medium flex-1"
            />
          ) : (
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground/80 truncate">{folder.name}</span>
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 text-muted-foreground hover:text-foreground transition-opacity p-0.5 rounded"
              aria-label="Opções da pasta"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={onAddThread}>
              <Plus className="h-3.5 w-3.5 mr-2" /> Nova conversa aqui
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { setValue(folder.name); setEditing(true); }}>
              <Pencil className="h-3.5 w-3.5 mr-2" /> Renomear
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <span className={cn('h-2 w-2 rounded-full mr-2', colorDot(folder.color))} />
                Cor
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {FOLDER_COLORS.map((c) => (
                  <DropdownMenuItem key={c.id} onSelect={() => onSetColor(c.id)}>
                    <span className={cn('h-2.5 w-2.5 rounded-full mr-2', c.dot)} />
                    {c.label}
                    {folder.color === c.id && <Check className="h-3 w-3 ml-auto" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir pasta
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {open && <div className="ml-3 pl-2 border-l border-border/60 space-y-0.5">{children}</div>}
    </div>
  );
}

function Sidebar({
  threads, folders, activeId, onNew, onNewFolder, onSelect,
  onRenameThread, onDeleteThread, onMoveThread,
  onRenameFolder, onDeleteFolder, onSetFolderColor, onAddThreadInFolder,
  variant = 'desktop',
}: {
  threads: ThreadRow[]; folders: FolderRow[]; activeId?: string;
  onNew: () => void; onNewFolder: () => void; onSelect: (id: string) => void;
  onRenameThread: (id: string, title: string) => void;
  onDeleteThread: (id: string) => void;
  onMoveThread: (id: string, folderId: string | null) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onSetFolderColor: (id: string, color: string) => void;
  onAddThreadInFolder: (folderId: string) => void;
  variant?: 'desktop' | 'sheet';
}) {
  const ungrouped = threads.filter((t) => !t.folder_id);

  return (
    <aside className={cn(
      'flex w-full flex-col bg-muted/20 h-full',
      variant === 'desktop' ? 'hidden md:flex md:w-64 border-r border-border' : 'w-full',
    )}>
      <div className="p-3 border-b border-border space-y-2">
        <Button onClick={onNew} className="w-full justify-start gap-2" variant="default">
          <Plus className="h-4 w-4" /> Nova conversa
        </Button>
        <Button onClick={onNewFolder} className="w-full justify-start gap-2" variant="outline" size="sm">
          <FolderPlus className="h-3.5 w-3.5" /> Nova pasta
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {folders.length === 0 && threads.length === 0 && (
          <div className="text-xs text-muted-foreground p-3">Nenhuma conversa ainda.</div>
        )}

        {folders.map((f) => {
          const inFolder = threads.filter((t) => t.folder_id === f.id);
          return (
            <FolderItem
              key={f.id}
              folder={f}
              onRename={(name) => onRenameFolder(f.id, name)}
              onDelete={() => onDeleteFolder(f.id)}
              onSetColor={(c) => onSetFolderColor(f.id, c)}
              onAddThread={() => onAddThreadInFolder(f.id)}
            >
              {inFolder.length === 0 ? (
                <div className="text-[11px] text-muted-foreground px-3 py-1.5 italic">Vazio</div>
              ) : (
                inFolder.map((t) => (
                  <ThreadItem
                    key={t.id}
                    thread={t}
                    active={activeId === t.id}
                    folders={folders}
                    onSelect={() => onSelect(t.id)}
                    onRename={(title) => onRenameThread(t.id, title)}
                    onDelete={() => onDeleteThread(t.id)}
                    onMove={(folderId) => onMoveThread(t.id, folderId)}
                  />
                ))
              )}
            </FolderItem>
          );
        })}

        {ungrouped.length > 0 && (
          <div className="space-y-0.5 pt-1">
            {folders.length > 0 && (
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">
                Sem pasta
              </div>
            )}
            {ungrouped.map((t) => (
              <ThreadItem
                key={t.id}
                thread={t}
                active={activeId === t.id}
                folders={folders}
                onSelect={() => onSelect(t.id)}
                onRename={(title) => onRenameThread(t.id, title)}
                onDelete={() => onDeleteThread(t.id)}
                onMove={(folderId) => onMoveThread(t.id, folderId)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function MessagePart({ part }: { part: any }) {
  if (part.type === 'text') {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:mt-3 prose-headings:mb-2 prose-pre:bg-muted prose-pre:text-foreground">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
      </div>
    );
  }
  if (part.type?.startsWith('tool-')) {
    const toolName = part.type.replace('tool-', '');
    if (toolName === 'suggest_actions') {
      const output = part.output;
      const state = part.state;
      if (state !== 'output-available' || !output?.actions) {
        return (
          <div className="my-2 text-xs text-muted-foreground">Preparando sugestões…</div>
        );
      }
      const iconMap: Record<string, any> = {
        calendar: Calendar, users: Users, dollar: DollarSign, file: FileText,
        tooth: Sparkles, settings: SettingsIcon, sparkles: Sparkles,
        message: MessageSquare, map: MapPin, clock: Clock, plus: Plus, edit: Edit,
      };
      return (
        <div className="my-2 space-y-2">
          {output.intro && <p className="text-sm text-foreground">{output.intro}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {output.actions.map((a: any, i: number) => {
              const Icon = iconMap[a.icon] ?? ArrowRight;
              return (
                <Link
                  key={i}
                  to={a.route}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/40 transition-all px-3 py-2.5 text-left"
                >
                  <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{a.label}</div>
                    {a.description && (
                      <div className="text-xs text-muted-foreground line-clamp-2">{a.description}</div>
                    )}
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                </Link>
              );
            })}
          </div>
        </div>
      );
    }
    if (toolName === 'generate_image') {
      const state = part.state;
      const output = part.output;
      if (state === 'output-available' && output?.imageUrl) {
        return (
          <div className="my-2 space-y-2">
            <img src={output.imageUrl} alt={output.prompt || 'imagem gerada'} className="rounded-lg border border-border max-w-full" />
            <a href={output.imageUrl} download="imagem-ia-gestor.png" target="_blank" rel="noreferrer"
               className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
              <Download className="h-3 w-3" /> Baixar imagem
            </a>
          </div>
        );
      }
      if (state === 'output-available' && output?.error) {
        return <div className="text-xs text-destructive">Erro ao gerar imagem: {output.error}</div>;
      }
      return (
        <div className="my-2 flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 border border-border">
          <ImageIcon className="h-3.5 w-3.5 animate-pulse" /> Gerando imagem…
        </div>
      );
    }
  }
  return null;
}

function ChatView({ threadId, clinicId, initialMessages, onOpenMenu }: { threadId: string; clinicId: string; initialMessages: UIMessage[]; onOpenMenu?: () => void }) {
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(() => new DefaultChatTransport({
    api: FN_URL,
    prepareSendMessagesRequest: async ({ messages, body }) => {
      const { data } = await supabase.auth.getSession();
      return {
        body: { messages, threadId, clinicId, ...body },
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` },
      };
    },
  }), [threadId, clinicId]);

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onFinish: () => {
      qc.invalidateQueries({ queryKey: ['ia-threads'] });
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    onError: (e) => {
      toast.error(e.message || 'Erro ao enviar mensagem');
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, status]);

  useEffect(() => { inputRef.current?.focus(); }, [threadId]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || status === 'submitted' || status === 'streaming') return;
    setInput('');

    // Auto-update thread title with first user message
    if (messages.length === 0) {
      await supabase.from('ia_gestor_threads').update({ title: text.slice(0, 60) }).eq('id', threadId);
      qc.invalidateQueries({ queryKey: ['ia-threads'] });
    }
    sendMessage({ text });
  };

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      {/* Topbar mobile: abre a lista de conversas */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 md:hidden">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenMenu} aria-label="Conversas">
          <PanelLeft className="h-4 w-4" />
        </Button>
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Brain className="h-4 w-4 text-primary" /> IA Gestor
        </span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-8">
                No que você está pensando hoje?
              </h2>
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2 px-1 -mx-1 snap-x scrollbar-thin md:justify-center md:flex-wrap md:overflow-visible">
                {['Quantos pacientes temos?', 'Quais consultas são amanhã?', 'Faturamento dos últimos 30 dias', 'Crie um post para o Instagram'].map((s) => (
                  <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    className="flex-shrink-0 snap-start text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={cn('flex gap-3', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              {m.role === 'assistant' && (
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Brain className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className={cn(
                'max-w-[85%]',
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5'
                  : 'text-foreground'
              )}>
                {(m.parts ?? []).map((p, i) => <MessagePart key={i} part={p} />)}
              </div>
            </div>
          ))}

          {(status === 'submitted' || status === 'streaming') && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Brain className="h-4 w-4 text-primary animate-pulse" />
              </div>
              <div className="flex items-center gap-1 pt-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0.15s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0.3s]" />
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error.message}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border bg-background/80 backdrop-blur-sm p-3 md:p-4">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder="Pergunte algo sobre a clínica…"
            rows={1}
            className="resize-none min-h-[44px] max-h-40 flex-1"
            disabled={status === 'submitted' || status === 'streaming'}
          />
          <Button onClick={handleSend} size="icon" className="h-11 w-11 flex-shrink-0"
            disabled={!input.trim() || status === 'submitted' || status === 'streaming'}>
            {status === 'submitted' || status === 'streaming'
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function IaGestor() {
  const { threadId } = useParams<{ threadId?: string }>();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, currentClinicId } = useAuth();
  const qc = useQueryClient();

  const { data: threads = [], isLoading: threadsLoading } = useQuery({
    queryKey: ['ia-threads', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ia_gestor_threads')
        .select('id, title, updated_at, folder_id')
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ThreadRow[];
    },
  });

  const { data: folders = [] } = useQuery({
    queryKey: ['ia-folders', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ia_gestor_folders')
        .select('id, name, color')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FolderRow[];
    },
  });

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Bootstrap: choose or create thread (só roda 1 vez quando entra na rota /ia-gestor sem threadId)
  const bootstrappedRef = useRef(false);
  useEffect(() => {
    if (bootstrappedRef.current) return;
    if (!user?.id || threadsLoading) return;
    if (threadId) {
      bootstrappedRef.current = true;
      return;
    }
    bootstrappedRef.current = true;
    if (threads.length > 0) {
      if (!isMountedRef.current) return;
      navigate(`/ia-gestor/${threads[0].id}`, { replace: true });
    } else {
      (async () => {
        const { data, error } = await supabase
          .from('ia_gestor_threads')
          .insert({ user_id: user.id, clinic_id: currentClinicId, title: 'Nova conversa' })
          .select('id')
          .single();
        if (error) { toast.error('Erro ao criar conversa'); return; }
        if (!isMountedRef.current) return;
        qc.invalidateQueries({ queryKey: ['ia-threads'] });
        navigate(`/ia-gestor/${data.id}`, { replace: true });
      })();
    }
  }, [user?.id, threadId, threads, threadsLoading, navigate, currentClinicId, qc]);

  const createThread = async (folderId: string | null = null) => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('ia_gestor_threads')
      .insert({ user_id: user.id, clinic_id: currentClinicId, title: 'Nova conversa', folder_id: folderId } as any)
      .select('id')
      .single();
    if (error) { toast.error('Erro ao criar conversa'); return; }
    qc.invalidateQueries({ queryKey: ['ia-threads'] });
    navigate(`/ia-gestor/${data.id}`);
  };
  const handleNew = () => createThread(null);
  const handleAddThreadInFolder = (folderId: string) => createThread(folderId);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('ia_gestor_threads').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    qc.invalidateQueries({ queryKey: ['ia-threads'] });
    if (threadId === id) navigate('/ia-gestor', { replace: true });
  };

  const handleRenameThread = async (id: string, title: string) => {
    const { error } = await supabase.from('ia_gestor_threads').update({ title }).eq('id', id);
    if (error) { toast.error('Erro ao renomear'); return; }
    qc.invalidateQueries({ queryKey: ['ia-threads'] });
  };

  const handleMoveThread = async (id: string, folderId: string | null) => {
    const { error } = await (supabase as any).from('ia_gestor_threads').update({ folder_id: folderId }).eq('id', id);
    if (error) { toast.error('Erro ao mover'); return; }
    qc.invalidateQueries({ queryKey: ['ia-threads'] });
    toast.success(folderId ? 'Movida para pasta' : 'Removida da pasta');
  };

  const handleNewFolder = async () => {
    if (!user?.id) return;
    const { error } = await (supabase as any).from('ia_gestor_folders').insert({
      user_id: user.id, clinic_id: currentClinicId, name: 'Nova pasta', color: 'rose',
    });
    if (error) { toast.error('Erro ao criar pasta'); return; }
    qc.invalidateQueries({ queryKey: ['ia-folders'] });
  };

  const handleRenameFolder = async (id: string, name: string) => {
    const { error } = await (supabase as any).from('ia_gestor_folders').update({ name }).eq('id', id);
    if (error) { toast.error('Erro ao renomear pasta'); return; }
    qc.invalidateQueries({ queryKey: ['ia-folders'] });
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm('Excluir esta pasta? As conversas não serão apagadas.')) return;
    const { error } = await (supabase as any).from('ia_gestor_folders').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir pasta'); return; }
    qc.invalidateQueries({ queryKey: ['ia-folders'] });
    qc.invalidateQueries({ queryKey: ['ia-threads'] });
  };

  const handleSetFolderColor = async (id: string, color: string) => {
    const { error } = await (supabase as any).from('ia_gestor_folders').update({ color }).eq('id', id);
    if (error) { toast.error('Erro ao mudar cor'); return; }
    qc.invalidateQueries({ queryKey: ['ia-folders'] });
  };

  // Load messages for active thread
  const { data: initialMessages = [], isLoading: msgsLoading } = useQuery({
    queryKey: ['ia-messages', threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ia_gestor_messages')
        .select('id, role, parts, content, sdk_message_id, created_at')
        .eq('thread_id', threadId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((m: any) => ({
        id: m.sdk_message_id || m.id,
        role: m.role,
        parts: Array.isArray(m.parts) && m.parts.length > 0 ? m.parts : [{ type: 'text', text: m.content || '' }],
      } as UIMessage));
    },
  });

  if (!currentClinicId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Selecione uma clínica para usar o IA Gestor.
      </div>
    );
  }

  const sidebarProps = {
    threads,
    folders,
    activeId: threadId,
    onNew: () => { setMobileMenuOpen(false); handleNew(); },
    onNewFolder: handleNewFolder,
    onSelect: (id: string) => { setMobileMenuOpen(false); navigate(`/ia-gestor/${id}`); },
    onRenameThread: handleRenameThread,
    onDeleteThread: handleDelete,
    onMoveThread: handleMoveThread,
    onRenameFolder: handleRenameFolder,
    onDeleteFolder: handleDeleteFolder,
    onSetFolderColor: handleSetFolderColor,
    onAddThreadInFolder: handleAddThreadInFolder,
  };

  return (
    <div className="flex flex-1 min-h-0 rounded-lg overflow-hidden border border-border bg-background">
      {/* Sidebar desktop */}
      <Sidebar {...sidebarProps} variant="desktop" />

      {/* Sidebar mobile dentro de um Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-xs p-0">
          <Sidebar {...sidebarProps} variant="sheet" />
        </SheetContent>
      </Sheet>

      {threadId && !msgsLoading ? (
        <ChatView
          key={threadId}
          threadId={threadId}
          clinicId={currentClinicId}
          initialMessages={initialMessages}
          onOpenMenu={() => setMobileMenuOpen(true)}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}