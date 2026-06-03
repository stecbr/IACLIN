import { MessageCircle, Stethoscope, ShieldCheck, CalendarClock, CheckCircle2, UserCog } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// Mostra de forma clara e visual o passo-a-passo que a IA Secretária segue
// ao atender um paciente. Ajuda a clínica a entender o fluxo de ponta a ponta.

const STEPS = [
  {
    icon: MessageCircle,
    title: 'Recebe e entende',
    desc: 'O paciente manda mensagem e a IA entende o que ele precisa, em linguagem natural.',
    color: 'text-slate-600 bg-slate-100',
  },
  {
    icon: Stethoscope,
    title: 'Pergunta o procedimento',
    desc: 'A IA pergunta qual atendimento o paciente deseja — sem listar tudo de uma vez.',
    color: 'text-blue-600 bg-blue-100',
  },
  {
    icon: ShieldCheck,
    title: 'Particular ou convênio',
    desc: 'Confirma se é particular ou por convênio (só oferece os convênios credenciados).',
    color: 'text-emerald-600 bg-emerald-100',
  },
  {
    icon: CalendarClock,
    title: 'Oferece horários',
    desc: 'Mostra 2 ou 3 horários reais disponíveis na agenda e o paciente escolhe.',
    color: 'text-indigo-600 bg-indigo-100',
  },
  {
    icon: CheckCircle2,
    title: 'Registra o pedido',
    desc: 'Cria o agendamento aguardando aprovação da clínica e avisa o paciente.',
    color: 'text-green-600 bg-green-100',
  },
];

export function FlowSteps() {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Como a IA atende</CardTitle>
        <CardDescription>
          O passo-a-passo que a Secretária IA segue em cada conversa de agendamento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-4">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isLast = i === STEPS.length - 1;
            return (
              <li key={s.title} className="relative flex gap-3">
                {/* linha conectora */}
                {!isLast && (
                  <span className="absolute left-[18px] top-9 h-[calc(100%-4px)] w-px bg-border" aria-hidden />
                )}
                <div className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${s.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="text-sm font-medium text-foreground">
                    <span className="text-muted-foreground mr-1.5">{i + 1}.</span>
                    {s.title}
                  </p>
                  <p className="text-xs text-muted-foreground leading-snug">{s.desc}</p>
                </div>
              </li>
            );
          })}
        </ol>

        {/* nota sobre atendimento humano */}
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 p-3">
          <UserCog className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-snug">
            A qualquer momento, se o paciente pedir um atendente ou citar urgência, a IA transfere
            para um humano — e você pode assumir a conversa na aba <strong>Conversas</strong>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
