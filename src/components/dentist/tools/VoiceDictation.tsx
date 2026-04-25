import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Copy, Save, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface VoiceDictationProps {
  clinicalRecordId?: string | null;
}

export function VoiceDictation({ clinicalRecordId }: VoiceDictationProps = {}) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const r = new SR();
    r.lang = 'pt-BR';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (event: any) => {
      let finalT = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalT += event.results[i][0].transcript + ' ';
      }
      if (finalT) setText((prev) => prev + finalT);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recognitionRef.current = r;
    return () => { try { r.stop(); } catch {} };
  }, []);

  const toggle = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch {
        toast.error('Não consegui iniciar o microfone.');
      }
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  const appendToRecord = async () => {
    if (!clinicalRecordId || !text.trim()) return;
    try {
      const { data } = await supabase.from('clinical_records').select('notes').eq('id', clinicalRecordId).maybeSingle();
      const newNotes = [data?.notes, text].filter(Boolean).join('\n');
      await supabase.from('clinical_records').update({ notes: newNotes }).eq('id', clinicalRecordId);
      toast.success('Adicionado ao prontuário.');
      setText('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.');
    }
  };

  if (!supported) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Seu navegador não suporta ditado por voz. Use Chrome, Edge ou Safari recente.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <button
          onClick={toggle}
          className={cn(
            'h-28 w-28 rounded-full flex items-center justify-center transition-all',
            listening
              ? 'bg-destructive text-destructive-foreground animate-pulse shadow-lg shadow-destructive/30'
              : 'bg-primary text-primary-foreground hover:scale-105 shadow-lg shadow-primary/20'
          )}
        >
          {listening ? <MicOff className="h-12 w-12" /> : <Mic className="h-12 w-12" />}
        </button>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        {listening ? 'Ouvindo... fale agora' : 'Toque no microfone e fale'}
      </p>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="O texto aparecerá aqui..."
      />

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={copy} disabled={!text.trim()} className="gap-2">
          <Copy className="h-4 w-4" /> Copiar
        </Button>
        <Button onClick={appendToRecord} disabled={!text.trim() || !clinicalRecordId} className="gap-2">
          <Save className="h-4 w-4" /> Anexar prontuário
        </Button>
      </div>
      {!clinicalRecordId && (
        <p className="text-[11px] text-center text-muted-foreground">
          Abra o ditado dentro de um atendimento para anexar direto ao prontuário.
        </p>
      )}
    </div>
  );
}