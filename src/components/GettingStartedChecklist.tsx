import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  ChevronDown,
  ChevronUp,
  X,
  Building2,
  Users,
  UserPlus,
  FileText,
  Calendar,
  Stethoscope,
  User as UserIcon,
  Shield,
  Clock,
  Table2,
  BadgeCheck,
  Image as ImageIcon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';

interface ChecklistItem {
  key: string;
  label: string;
  to: string;
  icon: typeof Building2;
  done: boolean;
}

const STORAGE_KEY_PREFIX = 'iaclin.gettingStarted';

type Persona = 'clinic' | 'dentist' | 'patient' | 'operator';

/**
 * Floating "Comece por aqui" checklist. Adapts to the current persona
 * (clínica/admin, dentista, paciente, operadora) and shows a tailored list
 * of first-access setup tasks. Auto-detects completion from the database;
 * auto-hides once 100% is reached or the user dismisses it.
 */
export function GettingStartedChecklist() {
  const location = useLocation();
  const {
    user,
    currentClinicId,
    isPersonalMode,
    isClinicOwner,
    clinicRole,
    isPatient,
    isOperator,
    operatorId,
  } = useAuth();
  const { effectiveRole } = useRoleAccess();

  // Resolve persona (priority: patient → operator → clinic-admin → dentist).
  const persona: Persona | null = isPatient
    ? 'patient'
    : isOperator
      ? 'operator'
      : currentClinicId && (isClinicOwner || effectiveRole === 'admin')
        ? 'clinic'
        : currentClinicId && clinicRole === 'dentist'
          ? 'dentist'
          : null;

  const scopeId =
    persona === 'patient' || persona === 'dentist'
      ? user?.id ?? null
      : persona === 'operator'
        ? operatorId
        : persona === 'clinic'
          ? currentClinicId
          : null;

  const storageKey = persona && scopeId ? `${STORAGE_KEY_PREFIX}.${persona}.${scopeId}` : null;

  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !storageKey) return false;
    return localStorage.getItem(`${storageKey}.dismissed`) === '1';
  });

  useEffect(() => {
    if (!storageKey) return;
    setDismissed(localStorage.getItem(`${storageKey}.dismissed`) === '1');
  }, [storageKey]);

  // Routes to hide on, per persona — keeps the card out of unrelated areas.
  const HIDDEN_ROUTES: Record<Persona, string[]> = {
    clinic:   ['/auth', '/onboarding', '/superadmin', '/operadora', '/paciente', '/marketplace'],
    dentist:  ['/auth', '/onboarding', '/superadmin', '/operadora', '/paciente', '/marketplace'],
    patient:  ['/auth', '/onboarding', '/superadmin', '/operadora', '/marketplace'],
    operator: ['/auth', '/onboarding', '/superadmin', '/paciente', '/marketplace'],
  };
  const onHiddenRoute = persona
    ? HIDDEN_ROUTES[persona].some((r) => location.pathname.startsWith(r))
    : true;

  const canSee = !!persona && !!scopeId && !onHiddenRoute &&
    // For clinic/dentist personas, hide while user is in personal (no-clinic) mode.
    !((persona === 'clinic' || persona === 'dentist') && isPersonalMode);

  const { data: progress } = useQuery({
    queryKey: ['getting-started', persona, scopeId],
    enabled: canSee,
    queryFn: async () => {
      if (persona === 'clinic') {
        const [clinic, members, patients, budgets, appts, procedures] = await Promise.all([
          supabase.from('clinics').select('phone, address, business_hours').eq('id', currentClinicId!).maybeSingle(),
          supabase.from('clinic_members').select('id', { count: 'exact', head: true }).eq('clinic_id', currentClinicId!).eq('role', 'dentist'),
          supabase.from('patients').select('id', { count: 'exact', head: true }).eq('clinic_id', currentClinicId!),
          supabase.from('treatment_plans').select('id, patients!inner(clinic_id)', { count: 'exact', head: true }).eq('patients.clinic_id', currentClinicId!),
          supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('clinic_id', currentClinicId!),
          supabase.from('procedures').select('id', { count: 'exact', head: true }).eq('clinic_id', currentClinicId!),
        ]);
        const c: any = clinic.data ?? {};
        return {
          clinicConfigured: !!(c.phone && c.address && c.business_hours),
          hasTeam: (members.count ?? 0) > 0,
          hasPatient: (patients.count ?? 0) > 0,
          hasProcedure: (procedures.count ?? 0) > 0,
          hasBudget: (budgets.count ?? 0) > 0,
          hasAppointment: (appts.count ?? 0) > 0,
        } as Record<string, boolean>;
      }

      if (persona === 'dentist') {
        const [profile, member, personal, schedule, patients] = await Promise.all([
          supabase.from('profiles').select('full_name, phone, avatar_url').eq('id', user!.id).maybeSingle(),
          supabase.from('clinic_members').select('specialty, registration_number').eq('user_id', user!.id).eq('clinic_id', currentClinicId!).maybeSingle(),
          supabase.from('professional_specialties' as any).select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
          supabase.from('professional_schedule_template').select('id', { count: 'exact', head: true }).eq('user_id', user!.id).eq('clinic_id', currentClinicId!).eq('is_active', true),
          supabase.from('patients').select('id', { count: 'exact', head: true }).eq('clinic_id', currentClinicId!).eq('dentist_id', user!.id),
        ]);
        const p: any = profile.data ?? {};
        const m: any = member.data ?? {};
        return {
          profileComplete: !!(p.full_name && p.phone && p.avatar_url),
          hasSpecialty: !!m.specialty || (personal.count ?? 0) > 0,
          hasRegistration: !!m.registration_number,
          hasSchedule: (schedule.count ?? 0) > 0,
          hasPatient: (patients.count ?? 0) > 0,
        };
      }

      if (persona === 'patient') {
        const [profile, patientRow, appts] = await Promise.all([
          supabase.from('profiles').select('full_name, phone, avatar_url').eq('id', user!.id).maybeSingle(),
          supabase.from('patients').select('insurance_provider, address, zip_code').eq('patient_user_id', user!.id).maybeSingle(),
          supabase.from('appointments').select('id, patients!inner(patient_user_id)', { count: 'exact', head: true }).eq('patients.patient_user_id', user!.id),
        ]);
        const pr: any = profile.data ?? {};
        const pa: any = patientRow.data ?? {};
        return {
          profileComplete: !!(pr.full_name && pr.phone),
          hasPhoto: !!pr.avatar_url,
          hasAddress: !!(pa.address && pa.zip_code),
          hasInsurance: !!pa.insurance_provider,
          hasAppointment: (appts.count ?? 0) > 0,
        };
      }

      // operator
      const [op, tables, credentialings] = await Promise.all([
        supabase.from('insurance_operators').select('name, contact_email, contact_phone, logo_url').eq('id', operatorId!).maybeSingle(),
        supabase.from('operator_price_tables').select('id', { count: 'exact', head: true }).eq('operator_id', operatorId!),
        supabase.from('operator_credentialings').select('id', { count: 'exact', head: true }).eq('operator_id', operatorId!).eq('status', 'approved'),
      ]);
      const o: any = op.data ?? {};
      return {
        operatorConfigured: !!(o.name && o.contact_email && o.contact_phone),
        hasLogo: !!o.logo_url,
        hasPriceTable: (tables.count ?? 0) > 0,
        hasCredentialing: (credentialings.count ?? 0) > 0,
      };
    },
    staleTime: 30_000,
  });

  const items: ChecklistItem[] = useMemo(() => {
    if (!persona || !progress) return [];
    if (persona === 'clinic') {
      return [
        { key: 'clinic',      label: 'Configure os dados da clínica', to: '/settings?section=clinic',     icon: Building2,   done: !!progress.clinicConfigured },
        { key: 'team',        label: 'Cadastre sua equipe',           to: '/clinica/medicos',             icon: Stethoscope, done: !!progress.hasTeam },
        { key: 'procedure',   label: 'Cadastre um procedimento',      to: '/settings?section=procedures', icon: FileText,    done: !!progress.hasProcedure },
        { key: 'patient',     label: 'Cadastre um paciente',          to: '/patients',                    icon: Users,       done: !!progress.hasPatient },
        { key: 'budget',      label: 'Crie um orçamento',             to: '/budgets',                     icon: UserPlus,    done: !!progress.hasBudget },
        { key: 'appointment', label: 'Agende uma consulta',           to: '/agenda',                      icon: Calendar,    done: !!progress.hasAppointment },
      ];
    }
    if (persona === 'dentist') {
      return [
        { key: 'profile',     label: 'Complete seu perfil (nome, telefone e foto)', to: '/settings?section=profile',  icon: UserIcon,   done: !!progress.profileComplete },
        { key: 'specialty',   label: 'Defina sua especialidade',                    to: '/settings?section=specialty', icon: Stethoscope, done: !!progress.hasSpecialty },
        { key: 'registration',label: 'Informe seu registro profissional (CRO/CRM)', to: '/settings?section=profile',  icon: BadgeCheck, done: !!progress.hasRegistration },
        { key: 'schedule',    label: 'Configure seus horários de atendimento',      to: '/settings?section=profile',  icon: Clock,      done: !!progress.hasSchedule },
        { key: 'patient',     label: 'Cadastre seu primeiro paciente',              to: '/patients',                   icon: Users,      done: !!progress.hasPatient },
      ];
    }
    if (persona === 'patient') {
      return [
        { key: 'profile',     label: 'Complete seus dados (nome e telefone)', to: '/paciente/configuracoes', icon: UserIcon,  done: !!progress.profileComplete },
        { key: 'photo',       label: 'Adicione uma foto de perfil',           to: '/paciente/configuracoes', icon: ImageIcon, done: !!progress.hasPhoto },
        { key: 'address',     label: 'Cadastre seu endereço',                 to: '/paciente/configuracoes', icon: Building2, done: !!progress.hasAddress },
        { key: 'insurance',   label: 'Vincule seu plano de saúde',            to: '/paciente/plano',         icon: Shield,    done: !!progress.hasInsurance },
        { key: 'appointment', label: 'Agende sua primeira consulta',          to: '/paciente/agendar',       icon: Calendar,  done: !!progress.hasAppointment },
      ];
    }
    // operator
    return [
      { key: 'operator',     label: 'Complete os dados da operadora',       to: '/operadora/configuracoes',  icon: Building2,   done: !!progress.operatorConfigured },
      { key: 'logo',         label: 'Envie o logo da operadora',            to: '/operadora/configuracoes',  icon: ImageIcon,   done: !!progress.hasLogo },
      { key: 'price',        label: 'Cadastre uma tabela de valores',       to: '/operadora/tabela-valores', icon: Table2,      done: !!progress.hasPriceTable },
      { key: 'credential',   label: 'Credencie seu primeiro profissional',  to: '/operadora/pedidos',        icon: Stethoscope, done: !!progress.hasCredentialing },
    ];
  }, [persona, progress]);

  const totalDone = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((totalDone / items.length) * 100) : 0;
  const pendingItems = items.filter((i) => !i.done);

  const dismiss = () => {
    if (storageKey) localStorage.setItem(`${storageKey}.dismissed`, '1');
    setDismissed(true);
    setOpen(false);
  };

  if (!canSee || dismissed || !progress || items.length === 0) return null;
  // Auto-hide once everything is done.
  if (pct === 100) {
    if (storageKey && localStorage.getItem(`${storageKey}.dismissed`) !== '1') {
      localStorage.setItem(`${storageKey}.dismissed`, '1');
    }
    return null;
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-40 pointer-events-none">
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="pointer-events-auto w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card shadow-xl overflow-hidden"
      >
        {/* Header */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        >
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white shadow-sm">
            <Trophy className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">
              Comece por aqui
            </p>
            <p className="text-xs text-muted-foreground">
              {totalDone} de {items.length} concluído{totalDone === 1 ? '' : 's'}
            </p>
          </div>
          <span className="text-xs font-semibold text-primary tabular-nums">{pct}%</span>
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-emerald-500"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Items */}
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <ul className="p-2">
                {pendingItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.key}>
                      <Link
                        to={item.to}
                        className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-muted/60"
                      >
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground"
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="flex-1 text-foreground">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center justify-between px-3 py-2 border-t border-border/60 bg-muted/20">
                <span className="text-[11px] text-muted-foreground">
                  Marcado automaticamente ao concluir cada etapa
                </span>
                <button
                  onClick={dismiss}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  title="Dispensar"
                >
                  <X className="h-3 w-3" /> Dispensar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}