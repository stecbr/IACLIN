import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Building2, UserCircle, KeyRound, LogIn, Loader2, CheckCircle2,
  Circle, ArrowLeft, Clock, Sparkles,
} from 'lucide-react';

type Step = 'choice' | 'clinic' | 'plans';

const DISMISS_KEY = 'iaclin.subOnboardingDismissed';

function fmtPrice(cents: number, cycle: string) {
  const v = (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const label = cycle === 'monthly' ? '/mês' : cycle === 'yearly' ? '/ano' : '';
  return `${v}${label}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

function ClinicStep({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const { user, refreshClinics } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  const normalized = code.trim().toUpperCase();
  const valid = /^CLIN-[A-Z0-9]{8}$/.test(normalized);
  const hasMissing = missingFields.length > 0;

  const REQUIRED = useMemo(
    () => ['nome completo', 'telefone', 'foto de perfil', 'especialidade', 'registro profissional'],
    [],
  );

  useEffect(() => {
    if (!user?.id) return;
    setCheckingProfile(true);
    (async () => {
      try {
        const [{ data: profile }, { data: specialties }, { data: memberWithReg }] = await Promise.all([
          supabase.from('profiles').select('full_name, phone, avatar_url').eq('id', user.id).maybeSingle(),
          supabase.from('professional_specialties' as any).select('specialty').eq('user_id', user.id).limit(1),
          supabase.from('clinic_members').select('specialty, registration_number')
            .eq('user_id', user.id).not('registration_number', 'is', null).limit(1).maybeSingle(),
        ]);
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const hasSpecialty = !!(
          (specialties as any)?.[0]?.specialty ||
          (memberWithReg as any)?.specialty ||
          (typeof meta.specialty === 'string' && meta.specialty.trim())
        );
        const hasReg = !!(
          (memberWithReg as any)?.registration_number ||
          (typeof meta.registration_number === 'string' && meta.registration_number.trim())
        );
        const p = profile as any;
        const missing: string[] = [];
        if (!p?.full_name?.trim()) missing.push('nome completo');
        if (!p?.phone?.trim()) missing.push('telefone');
        if (!p?.avatar_url?.trim()) missing.push('foto de perfil');
        if (!hasSpecialty) missing.push('especialidade');
        if (!hasReg) missing.push('registro profissional');
        setMissingFields(missing);
      } catch {
        setMissingFields([]);
      } finally {
        setCheckingProfile(false);
      }
    })();
  }, [user?.id]);

  const handleJoin = async () => {
    if (!valid) return;
    setJoining(true);
    try {
      const { data, error } = await supabase.functions.invoke('join-clinic-by-code', {
        body: { code: normalized },
      });
      if (error || data?.error) {
        if (data?.code === 'PROFILE_INCOMPLETE') {
          toast.error(data.error || 'Complete seu perfil antes de entrar na clínica.');
        } else {
          toast.error(data?.error || error?.message || 'Não foi possível vincular.');
        }
        return;
      }
      toast.success('Vínculo criado com sucesso!');
      await refreshClinics();
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message || 'Erro inesperado');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="space-y-4 pt-2">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar
      </button>

      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
        <p className="text-xs font-medium">Dados obrigatórios para vincular:</p>
        <div className="space-y-1">
          {REQUIRED.map((item) => {
            const missing = missingFields.includes(item);
            return (
              <div key={item} className="flex items-center gap-2 text-xs">
                {missing
                  ? <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                  : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                <span className={missing ? 'text-muted-foreground' : 'text-foreground'}>{item}</span>
              </div>
            );
          })}
        </div>
        {checkingProfile ? (
          <p className="text-[11px] text-muted-foreground">Verificando seu perfil...</p>
        ) : hasMissing ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              Complete seu perfil para liberar o vínculo.
            </p>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
              onClick={() => { navigate('/perfil'); }}>
              Ir para perfil
            </Button>
          </div>
        ) : (
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400">Perfil completo para vinculação.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="onboarding-clinic-code">Código da clínica</Label>
        <Input
          id="onboarding-clinic-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="CLIN-XXXXXXXX"
          className="font-mono uppercase tracking-wider"
          autoComplete="off"
        />
        <p className="text-[11px] text-muted-foreground">
          Peça o código ao responsável da clínica que irá te vincular.
        </p>
      </div>

      <Button
        onClick={handleJoin}
        disabled={!valid || joining || checkingProfile || hasMissing}
        className="w-full gap-2"
      >
        {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        {joining ? 'Entrando…' : 'Entrar na clínica'}
      </Button>
    </div>
  );
}

function PlansStep({ onBack, onDismiss }: { onBack: () => void; onDismiss: () => void }) {
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['platform-plans-doctor'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('platform_plans')
        .select('id, name, price_cents, billing_cycle, features')
        .eq('segment', 'doctor')
        .eq('active', true)
        .order('price_cents', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4 pt-2">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar
      </button>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-start gap-3">
        <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          A contratação direta estará disponível em breve. Por enquanto, entre em contato conosco pelo
          suporte para ativar seu plano.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Planos em breve...
        </div>
      ) : (
        <div className="grid gap-3">
          {(plans as any[]).map((plan) => (
            <div key={plan.id} className="relative rounded-xl border border-border p-4 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{plan.name}</p>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
                    <Sparkles className="h-2.5 w-2.5" /> Em breve
                  </Badge>
                </div>
                <p className="text-lg font-bold text-primary tabular-nums mt-0.5">
                  {fmtPrice(plan.price_cents, plan.billing_cycle)}
                </p>
                {Array.isArray(plan.features) && plan.features.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {(plan.features as string[]).map((f) => (
                      <li key={f} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Button disabled variant="outline" size="sm" className="shrink-0">
                Contratar
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button variant="ghost" size="sm" onClick={onDismiss} className="w-full text-xs text-muted-foreground">
        Continuar sem plano por enquanto
      </Button>
    </div>
  );
}

export function SubscriptionOnboardingModal({ open, onClose }: Props) {
  const [step, setStep] = useState<Step>('choice');

  useEffect(() => {
    if (open) setStep('choice');
  }, [open]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-5 w-5 text-primary" />
            {step === 'choice' && 'Como você vai usar o IACLIN?'}
            {step === 'clinic' && 'Vincular a uma clínica'}
            {step === 'plans' && 'Planos para profissionais'}
          </DialogTitle>
          {step === 'choice' && (
            <DialogDescription>
              Escolha como deseja usar a plataforma. Você pode mudar isso mais tarde.
            </DialogDescription>
          )}
        </DialogHeader>

        {step === 'choice' && (
          <div className="space-y-3 pt-2">
            <button
              onClick={() => setStep('clinic')}
              className="w-full rounded-xl border border-border bg-card hover:bg-muted/40 hover:border-primary/40 transition-colors p-4 text-left group"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Estou vinculado a uma clínica</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    A clínica já usa o IACLIN e vai cobrir minha assinatura. Vou inserir o
                    código de convite para me vincular.
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setStep('plans')}
              className="w-full rounded-xl border border-border bg-card hover:bg-muted/40 hover:border-primary/40 transition-colors p-4 text-left group"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <UserCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Sou autônomo / tenho minha própria clínica</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Trabalho de forma independente e quero contratar meu próprio plano.
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={handleDismiss}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              Decidir depois
            </button>
          </div>
        )}

        {step === 'clinic' && (
          <ClinicStep
            onBack={() => setStep('choice')}
            onSuccess={onClose}
          />
        )}

        {step === 'plans' && (
          <PlansStep
            onBack={() => setStep('choice')}
            onDismiss={handleDismiss}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export { DISMISS_KEY as SUB_ONBOARDING_DISMISS_KEY };
