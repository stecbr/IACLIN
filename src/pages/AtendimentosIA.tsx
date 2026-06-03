import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { LiveMessagesPanel } from '@/components/secretaria-ia/LiveMessagesPanel';
import { HandoffPanel } from '@/components/secretaria-ia/HandoffPanel';
import { AiAppointmentRequestsPanel } from '@/components/secretaria-ia/AiAppointmentRequestsPanel';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AtendimentosIA() {
  const { currentClinicId } = useAuth();
  const [showHandoff, setShowHandoff] = useState(false);

  return (
    <div className="container mx-auto space-y-6 p-4 sm:p-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Atendimentos IA</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe as conversas da Secretária IA no WhatsApp e assuma manualmente quando precisar.
        </p>
      </div>

      <div className="space-y-2">
        <Button
          variant="outline"
          onClick={() => setShowHandoff((v) => !v)}
          className="gap-2"
        >
          Configuração de atendimento humano
          <ChevronDown
            className={`h-4 w-4 transition-transform ${showHandoff ? 'rotate-180' : ''}`}
          />
        </Button>
        {showHandoff && <HandoffPanel />}
      </div>

      {currentClinicId && <AiAppointmentRequestsPanel />}

      {currentClinicId ? (
        <LiveMessagesPanel clinicId={currentClinicId} showMetrics allowTakeover />
      ) : (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Selecione uma clínica para ver os atendimentos.
          </CardContent>
        </Card>
      )}
    </div>
  );
}