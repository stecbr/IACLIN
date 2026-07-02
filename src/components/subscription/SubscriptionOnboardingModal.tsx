import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
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
  Circle, ArrowLeft, AlertTriangle, Zap, Star, Crown,
} from 'lucide-react';

type Step = 'choice' | 'clinic' | 'plans' | 'linked';

const IS_TEST_PLAN = (name: string) => name.toLowerCase().includes('teste');

function fmtPrice(cents: number, cycle: string) {
  const v = (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const label = cycle === 'monthly' ? '/mês' : cycle === 'yearly' ? '/ano' : '';
  return `${v}${label}`;
}

const PLAN_CONFIG = [
  { icon: Zap,   gradient: 'from-blue-500/10 to-primary/5',     border: 'border-primary/30',   iconBg: 'bg-primary/10 text-primary' },
  { icon: Star,  gradient: 'from-violet-500/10 to-primary/5',   border: 'border-violet-400/40', iconBg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  { icon: Crown, gradient: 'from-amber-500/10 to-orange-500/5', border: 'border-amber-400/40',  iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
];

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

interface Props {
  open: boolean;
  onClose: () => void;
}

/* ─── Clinic step ─── */
function ClinicStep({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const { user, refreshClinics } = useAuth();
  const navigate = useNavigate();
  const [code, setCode]     = useState('');
  const [joining, setJoining]           = useState(false);
  const [checkingProfile, setChecking]  = useState(false);
  const [missingFields, setMissing]     = useState<string[]>([]);

  const normalized = code.trim().toUpperCase();
  const valid      = /^CLIN-[A-Z0-9]{8}$/.test(normalized);
  const hasMissing = missingFields.length > 0;

  const REQUIRED = useMemo(
    () => ['nome completo', 'telefone', 'foto de perfil', 'especialidade', 'registro profissional'],
    [],
  );

  useEffect(() => {
    if (!user?.id) return;
    setChecking(true);
    (async () => {
      try {
        const [{ data: profile }, { data: specialties }, { data: memberWithReg }] = await Promise.all([
          supabase.from('profiles').select('full_name, phone, avatar_url').eq('id', user.id).maybeSingle(),
          supabase.from('professional_specialties' as any).select('specialty').eq('user_id', user.id).limit(1),
          supabase.from('clinic_members').select('specialty, registration_number')
            .eq('user_id', user.id).not('registration_number', 'is', null).limit(1).maybeSingle(),
        ]);
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const hasSpec = !!(
          (specialties as any)?.[0]?.specialty ||
          (memberWithReg as any)?.specialty ||
          (typeof meta.specialty === 'string' && meta.specialty.trim())
        );
        const hasReg = !!(
          (memberWithReg as any)?.registration_number ||
          (typeof meta.registration_number === 'string' && meta.registration_number.trim())
        );
        const p = profile as any;
        const m: string[] = [];
        if (!p?.full_name?.trim())  m.push('nome completo');
        if (!p?.phone?.trim())      m.push('telefone');
        if (!p?.avatar_url?.trim()) m.push('foto de perfil');
        if (!hasSpec)               m.push('especialidade');
        if (!hasReg)                m.push('registro profissional');
        setMissing(m);
      } catch { setMissing([]); }
      finally   { setChecking(false); }
    })();
  }, [user?.id]);

  const handleJoin = async () => {
    if (!valid) return;
    setJoining(true);
    try {
      const { data, error } = await supabase.functions.invoke('join-clinic-by-code', { body: { code: normalized } });
      if (error || data?.error) {
        toast.error(data?.code === 'PROFILE_INCOMPLETE'
          ? (data.error || 'Complete seu perfil antes de entrar na clínica.')
          : (data?.error || error?.message || 'Não foi possível vincular.'));
        return;
      }
      toast.success('Vínculo criado com sucesso!');
      await refreshClinics();
      onSuccess();
    } catch (e: any) { toast.error(e?.message || 'Erro inesperado'); }
    finally { setJoining(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }} className="space-y-4 pt-2">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar
      </button>

      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
        <p className="text-xs font-semibold text-foreground">Dados obrigatórios para vincular:</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {REQUIRED.map((item) => {
            const missing = missingFields.includes(item);
            return (
              <div key={item} className="flex items-center gap-2 text-xs">
                {missing
                  ? <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                <span className={missing ? 'text-muted-foreground' : 'text-foreground'}>{item}</span>
              </div>
            );
          })}
        </div>
        {checkingProfile ? (
          <p className="text-[11px] text-muted-foreground">Verificando seu perfil...</p>
        ) : hasMissing ? (
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
            <p className="text-[11px] text-amber-600 dark:text-amber-400">Complete seu perfil para liberar o vínculo.</p>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
              onClick={() => navigate('/perfil')}>
              Ir para perfil
            </Button>
          </div>
        ) : (
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 pt-1 border-t border-border/50">
            ✓ Perfil completo para vinculação.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="onboarding-clinic-code">Código da clínica</Label>
        <Input
          id="onboarding-clinic-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="CLIN-XXXXXXXX"
          className="font-mono uppercase tracking-widest text-center text-base h-11"
          autoComplete="off"
        />
        <p className="text-[11px] text-muted-foreground text-center">
          Peça o código ao responsável da clínica.
        </p>
      </div>

      <Button onClick={handleJoin} disabled={!valid || joining || checkingProfile || hasMissing} className="w-full h-11 gap-2 text-sm">
        {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        {joining ? 'Entrando…' : 'Entrar na clínica'}
      </Button>
    </motion.div>
  );
}

/* ─── Reusable plan card ─── */
function PlanCard({
  plan, idx, style, className,
}: {
  plan: any;
  idx: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  const cfg = PLAN_CONFIG[idx % PLAN_CONFIG.length];
  const PlanIcon = cfg.icon;
  const features: string[] = Array.isArray(plan.features) ? plan.features : [];

  return (
    <div
      style={style}
      className={`relative overflow-hidden rounded-xl border ${cfg.border} bg-gradient-to-br ${cfg.gradient} p-4 flex flex-col gap-3 ${className ?? ''}`}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
      <div className="relative">
        <div className={`h-9 w-9 rounded-lg ${cfg.iconBg} flex items-center justify-center mb-3`}>
          <PlanIcon className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-bold text-sm">{plan.name}</p>
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Em breve</Badge>
        </div>
        <p className="text-lg font-bold text-primary tabular-nums">
          {fmtPrice(plan.price_cents, plan.billing_cycle)}
        </p>
      </div>
      {features.length > 0 && (
        <ul className="space-y-1 flex-1">
          {features.slice(0, 5).map((f) => (
            <li key={f} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>
      )}
      <Button disabled variant="outline" size="sm" className="w-full mt-auto opacity-60 pointer-events-none">
        Em breve
      </Button>
    </div>
  );
}

/* ─── Plans display: grid on desktop, carousel on mobile ─── */
function PlansCarousel({ plans }: { plans: any[] }) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // Find the closest card to the current scroll position
  const handleScroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    const inner = el.firstElementChild as HTMLElement | null;
    if (!inner) return;
    const cards = Array.from(inner.children) as HTMLElement[];
    let bestIdx = 0;
    let bestDist = Infinity;
    cards.forEach((card, i) => {
      const dist = Math.abs(card.offsetLeft - el.scrollLeft);
      if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    });
    setActive(Math.max(0, Math.min(bestIdx, plans.length - 1)));
  };

  // Scroll to the exact left offset of the target card
  const scrollToIdx = (idx: number) => {
    const el = carouselRef.current;
    if (!el) return;
    const inner = el.firstElementChild as HTMLElement | null;
    if (!inner) return;
    const card = inner.children[idx] as HTMLElement | undefined;
    if (!card) return;
    el.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
  };

  // Mouse drag-to-scroll for desktop
  const drag = useRef({ active: false, startX: 0, startScroll: 0 });
  const onMouseDown = (e: React.MouseEvent) => {
    const el = carouselRef.current;
    if (!el) return;
    drag.current = { active: true, startX: e.pageX, startScroll: el.scrollLeft };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag.current.active) return;
    const el = carouselRef.current;
    if (!el) return;
    el.scrollLeft = drag.current.startScroll - (e.pageX - drag.current.startX);
  };
  const endDrag = () => { drag.current.active = false; };

  const cols = Math.min(plans.length, 3);

  return (
    <div className="space-y-3">
      {/* Desktop: responsive grid (visible on md+) */}
      <div
        className="hidden md:grid gap-4"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {plans.map((plan, idx) => (
          <PlanCard key={plan.id} plan={plan} idx={idx} />
        ))}
      </div>

      {/* Mobile: horizontal snap carousel (visible below md) */}
      <div className="md:hidden space-y-3">
        <div
          ref={carouselRef}
          onScroll={handleScroll}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          className="overflow-x-auto scroll-smooth snap-x snap-mandatory touch-pan-x overscroll-x-contain pb-2 cursor-grab active:cursor-grabbing select-none [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
        >
          <div className="flex gap-3 px-1">
            {plans.map((plan, idx) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                idx={idx}
                style={{ width: '80vw', maxWidth: 280 }}
                className="shrink-0 snap-start"
              />
            ))}
          </div>
        </div>

        {plans.length > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            {plans.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => scrollToIdx(idx)}
                className={`rounded-full transition-all duration-300 ${
                  active === idx
                    ? 'w-5 h-2 bg-primary'
                    : 'w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Plans step ─── */
function PlansStep({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const { user, currentClinicId } = useAuth();
  const qc = useQueryClient();
  const [activating, setActivating] = useState<string | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['platform-plans-all'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('platform_plans')
        .select('id, name, price_cents, billing_cycle, features, segment')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [activateError, setActivateError] = useState<string | null>(null);

  const handleActivateTest = async (plan: any) => {
    if (!user) return;
    setActivating(plan.id);
    setActivateError(null);
    try {
      const entityType = currentClinicId ? 'clinic' : 'doctor';
      const entityId   = currentClinicId ?? user.id;

      const { error } = await (supabase as any).rpc('activate_test_plan', {
        p_entity_type:        entityType,
        p_entity_id:          entityId,
        p_plan_id:            plan.id,
        p_current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });

      if (error) throw error;

      await qc.invalidateQueries({ queryKey: ['subscription-status'] });
      await qc.invalidateQueries({ queryKey: ['active-sub-check'] });
      toast.success('Modo Desenvolvedor ativado — acesso liberado.');
      onSuccess();
    } catch (e: any) {
      console.error('[SubscriptionOnboarding] activate error:', e);
      const msg = e?.message ?? 'Erro ao ativar plano de teste';
      setActivateError(msg);
      toast.error(msg);
    } finally {
      setActivating(null);
    }
  };

  const testPlan   = (plans as any[]).find((p) => IS_TEST_PLAN(p.name));
  const otherPlans = (plans as any[]).filter((p) => !IS_TEST_PLAN(p.name));

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }} className="space-y-5 pt-2">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar
      </button>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-4">

          {/* Test plan — dev banner */}
          {testPlan && (
            <motion.div variants={cardVariants}>
              {/* Dev notice */}
              <div className="flex items-center gap-2 rounded-t-xl border border-b-0 border-amber-400/50 bg-amber-400/10 px-4 py-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">
                  DEV — Utilize o modo <strong>IACLIN Mensal (Teste)</strong> para continuar na plataforma
                </p>
              </div>

              {/* Test plan card */}
              <div className="relative overflow-hidden rounded-b-xl border border-t-0 border-amber-400/50 bg-gradient-to-br from-amber-50/60 to-orange-50/30 dark:from-amber-950/30 dark:to-orange-950/20 p-5">
                <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-400/20 blur-2xl" />

                {/* Info + button: stacks on small screens, row on sm+ */}
                <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm">{testPlan.name}</p>
                        <Badge className="text-[9px] px-1.5 py-0 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/30 hover:bg-amber-500/15">
                          Teste
                        </Badge>
                      </div>
                      <p className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-0.5">
                        {fmtPrice(testPlan.price_cents, testPlan.billing_cycle)}
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleActivateTest(testPlan)}
                    disabled={!!activating}
                    className="shrink-0 h-10 px-5 bg-amber-500 hover:bg-amber-600 text-white border-0 gap-2 w-full sm:w-auto"
                  >
                    {activating === testPlan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        Ativar Modo Desenvolvedor
                      </>
                    )}
                  </Button>
                </div>

                {activateError && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 mt-2 break-all">{activateError}</p>
                )}
                <p className="relative text-[11px] text-amber-700/80 dark:text-amber-300/70 mt-3">
                  Libera acesso completo sem cobrança e sem redirecionar para gateway. Apenas para times de desenvolvimento.
                </p>
              </div>
            </motion.div>
          )}

          {/* Divider */}
          {otherPlans.length > 0 && (
            <motion.div variants={cardVariants} className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border/60" />
              <span className="text-[11px] text-muted-foreground font-medium">PLANOS COMPLETOS</span>
              <div className="flex-1 h-px bg-border/60" />
            </motion.div>
          )}

          {/* Plans grid / carousel */}
          {otherPlans.length > 0 && (
            <motion.div variants={cardVariants}>
              <PlansCarousel plans={otherPlans} />
            </motion.div>
          )}

        </motion.div>
      )}
    </motion.div>
  );
}

/* ─── Linked step — user already belongs to a clinic but clinic has no active plan ─── */
function LinkedStep({ onPlans, onClose }: { onPlans: () => void; onClose: () => void }) {
  const { currentClinicId } = useAuth();

  const { data: clinicName } = useQuery({
    queryKey: ['clinic-name-sub-modal', currentClinicId],
    enabled: !!currentClinicId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('clinics').select('name').eq('id', currentClinicId!).maybeSingle();
      return (data as any)?.name as string | null;
    },
  });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }} className="space-y-4 pt-2">

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">{clinicName ?? 'Sua clínica'}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="inline h-3 w-3 mr-1" />
              Você já está vinculado
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          A clínica ainda não possui um plano ativo no IACLIN. Solicite ao responsável pela clínica que regularize a assinatura para liberar o acesso completo.
        </p>
      </div>

      <div className="space-y-2">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={onPlans}
          className="w-full rounded-xl border border-border bg-gradient-to-br from-violet-500/5 to-violet-500/0 hover:border-violet-400/50 hover:from-violet-500/10 transition-all duration-200 p-4 text-left group"
        >
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0 group-hover:bg-violet-500/15 transition-colors">
              <UserCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sm">Contratar plano independente</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Quero assinar um plano próprio e usar o IACLIN de forma autônoma.
              </p>
            </div>
          </div>
        </motion.button>

        <div className="text-center pt-1">
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Fechar por agora
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Choice step ─── */
function ChoiceStep({ onClinic, onPlans }: { onClinic: () => void; onPlans: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }} className="space-y-3 pt-2">

      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={onClinic}
        className="w-full rounded-xl border border-border bg-gradient-to-br from-primary/5 to-primary/0 hover:border-primary/50 hover:from-primary/10 transition-all duration-200 p-4 text-left group"
      >
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">Estou vinculado a uma clínica</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              A clínica já usa o IACLIN e cobre minha assinatura. Vou inserir o código de convite para me vincular.
            </p>
          </div>
        </div>
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={onPlans}
        className="w-full rounded-xl border border-border bg-gradient-to-br from-violet-500/5 to-violet-500/0 hover:border-violet-400/50 hover:from-violet-500/10 transition-all duration-200 p-4 text-left group"
      >
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0 group-hover:bg-violet-500/15 transition-colors">
            <UserCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">Sou autônomo / tenho minha própria clínica</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Trabalho de forma independente e quero contratar meu próprio plano.
            </p>
          </div>
        </div>
      </motion.button>

    </motion.div>
  );
}

/* ─── Root modal ─── */
export function SubscriptionOnboardingModal({ open, onClose }: Props) {
  const { clinics } = useAuth();
  const hasLinkedClinics = (clinics?.length ?? 0) > 0;

  const defaultStep = (): Step => hasLinkedClinics ? 'linked' : 'choice';
  const [step, setStep] = useState<Step>(defaultStep);

  useEffect(() => {
    if (open) setStep(defaultStep());
  }, [open, hasLinkedClinics]);

  const titles: Record<Step, string> = {
    linked: 'Assinatura necessária',
    choice: 'Como você vai usar o IACLIN?',
    clinic: 'Vincular a uma clínica',
    plans:  'Planos disponíveis',
  };

  const descriptions: Partial<Record<Step, string>> = {
    linked: 'Você já pertence a uma clínica, mas ela ainda não tem um plano ativo.',
    choice: 'Escolha como deseja usar a plataforma.',
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <KeyRound className="h-4 w-4" />
            </div>
            {titles[step]}
          </DialogTitle>
          {descriptions[step] && (
            <DialogDescription>{descriptions[step]}</DialogDescription>
          )}
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === 'linked' && (
            <LinkedStep key="linked" onPlans={() => setStep('plans')} onClose={onClose} />
          )}
          {step === 'choice' && (
            <ChoiceStep key="choice" onClinic={() => setStep('clinic')} onPlans={() => setStep('plans')} />
          )}
          {step === 'clinic' && (
            <ClinicStep key="clinic" onBack={() => setStep('choice')} onSuccess={onClose} />
          )}
          {step === 'plans' && (
            <PlansStep key="plans" onBack={() => setStep(hasLinkedClinics ? 'linked' : 'choice')} onSuccess={onClose} />
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
