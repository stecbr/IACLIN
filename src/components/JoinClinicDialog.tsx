import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle2, Circle, KeyRound, Loader2, LogIn } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface JoinClinicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JoinClinicDialog({ open, onOpenChange }: JoinClinicDialogProps) {
  const { refreshClinics, user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [missingProfileFields, setMissingProfileFields] = useState<string[]>([]);

  const normalized = code.trim().toUpperCase();
  const valid = /^CLIN-[A-Z0-9]{8}$/.test(normalized);
  const hasMissingProfileData = missingProfileFields.length > 0;

  useEffect(() => {
    if (!open || !user?.id) return;

    const loadRequiredProfileStatus = async () => {
      setCheckingProfile(true);
      try {
        const [{ data: profile }, { data: specialties }, { data: memberWithReg }] = await Promise.all([
          supabase
            .from('profiles')
            .select('full_name, phone, avatar_url')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('professional_specialties' as any)
            .select('specialty, is_primary')
            .eq('user_id', user.id)
            .order('is_primary', { ascending: false })
            .limit(1),
          supabase
            .from('clinic_members')
            .select('specialty, registration_number')
            .eq('user_id', user.id)
            .not('registration_number', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
        const metaSpecialty = typeof metadata.specialty === 'string' ? metadata.specialty.trim() : '';
        const metaRegistration = typeof metadata.registration_number === 'string' ? metadata.registration_number.trim() : '';

        const resolvedSpecialty = ((specialties as any)?.[0]?.specialty ?? (memberWithReg as any)?.specialty ?? metaSpecialty) || null;
        const resolvedRegistration = ((memberWithReg as any)?.registration_number ?? metaRegistration) || null;

        const missing: string[] = [];
        if (!(profile as any)?.full_name?.trim?.()) missing.push('nome completo');
        if (!(profile as any)?.phone?.trim?.()) missing.push('telefone');
        if (!(profile as any)?.avatar_url?.trim?.()) missing.push('foto de perfil');
        if (!resolvedSpecialty) missing.push('especialidade');
        if (!resolvedRegistration) missing.push('registro profissional');
        setMissingProfileFields(missing);
      } catch {
        // Keep UI usable in case profile pre-check fails.
        setMissingProfileFields([]);
      } finally {
        setCheckingProfile(false);
      }
    };

    loadRequiredProfileStatus();
  }, [open, user?.id]);

  const requiredItems = useMemo(
    () => ['nome completo', 'telefone', 'foto de perfil', 'especialidade', 'registro profissional'],
    [],
  );

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
      await refreshClinics();
      onOpenChange(false);
    } catch (err: any) {
      toast(err?.message || 'Erro inesperado');
    } finally {
      setJoining(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> Vincular nova clínica
          </DialogTitle>
          <DialogDescription>
            Peça à clínica o código de convite (formato <code className="font-mono">CLIN-XXXXXXXX</code>) e cole abaixo para entrar como profissional.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">Dados obrigatórios para vincular:</p>
            <div className="space-y-1">
              {requiredItems.map((item) => {
                const isMissing = missingProfileFields.includes(item);
                return (
                  <div key={item} className="flex items-center gap-2 text-xs">
                    {isMissing ? (
                      <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                    <span className={isMissing ? 'text-muted-foreground' : 'text-foreground'}>{item}</span>
                  </div>
                );
              })}
            </div>
            {checkingProfile ? (
              <p className="text-[11px] text-muted-foreground">Verificando seu perfil...</p>
            ) : hasMissingProfileData ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Complete seu perfil para liberar o vínculo.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    onOpenChange(false);
                    navigate('/perfil');
                  }}
                >
                  Ir para perfil
                </Button>
              </div>
            ) : (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">Perfil completo para vinculação.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="join-invite-code">Código de convite</Label>
            <Input
              id="join-invite-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CLIN-XXXXXXXX"
              className="font-mono uppercase tracking-wider"
              autoComplete="off"
              autoFocus
            />
          </div>
          <Button onClick={handleJoin} disabled={!valid || joining || checkingProfile || hasMissingProfileData} className="w-full gap-2">
            {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {joining ? 'Entrando…' : 'Entrar na clínica'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}