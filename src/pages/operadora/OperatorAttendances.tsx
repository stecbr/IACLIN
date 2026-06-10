import { Card } from '@/components/ui/card';
import { ClipboardCheck } from 'lucide-react';

export default function OperatorAttendances() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Confirmações de atendimento</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe os atendimentos realizados pela rede e as confirmações do paciente.
        </p>
      </div>
      <Card className="rounded-xl p-10 flex flex-col items-center justify-center text-center gap-3">
        <ClipboardCheck className="h-10 w-10 text-muted-foreground" />
        <div className="text-sm font-medium">Nenhum atendimento aguardando confirmação</div>
        <p className="text-xs text-muted-foreground max-w-md">
          Quando um credenciado realizar um atendimento de plano, o registro aparecerá aqui
          junto com a confirmação digital do paciente para autorizar o faturamento.
        </p>
      </Card>
    </div>
  );
}