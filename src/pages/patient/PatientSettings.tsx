import { useEffect, useState } from 'react';
import { Loader2, LogOut, Sun, Moon, User, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePatientData } from '@/hooks/usePatientData';
import { ShareMyChartDialog } from '@/components/patient/ShareMyChartDialog';

export default function PatientSettings() {
  const { user, profile, signOut } = useAuth();
  const { account, loading, refetch } = usePatientData();
  const { resolved, setTheme } = useTheme();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [saving, setSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (account) {
      setFullName(account.full_name ?? '');
      setPhone(account.phone ?? '');
      setDob(account.date_of_birth ?? '');
    }
  }, [account]);

  const save = async () => {
    if (!account || !user) return;
    setSaving(true);
    const [{ error: accErr }, { error: profErr }] = await Promise.all([
      supabase
        .from('patient_accounts')
        .update({
          full_name: fullName,
          phone: phone || null,
          date_of_birth: dob || null,
        })
        .eq('id', account.id),
      supabase.from('profiles').update({ full_name: fullName, phone: phone || null }).eq('id', user.id),
    ]);
    setSaving(false);
    if (accErr || profErr) return toast.error((accErr ?? profErr)!.message);
    toast.success('Perfil atualizado');
    refetch();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie seus dados e preferências.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" /> Dados pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <Label>Data de nascimento</Label>
              <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={user?.email ?? ''} disabled />
          </div>
          <div className="space-y-2">
            <Label>CPF</Label>
            <Input value={account?.cpf ?? ''} disabled className="font-mono" />
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar alterações
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aparência</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Tema</p>
              <p className="text-xs text-muted-foreground">
                {resolved === 'dark' ? 'Modo escuro ativado' : 'Modo claro ativado'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
              className="gap-2"
            >
              {resolved === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {resolved === 'dark' ? 'Claro' : 'Escuro'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Share2 className="h-4 w-4" /> Compartilhar prontuário
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Gere um código temporário para liberar seu prontuário completo para qualquer profissional.
          </p>
          <Button onClick={() => setShareOpen(true)} variant="outline" className="gap-2 flex-shrink-0">
            <Share2 className="h-4 w-4" /> Gerar código
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Sair da conta</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Você precisará entrar novamente para acessar sua área.
          </p>
          <Button variant="destructive" onClick={signOut} className="gap-2">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </CardContent>
      </Card>

      <ShareMyChartDialog open={shareOpen} onOpenChange={setShareOpen} patientName={account?.full_name ?? null} />
    </div>
  );
}
