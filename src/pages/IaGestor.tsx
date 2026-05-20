import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Brain, Plus, Trash2, Send, Loader2, MessageSquare, Download, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const FN_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/gestor-ia-chat`;

type ThreadRow = { id: string; title: string; updated_at: string };

function ThreadList({ threads, activeId, onNew, onSelect, onDelete }: {
  threads: ThreadRow[]; activeId?: string;
  onNew: () => void; onSelect: (id: string) => void; onDelete: (id: string) => void;
}) {
  return (
    <aside className="hidden md:flex w-64 flex-col border-r border-border bg-muted/20 h-full">
      <div className="p-3 border-b border-border">
        <Button onClick={onNew} className="w-full justify-start gap-2" variant="default">
          <Plus className="h-4 w-4" /> Nova conversa
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {threads.length === 0 && (
          <div className="text-xs text-muted-foreground p-3">Nenhuma conversa ainda.</div>
        )}
        {threads.map((t) => (
          <div
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={cn(
              'group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors',
              activeId === t.id ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
          >
            <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="flex-1 truncate">{t.title}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
              aria-label="Excluir"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
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

function ChatView({ threadId, clinicId, initialMessages }: { threadId: string; clinicId: string; initialMessages: UIMessage[] }) {
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
  const { user, currentClinicId } = useAuth();
  const qc = useQueryClient();

  const { data: threads = [], isLoading: threadsLoading } = useQuery({
    queryKey: ['ia-threads', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ia_gestor_threads')
        .select('id, title, updated_at')
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ThreadRow[];
    },
  });

  // Bootstrap: choose or create thread
  useEffect(() => {
    if (!user?.id || threadsLoading) return;
    if (threadId) {
      // ensure thread exists in list (could be a fresh one not yet loaded)
      return;
    }
    if (threads.length > 0) {
      navigate(`/ia-gestor/${threads[0].id}`, { replace: true });
    } else {
      // create first thread
      (async () => {
        const { data, error } = await supabase
          .from('ia_gestor_threads')
          .insert({ user_id: user.id, clinic_id: currentClinicId, title: 'Nova conversa' })
          .select('id')
          .single();
        if (error) { toast.error('Erro ao criar conversa'); return; }
        qc.invalidateQueries({ queryKey: ['ia-threads'] });
        navigate(`/ia-gestor/${data.id}`, { replace: true });
      })();
    }
  }, [user?.id, threadId, threads, threadsLoading, navigate, currentClinicId, qc]);

  const handleNew = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('ia_gestor_threads')
      .insert({ user_id: user.id, clinic_id: currentClinicId, title: 'Nova conversa' })
      .select('id')
      .single();
    if (error) { toast.error('Erro ao criar conversa'); return; }
    qc.invalidateQueries({ queryKey: ['ia-threads'] });
    navigate(`/ia-gestor/${data.id}`);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('ia_gestor_threads').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    qc.invalidateQueries({ queryKey: ['ia-threads'] });
    if (threadId === id) navigate('/ia-gestor', { replace: true });
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

  return (
    <div className="flex h-[calc(100vh-12rem)] md:h-[calc(100vh-8rem)] -m-4 md:-m-6 rounded-none overflow-hidden border-t border-border bg-background">
      <ThreadList
        threads={threads}
        activeId={threadId}
        onNew={handleNew}
        onSelect={(id) => navigate(`/ia-gestor/${id}`)}
        onDelete={handleDelete}
      />
      {threadId && !msgsLoading ? (
        <ChatView key={threadId} threadId={threadId} clinicId={currentClinicId} initialMessages={initialMessages} />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}