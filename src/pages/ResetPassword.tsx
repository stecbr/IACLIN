import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, CheckCircle2, ShieldAlert } from 'lucide-react';
import iaclinLogoAsset from '@/assets/iaclin-logo.png.asset.json';
const logoLight = iaclinLogoAsset.url;
const logoDark = iaclinLogoAsset.url;
import { useTheme } from '@/components/ThemeProvider';

type Status = 'checking' | 'ready' | 'invalid' | 'success';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { resolved } = useTheme();
  const logoSrc = resolved === 'dark' ? logoDark : logoLight;

  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Supabase recovery: o link traz tokens no hash (#access_token=...&type=recovery)
  // e o detectSessionInUrl do client cria a sessão automaticamente.
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) {
        setStatus('ready');
      } else {
        // Aguarda um tick caso o cliente ainda esteja processando o hash
        setTimeout(async () => {
          const { data: d2 } = await supabase.auth.getSession();
          if (!mounted) return;
          setStatus(d2.session ? 'ready' : 'invalid');
        }, 600);
      }
    };
    check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setStatus('ready');
      }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      toast.error('As senhas não coincidem.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setStatus('success');
      toast.success('Senha redefinida com sucesso!');
      setTimeout(() => navigate('/', { replace: true }), 1500);
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível redefinir a senha.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex justify-center mb-8">
          <img src={logoSrc} alt="IACLIN" className="h-10" translate="no" />
        </div>

        {status === 'checking' && (
          <div className="text-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
            <p className="mt-3 text-sm text-muted-foreground">Validando link…</p>
          </div>
        )}

        {status === 'invalid' && (
          <div className="text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Link inválido ou expirado</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                O link de recuperação não é mais válido. Solicite um novo a partir da tela de login.
              </p>
            </div>
            <Button asChild className="w-full">
              <Link to="/auth">Voltar para o login</Link>
            </Button>
          </div>
        )}

        {status === 'ready' && (
          <>
            <div className="text-center mb-6">
              <h1 className="text-xl font-semibold text-foreground">Criar nova senha</h1>
              <p className="mt-1 text-sm text-muted-foreground">Defina uma senha segura para sua conta.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoFocus
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground"
                    aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
                    tabIndex={-1}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar senha</Label>
                <Input
                  id="confirm-password"
                  type={show ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="h-10"
                />
                {confirm.length > 0 && confirm !== password && (
                  <p className="text-xs text-destructive">As senhas não coincidem.</p>
                )}
              </div>
              <Button type="submit" className="w-full h-10" disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando…</>
                ) : 'Salvar nova senha'}
              </Button>
            </form>
          </>
        )}

        {status === 'success' && (
          <div className="text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Senha atualizada</h1>
              <p className="mt-1 text-sm text-muted-foreground">Redirecionando…</p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}