import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, Users, DollarSign, ArrowRight, Check, Building2, Clock, ClipboardList } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { supabase } from '@/integrations/supabase/client';

const STEPS_DENTIST = [
  {
    icon: Users,
    title: 'Cadastre seus pacientes',
    description: 'Adicione pacientes com prontuário completo, histórico clínico e ficha de atendimento.',
    color: 'from-blue-500 to-blue-600',
  },
  {
    icon: Calendar,
    title: 'Organize sua agenda',
    description: 'Agende consultas com visualização diária, semanal e mensal. Receba lembretes automáticos.',
    color: 'from-emerald-500 to-emerald-600',
  },
  {
    icon: DollarSign,
    title: 'Controle financeiro',
    description: 'Gerencie receitas, despesas e acompanhe os pagamentos dos seus pacientes em um só lugar.',
    color: 'from-amber-500 to-amber-600',
  },
];

const STEPS_CLINIC = [
  {
    icon: Building2,
    title: 'Configure sua clínica',
    description: 'Preencha os dados da clínica — nome, endereço, horários de funcionamento e convênios aceitos.',
    color: 'from-blue-500 to-blue-600',
  },
  {
    icon: Users,
    title: 'Adicione sua equipe',
    description: 'Cadastre médicos, dentistas e secretárias. Cada profissional recebe acesso com o papel correto.',
    color: 'from-violet-500 to-violet-600',
  },
  {
    icon: ClipboardList,
    title: 'Defina os procedimentos',
    description: 'Cadastre os procedimentos e valores. Seus orçamentos e agendamentos ficam muito mais ágeis.',
    color: 'from-emerald-500 to-emerald-600',
  },
];

const STEPS_STAFF = [
  {
    icon: Calendar,
    title: 'Gerencie a agenda da clínica',
    description: 'Visualize, agende e confirme consultas para todos os profissionais da clínica em um só lugar.',
    color: 'from-blue-500 to-blue-600',
  },
  {
    icon: Clock,
    title: 'Cuide da sala de espera',
    description: 'Acompanhe os pacientes em tempo real, registre chegadas e gerencie a fila de atendimento.',
    color: 'from-emerald-500 to-emerald-600',
  },
  {
    icon: ClipboardList,
    title: 'Acompanhe as aprovações',
    description: 'Revise solicitações de agendamento e orçamentos que precisam de atenção antes de serem confirmados.',
    color: 'from-amber-500 to-amber-600',
  },
];

export function WelcomeTour() {
  const { user, isClinicOwner, clinicRole } = useAuth();
  const { effectiveRole } = useRoleAccess();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const shown = useRef(false);

  const isStaff = clinicRole === 'secretary' || clinicRole === 'auxiliary';
  const isOwnerOrAdmin = isClinicOwner || effectiveRole === 'admin';
  const steps = isStaff ? STEPS_STAFF : isOwnerOrAdmin ? STEPS_CLINIC : STEPS_DENTIST;

  useEffect(() => {
    if (!user?.id || shown.current) return;
    // Fast local check first (same device)
    const localKey = `iaclin-welcome-seen-${user.id}`;
    if (localStorage.getItem(localKey)) return;
    // Cross-device check via auth metadata
    const meta = user.user_metadata as Record<string, unknown> | undefined;
    if (meta?.welcome_tour_seen) {
      // Mark locally so we skip the check next time on this device
      localStorage.setItem(localKey, 'true');
      return;
    }
    shown.current = true;
    const timer = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(timer);
  }, [user?.id]);

  const handleClose = () => {
    if (user?.id) {
      const localKey = `iaclin-welcome-seen-${user.id}`;
      localStorage.setItem(localKey, 'true');
      // Persist across devices via Supabase auth metadata (fire-and-forget)
      supabase.auth.updateUser({ data: { welcome_tour_seen: true } });
    }
    setOpen(false);
  };

  const handleNext = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else handleClose();
  };

  const current = steps[step];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
        {/* Progress bar */}
        <div className="flex gap-1 px-6 pt-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                i <= step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <div className="px-6 pt-6 pb-2">
          <DialogHeader>
            <DialogTitle className="sr-only">Bem-vindo ao IACLIN</DialogTitle>
            <DialogDescription className="sr-only">Tour de boas-vindas com os principais recursos</DialogDescription>
          </DialogHeader>

          {/* Icon */}
          <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${current.color} flex items-center justify-center mb-4 shadow-lg`}>
            <current.icon className="h-7 w-7 text-white" />
          </div>

          {/* Content */}
          <h3 className="text-lg font-semibold text-foreground mb-2">{current.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 mt-2 border-t border-border/40 bg-muted/20">
          <button
            onClick={handleClose}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Pular tour
          </button>
          <Button onClick={handleNext} size="sm" className="gap-2 rounded-xl">
            {step < steps.length - 1 ? (
              <>
                Próximo
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Começar
                <Check className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
