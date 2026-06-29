import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Stethoscope, Calculator, FileCheck2, Wallet, HelpCircle, ArrowRight,
} from 'lucide-react';

interface Props {
  /** "clinic" = visão do dono/admin/secretária. "professional" = visão do profissional vinculado. */
  audience: 'clinic' | 'professional';
  trigger?: React.ReactNode;
}

const steps = [
  {
    icon: Stethoscope,
    title: '1. Atendimento concluído',
    pro: 'Você finaliza a consulta e o pagamento do paciente é registrado (cartão, convênio, etc.).',
    clinic: 'A secretária ou o próprio profissional registra o pagamento do paciente no caixa da clínica.',
  },
  {
    icon: Calculator,
    title: '2. Comissão gerada automaticamente',
    pro: 'O sistema calcula sua comissão usando a regra cadastrada (ex.: 40% do valor) e adiciona ao seu saldo "A receber".',
    clinic: 'A plataforma aplica a regra de comissão do profissional e acumula o valor em "Comissões em aberto".',
  },
  {
    icon: FileCheck2,
    title: '3. Fechamento do período',
    pro: 'A clínica escolhe o período (semanal, quinzenal, mensal) e fecha o total que vai te pagar.',
    clinic: 'Você abre o card do profissional, define o período e confere os atendimentos que entram no repasse.',
  },
  {
    icon: Wallet,
    title: '4. Pagamento registrado',
    pro: 'Você recebe o valor por fora (Pix, transferência, dinheiro) e vê o lançamento em "Fechamentos recebidos".',
    clinic: 'Você paga o profissional pelo seu meio habitual e registra aqui. A plataforma **não envia o dinheiro** — apenas guarda o histórico.',
  },
];

export function PayoutsHelpSheet({ audience, trigger }: Props) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5">
            <HelpCircle className="h-4 w-4" />
            Como funciona?
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Como funciona o repasse de comissões</SheetTitle>
          <SheetDescription>
            O IACLIN organiza e dá transparência ao processo, mas <strong>não movimenta dinheiro</strong>.
            O pagamento continua acontecendo pelo meio que vocês já usam (Pix, transferência, dinheiro).
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-center gap-2 text-xs">
          <Badge variant="outline" className="rounded-full">
            Visão: {audience === 'clinic' ? 'Dono / Secretária' : 'Profissional'}
          </Badge>
        </div>

        <ol className="mt-6 space-y-5">
          {steps.map((s) => (
            <li key={s.title} className="flex gap-3">
              <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <s.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm">{s.title}</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {audience === 'clinic' ? s.clinic : s.pro}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-lg border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground space-y-2">
          <p className="flex items-start gap-2">
            <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              <strong className="text-foreground">Profissional</strong> acompanha tudo em{' '}
              <em>Meu Financeiro</em>.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              <strong className="text-foreground">Clínica</strong> fecha e registra o pagamento em{' '}
              <em>Financeiro → Repasses</em>.
            </span>
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}