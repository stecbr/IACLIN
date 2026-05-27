import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Settings, Lock, User, ShieldCheck,
  Eye, EyeOff, Save, Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ThemeCustomizer } from '@/components/settings/ThemeCustomizer';

// ---- Troca de senha ----
function ChangePasswordSection() {
  const [currentPwd,  setCurrentPwd]  = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [saving,      setSaving]      = useState(false);

  const handleSave = async () => {
    if (newPwd.length < 6) { toast.error('A nova senha deve ter pelo menos 6 caracteres.'); return; }
    if (newPwd !== confirmPwd) { toast.error('As senhas não coincidem.'); return; }
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const email = sessionData.session?.user?.email ?? '';
      const { error: checkErr } = await supabase.auth.signInWithPassword({ email, password: currentPwd });
      if (checkErr) { toast.error('Senha atual incorreta.'); return; }
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      toast.success('Senha alterada com sucesso!');
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (err: any) {
      toast.error('Erro ao alterar senha: ' + (err?.message ?? 'Desconhecido'));
    } finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4 text-primary" /> Alterar Senha
        </CardTitle>
        <CardDescription>Atualize a senha de acesso ao painel do Super Admin.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Senha atual</Label>
          <div className="relative">
            <Input type={showCurrent ? 'text' : 'password'} value={currentPwd}
              onChange={e => setCurrentPwd(e.target.value)} placeholder="••••••••" className="pr-10" />
            <button type="button" onClick={() => setShowCurrent(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Nova senha</Label>
          <div className="relative">
            <Input type={showNew ? 'text' : 'password'} value={newPwd}
              onChange={e => setNewPwd(e.target.value)} placeholder="Mínimo 6 caracteres" className="pr-10" />
            <button type="button" onClick={() => setShowNew(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Confirmar nova senha</Label>
          <Input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="Repita a nova senha" />
          {confirmPwd && newPwd !== confirmPwd && <p className="text-xs text-red-500">As senhas não coincidem.</p>}
        </div>
        <Button onClick={handleSave} disabled={saving || !currentPwd || !newPwd || !confirmPwd} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar nova senha'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---- Informações da conta ----
function AccountInfoSection() {
  const { user } = useAuth();
  const createdAt  = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';
  const lastSignIn = (user as any)?.last_sign_in_at
    ? new Date((user as any).last_sign_in_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4 text-primary" /> Conta do Administrador
        </CardTitle>
        <CardDescription>Informações do acesso ao painel da plataforma.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">E-mail</p>
            <p className="text-sm font-medium">{user?.email ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">ID do usuário</p>
            <p className="text-sm font-mono text-muted-foreground truncate">{user?.id ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Conta criada em</p>
            <p className="text-sm">{createdAt}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Último acesso</p>
            <p className="text-sm">{lastSignIn}</p>
          </div>
        </div>
        <Separator />
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Nível de acesso</span>
          <Badge className="ml-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
            Super Admin da Plataforma
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Esta conta tem acesso exclusivo à administração da plataforma IACLIN.
          Ela <strong>não tem acesso</strong> ao conteúdo clínico (prontuários, consultas, dados de pacientes).
        </p>
      </CardContent>
    </Card>
  );
}

// ---- Sobre a plataforma ----
function AboutSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Info className="h-4 w-4 text-primary" /> Sobre a Plataforma
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Nome</p>
            <p className="font-medium">IACLIN</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Projeto Supabase</p>
            <p className="font-mono text-muted-foreground text-xs">fwyulywxhjyxdreeuqna</p>
          </div>
        </div>
        <Separator />
        <div className="flex flex-wrap gap-2">
          <a href="https://supabase.com/dashboard/project/fwyulywxhjyxdreeuqna" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="text-xs">Painel Supabase</Button>
          </a>
          <a href="https://supabase.com/dashboard/project/fwyulywxhjyxdreeuqna/auth/users" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="text-xs">Gerenciar usuários</Button>
          </a>
          <a href="https://supabase.com/dashboard/project/fwyulywxhjyxdreeuqna/sql/new" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="text-xs">SQL Editor</Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

// ================================================================
export default function SuperAdminSettings() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" /> Configurações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Personalize o painel e gerencie a segurança do Super Admin.
        </p>
      </div>

      {/* ── Personalização visual (igual clínicas/médicos/pacientes) ── */}
      <ThemeCustomizer />

      <AccountInfoSection />
      <ChangePasswordSection />
      <AboutSection />
    </div>
  );
}
