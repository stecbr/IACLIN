import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface SoapSession {
  s?: string; // Subjetivo
  o?: string; // Objetivo
  a?: string; // Avaliação
  p?: string; // Plano
  homework?: string;
  risk?: 'none' | 'low' | 'moderate' | 'high';
}

interface Props {
  value: SoapSession;
  onChange: (next: SoapSession) => void;
}

const RISK_LEVELS: Array<{ value: NonNullable<SoapSession['risk']>; label: string }> = [
  { value: 'none', label: 'Sem risco identificado' },
  { value: 'low', label: 'Baixo' },
  { value: 'moderate', label: 'Moderado' },
  { value: 'high', label: 'Alto — plano de segurança ativado' },
];

/** Versão controlada do SOAP para usar dentro do fluxo de Atendimento. */
export function SoapSessionForm({ value, onChange }: Props) {
  const set = (k: keyof SoapSession) => (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    onChange({ ...value, [k]: e.target.value });

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">Sessão (SOAP)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs"><strong>S</strong> — Subjetivo (queixa, relato)</Label>
          <Textarea rows={3} value={value.s ?? ''} onChange={set('s')} placeholder="O que o paciente trouxe..." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs"><strong>O</strong> — Objetivo (observações, comportamento)</Label>
          <Textarea rows={3} value={value.o ?? ''} onChange={set('o')} placeholder="Postura, afeto, fala..." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs"><strong>A</strong> — Avaliação (impressão clínica)</Label>
          <Textarea rows={3} value={value.a ?? ''} onChange={set('a')} placeholder="Hipótese, formulação, evolução..." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs"><strong>P</strong> — Plano (próximos passos)</Label>
          <Textarea rows={3} value={value.p ?? ''} onChange={set('p')} placeholder="Intervenção planejada para próxima sessão..." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tarefa de casa</Label>
          <Textarea rows={2} value={value.homework ?? ''} onChange={set('homework')} placeholder="Ex: registro de pensamentos, exposição gradual..." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Avaliação de risco</Label>
          <Select value={value.risk ?? 'none'} onValueChange={(v) => onChange({ ...value, risk: v as SoapSession['risk'] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RISK_LEVELS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}