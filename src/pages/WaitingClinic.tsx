import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  const valid = CODE_REGEX.test(code.trim());

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
        className="w-full max-w-sm"
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
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Aguardando vínculo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Para começar a atender, informe o código da clínica que você recebeu.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Código da clínica</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => {
                setError(null);
                setCode(e.target.value.toUpperCase());
              }}
              placeholder="CLIN-XXXXXXXX"
              className={`h-10 font-mono tracking-wider ${error ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              autoFocus
              maxLength={13}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <Button type="submit" className="w-full h-10" disabled={!valid || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Vincular à clínica'}
          </Button>
        </form>

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