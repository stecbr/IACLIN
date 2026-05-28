import { Card } from '@/components/ui/card';
import { Wallet } from 'lucide-react';

export default function OperatorBilling() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Faturamento</h1>
        <p className="text-sm text-muted-foreground">
          Visão consolidada dos atendimentos faturáveis e repasses à rede credenciada.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'A faturar este mês', value: 'R$ 0,00' },
          { label: 'Faturado no mês', value: 'R$ 0,00' },
          { label: 'Glosas em análise', value: '0' },
        ].map((k) => (
          <Card key={k.label} className="p-5">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="text-2xl font-semibold mt-1">{k.value}</div>
          </Card>
        ))}
      </div>
      <Card className="p-10 flex flex-col items-center justify-center text-center gap-3">
        <Wallet className="h-10 w-10 text-muted-foreground" />
        <div className="text-sm font-medium">Nenhum lote de faturamento gerado</div>
        <p className="text-xs text-muted-foreground max-w-md">
          Atendimentos confirmados pelo paciente entrarão automaticamente no próximo
          fechamento mensal de faturamento da operadora.
        </p>
      </Card>
    </div>
  );
}