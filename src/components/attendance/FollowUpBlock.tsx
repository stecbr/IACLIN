import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { CalendarPlus } from 'lucide-react';
import { AppointmentFormDialog } from '@/components/agenda/AppointmentFormDialog';
import { parseISO } from 'date-fns';

interface Props {
  treatmentPlan: string;
  setTreatmentPlan: (v: string) => void;
  followUpDate: string;
  setFollowUpDate: (v: string) => void;
  followUpReason: string;
  setFollowUpReason: (v: string) => void;
  readOnly?: boolean;
  onScheduled?: () => void;
}

export function FollowUpBlock({
  treatmentPlan, setTreatmentPlan,
  followUpDate, setFollowUpDate,
  followUpReason, setFollowUpReason,
  readOnly, onScheduled,
}: Props) {
  const [openDialog, setOpenDialog] = useState(false);

  const defaultDate = followUpDate ? parseISO(followUpDate) : undefined;

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Plano terapêutico / orientações</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={treatmentPlan}
            onChange={(e) => setTreatmentPlan(e.target.value)}
            rows={6}
            placeholder="Conduta proposta, orientações ao paciente, cuidados, restrições..."
            className="resize-none"
            disabled={readOnly}
          />
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Retorno sugerido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Data sugerida</Label>
              <Input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="h-9 text-sm"
                disabled={readOnly}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Motivo do retorno</Label>
              <Input
                value={followUpReason}
                onChange={(e) => setFollowUpReason(e.target.value)}
                placeholder="Ex: Reavaliação, controle"
                className="h-9 text-sm"
                disabled={readOnly}
              />
            </div>
          </div>
          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpenDialog(true)}
              disabled={!followUpDate}
              className="gap-2"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Agendar retorno agora
            </Button>
          )}
        </CardContent>
      </Card>

      <AppointmentFormDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        onSuccess={() => {
          setOpenDialog(false);
          onScheduled?.();
        }}
        defaultDate={defaultDate}
      />
    </div>
  );
}