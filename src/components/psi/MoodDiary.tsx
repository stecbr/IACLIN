import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Save } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props { patientId?: string }

const FIELDS = [
  { key: 'mood', label: 'Humor', emoji: '🌤️' },
  { key: 'energy', label: 'Energia', emoji: '⚡' },
  { key: 'sleep', label: 'Sono', emoji: '🌙' },
  { key: 'anxiety', label: 'Ansiedade', emoji: '💭' },
  { key: 'irritability', label: 'Irritabilidade', emoji: '🔥' },
] as const;

export function MoodDiary({ patientId: initialPatientId }: Props) {
  const { user, currentClinicId } = useAuth();
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState(initialPatientId ?? '');
  const [values, setValues] = useState<Record<string, number>>({ mood: 5, energy: 5, sleep: 5, anxiety: 5, irritability: 5 });
  const [trigger, setTrigger] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: patients = [] } = useQuery({
    queryKey: ['mood-patients'],
    queryFn: async () => {
      const { data } = await supabase.from('patients').select('id, full_name').eq('is_active', true).order('full_name');
      return data ?? [];
    },
    enabled: !initialPatientId,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['mood-history', patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data } = await supabase
        .from('clinical_record_requests')
        .select('id, payload, created_at, clinical_record_id')
        .eq('kind', 'psi_mood')
        .order('created_at', { ascending: false })
        .limit(10);
      // Filter client-side by patient_id from payload
      return (data ?? []).filter((r: any) => r.payload?.patient_id === patientId);
    },
    enabled: !!patientId,
  });

  const save = async () => {
    if (!patientId) {
      toast.error('Selecione um paciente.');
      return;
    }
    setSaving(true);
    try {
      const { data: cr, error: crErr } = await supabase
        .from('clinical_records')
        .insert({
          patient_id: patientId,
          dentist_id: user!.id,
          clinic_id: currentClinicId,
          status: 'completed',
          chief_complaint: 'Registro de humor (diário)',
          notes: `Humor ${values.mood}/10 · Energia ${values.energy}/10 · Sono ${values.sleep}/10 · Ansiedade ${values.anxiety}/10`,
        })
        .select('id')
        .single();
      if (crErr) throw crErr;

      await supabase.from('clinical_record_requests').insert({
        clinical_record_id: cr.id,
        kind: 'psi_mood',
        payload: { patient_id: patientId, ...values, trigger, recorded_at: new Date().toISOString() },
      });
      toast.success('Registro salvo.');
      setTrigger('');
      qc.invalidateQueries({ queryKey: ['mood-history', patientId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {!initialPatientId && (
        <div className="space-y-1.5">
          <Label className="text-xs">Paciente</Label>
          <Select value={patientId} onValueChange={setPatientId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-3">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5"><span>{f.emoji}</span>{f.label}</Label>
              <span className="text-sm font-semibold tabular-nums">{values[f.key]}/10</span>
            </div>
            <Slider
              value={[values[f.key]]}
              min={0}
              max={10}
              step={1}
              onValueChange={(v) => setValues((s) => ({ ...s, [f.key]: v[0] }))}
            />
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Evento gatilho / observação</Label>
        <Textarea rows={2} value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="Ex: discussão no trabalho, noite mal dormida..." />
      </div>

      <Button onClick={save} disabled={saving} className="w-full gap-2">
        <Save className="h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar registro'}
      </Button>

      {history.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border/50">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Últimos registros</p>
          {history.map((h: any) => (
            <Card key={h.id} className="border-border/60">
              <CardContent className="p-3 text-xs space-y-1">
                <p className="font-medium text-foreground">
                  {format(parseISO(h.created_at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                </p>
                <p className="text-muted-foreground">
                  Humor {h.payload.mood}/10 · Energia {h.payload.energy}/10 · Sono {h.payload.sleep}/10 · Ansiedade {h.payload.anxiety}/10
                </p>
                {h.payload.trigger && <p className="italic text-muted-foreground">"{h.payload.trigger}"</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
