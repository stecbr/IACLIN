import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, LogOut, Loader2, Sparkles, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import logoLight from '@/assets/logo-light.png';

const CODE_REGEX = /^CLIN-[A-Z2-9]{8}$/;

export default function WaitingClinic() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingOwn, setCreatingOwn] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const valid = CODE_REGEX.test(code.trim());

  const handleCreateOwnClinic = async () => {
    setCreatingOwn(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('create-own-clinic', { body: {} });
      if (fnErr || (data && data.error)) {
        const msg = (data && data.error) || fnErr?.message || 'Não foi possível criar seu consultório.';
        setError(msg);
        toast(msg);
        return;
      }
      toast.success('Consultório criado! Carregando seu painel…');
      setTimeout(() => window.location.assign('/'), 600);
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado');
    } finally {
      setCreatingOwn(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) {
      setError('Formato inválido. Use CLIN-XXXXXXXX.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('join-clinic-by-code', {
        body: { code: code.trim().toUpperCase() },
      });
      if (fnErr || (data && data.error)) {
        const msg = (data && data.error) || fnErr?.message || 'Não foi possível vincular.';
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success('Vínculo criado! Recarregando...');
      // Force AuthContext to refetch
      setTimeout(() => window.location.assign('/'), 600);
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="flex justify-center mb-8">
          <img src={logoLight} alt="IACLIN" className="h-10" />
        </div>

        <div className="text-center mb-6">
          <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Como você vai começar?</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Você pode atender no seu próprio consultório agora ou se vincular a uma clínica.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCreateOwnClinic}
          disabled={creatingOwn}
          className="w-full text-left rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-5 hover:border-primary/50 hover:shadow-md transition-all disabled:opacity-60"
        >
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
              {creatingOwn ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Atender no meu próprio consultório</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Recomendado. Você fica como dono e tem agenda, prontuário e financeiro liberados. Pode convidar uma secretária depois.
              </p>
            </div>
          </div>
        </button>

        {error && (
          <Alert className="mt-4 border-destructive/40 bg-destructive/5">
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">ou</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {!showCode ? (
          <button
            type="button"
            onClick={() => setShowCode(true)}
            className="w-full text-left rounded-2xl border border-border/60 bg-card p-4 hover:border-border hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center flex-shrink-0">
                <KeyRound className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Tenho um código de clínica</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Use o código <span className="font-mono">CLIN-XXXXXXXX</span> que a clínica te enviou.
                </p>
              </div>
            </div>
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-sm">Código da clínica</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => {
                  setError(null);
                  setCode(e.target.value.toUpperCase());
                }}
                placeholder="CLIN-XXXXXXXX"
                className="h-10 font-mono tracking-wider"
                autoFocus
                maxLength={13}
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" className="flex-1 h-10" onClick={() => { setShowCode(false); setCode(''); setError(null); }}>
                Cancelar
              </Button>
              <Button type="submit" variant="outline" className="flex-1 h-10" disabled={!valid || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Vincular'}
              </Button>
            </div>
          </form>
        )}

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={async () => {
              await signOut();
              navigate('/auth', { replace: true });
            }}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </motion.div>
    </div>
  );
}