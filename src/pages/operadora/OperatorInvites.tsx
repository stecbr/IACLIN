import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

export default function OperatorInvites() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Convites de credenciamento</h1>
          <p className="text-sm text-muted-foreground">
            Envie convites para clínicas e profissionais ingressarem na sua rede.
          </p>
        </div>
        <Button>
          <Send className="h-4 w-4 mr-2" />
          Novo convite
        </Button>
      </div>
      <Card className="p-10 flex flex-col items-center justify-center text-center gap-3">
        <Send className="h-10 w-10 text-muted-foreground" />
        <div className="text-sm font-medium">Nenhum convite enviado ainda</div>
        <p className="text-xs text-muted-foreground max-w-md">
          Gere um link único de credenciamento e envie por e-mail ou WhatsApp. O profissional
          preenche o cadastro e o pedido aparece automaticamente em "Pedidos".
        </p>
      </Card>
    </div>
  );
}