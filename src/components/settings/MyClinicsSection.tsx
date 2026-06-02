import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Building2, KeyRound, LogIn, LogOut, Crown, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  dentist: 'Profissional',
  secretary: 'Secretária',
};

export default function MyClinicsSection() {
  const { user, clinics, currentClinicId, switchClinic, refreshClinics } = useAuth();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [leavingId, setLeavingId] = useState<string | null>(null);

  const normalized = code.trim().toUpperCase();
  const valid = /^CLIN-[A-Z0-9]{8}$/.test(normalized);

  const handleJoin = async () => {
    if (!valid) {
      toast('Formato inválido. Use CLIN-XXXXXXXX.');
      return;
    }
    setJoining(true);
    try {
      const { data, error } = await supabase.functions.invoke('join-clinic-by-code', {
        body: { code: normalized },
      });
      if (error || (data && data.error)) {
        if (data?.code === 'PROFILE_INCOMPLETE') {
          toast.error(data.error || 'Complete seu perfil (nome, telefone, foto, especialidade e registro) antes de entrar na clínica.');
          return;
        }
        toast(data?.error || error?.message || 'Não foi possível vincular.');
        return;
      }
      toast.success('Vínculo criado!');
      setCode('');
      await refreshClinics();
    } catch (err: any) {
      toast(err?.message || 'Erro inesperado');
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async (clinicId: string, isOwner: boolean) => {
    if (!user || isOwner) return;
    if (!confirm('Deseja sair desta clínica? Você perderá acesso à agenda e pacientes dela.')) return;
    setLeavingId(clinicId);
    try {
      const { error } = await supabase
        .from('clinic_members')
        .delete()
        .eq('user_id', user.id)
        .eq('clinic_id', clinicId);
      if (error) throw error;
      toast.success('Você saiu da clínica.');
      await refreshClinics();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLeavingId(null);
    }
  };

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Clínicas em que atendo
        </CardTitle>
        <CardDescription>
          Gerencie os vínculos com clínicas. Use um código de convite para entrar em uma nova.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          {clinics.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma clínica vinculada ainda.
            </p>
          ) : (
            clinics.map((c) => {
              const isCurrent = c.clinic_id === currentClinicId;
              return (
                <div
                  key={c.clinic_id}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                    isCurrent ? 'border-primary/40 bg-primary/5' : 'border-border/60 bg-background'
                  }`}
                >
                  <div className="h-10 w-10 rounded-lg bg-muted text-muted-foreground flex items-center justify-center font-medium flex-shrink-0">
                    {c.clinic_name?.[0]?.toUpperCase() ?? 'C'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{c.clinic_name}</p>
                      {c.is_owner && (
                        <Badge variant="secondary" className="gap-1 text-[10px] h-5">
                          <Crown className="h-3 w-3 text-amber-500" /> Proprietário
                        </Badge>
                      )}
                      {isCurrent && (
                        <Badge variant="outline" className="text-[10px] h-5">Ativa</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {roleLabels[c.role] ?? c.role}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!isCurrent && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5"
                        onClick={() => switchClinic(c.clinic_id)}
                      >
                        <LogIn className="h-3.5 w-3.5" /> Acessar
                      </Button>
                    )}
                    {!c.is_owner && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={leavingId === c.clinic_id}
                        onClick={() => handleLeave(c.clinic_id, c.is_owner)}
                        title="Sair da clínica"
                      >
                        {leavingId === c.clinic_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <LogOut className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Entrar em outra clínica</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Peça à clínica o código de convite (formato <code className="font-mono">CLIN-XXXXXXXX</code>) e cole abaixo.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="invite-code" className="sr-only">Código</Label>
              <Input
                id="invite-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="CLIN-XXXXXXXX"
                className="font-mono uppercase tracking-wider"
                autoComplete="off"
              />
            </div>
            <Button onClick={handleJoin} disabled={!valid || joining} className="gap-2">
              {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {joining ? 'Entrando…' : 'Entrar'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}