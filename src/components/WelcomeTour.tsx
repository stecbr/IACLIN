import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, Users, DollarSign, ArrowRight, Check } from 'lucide-react';

const steps = [
  {
    icon: Users,
    title: 'Cadastre seus pacientes',
    description: 'Comece adicionando pacientes com prontuário completo, histórico e odontograma digital.',
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
    description: 'Gerencie receitas, despesas e acompanhe os pagamentos dos pacientes em um só lugar.',
    color: 'from-amber-500 to-amber-600',
  },
];

export function WelcomeTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem('iaclin-welcome-seen');
    if (!seen) {
      const timer = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('iaclin-welcome-seen', 'true');
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
