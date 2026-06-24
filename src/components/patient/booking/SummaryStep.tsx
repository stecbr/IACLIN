import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, MapPin, Stethoscope, CheckCircle2, Loader2, Shield, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { Specialty } from './SpecialtyStep';
import type { BookingSelection } from './ClinicDoctorStep';
import type { CoverageChoice } from './CoverageStep';

interface SummaryStepProps {
  specialty: Specialty;
  selection: BookingSelection;
  coverage?: CoverageChoice | null;
  notes: string;
  onNotesChange: (v: string) => void;
  onConfirm: () => Promise<void>;
  onBack: () => void;
  loading: boolean;
}

export function SummaryStep({
  specialty, selection, coverage, notes, onNotesChange, onConfirm, onBack, loading,
}: SummaryStepProps) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  const initials = selection.dentistName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center">
        <div className="inline-flex h-12 w-12 rounded-full bg-primary/10 items-center justify-center text-primary mb-3">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Confirme sua consulta</h2>
        <p className="text-sm text-muted-foreground mt-1">Revise os detalhes antes de confirmar.</p>
      </div>

      <Card className="overflow-hidden border-primary/20">
        <div className="bg-gradient-to-br from-primary/10 to-transparent p-5 border-b border-border">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 ring-2 ring-primary/20">
              <AvatarImage src={selection.dentistAvatar ?? undefined} />
              <AvatarFallback className="bg-primary/15 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-semibold text-lg truncate">{selection.dentistName}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Stethoscope className="h-3.5 w-3.5" /> {specialty.name}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-2.5">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Data</p>
                <p className="text-sm font-medium capitalize">
                  {format(selection.startTime, "EEEE, dd 'de' MMM", { locale: ptBR })}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Horário</p>
                <p className="text-sm font-medium">
                  {format(selection.startTime, 'HH:mm')} – {format(selection.endTime, 'HH:mm')}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 pt-1">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Local</p>
              <p className="text-sm font-medium truncate">{selection.clinicName}</p>
              {(selection.clinicAddress || selection.clinicCity) && (
                <p className="text-xs text-muted-foreground truncate">
                  {[selection.clinicAddress, selection.clinicCity].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </div>

          {coverage && (
            <div className="flex items-start gap-2.5 pt-1">
              {coverage.kind === 'insurance' ? (
                <Shield className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              ) : (
                <Wallet className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Tipo
                </p>
                <p className="text-sm font-medium truncate">
                  {coverage.kind === 'insurance' ? coverage.planName : 'Particular'}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="space-y-2">
        <Label htmlFor="notes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Motivo da consulta (opcional)
        </Label>
        <Textarea
          id="notes"
          placeholder="Ex: Dor no dente do lado direito há 3 dias..."
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
          className="resize-none"
        />
      </div>

      <div className="flex justify-between gap-3 pt-2">
        <Button variant="outline" onClick={onBack} disabled={confirming || loading}>
          Voltar
        </Button>
        <Button onClick={handleConfirm} disabled={confirming || loading} className="min-w-[180px]">
          {confirming || loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Confirmando...
            </>
          ) : (
            'Confirmar agendamento'
          )}
        </Button>
      </div>
    </div>
  );
}
