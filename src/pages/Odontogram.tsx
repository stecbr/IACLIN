import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Users } from 'lucide-react';

// FDI tooth numbering
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];

const CONDITIONS = [
  { value: 'healthy', label: 'Saudável', color: '#22C55E' },
  { value: 'cavity', label: 'Cárie', color: '#EF4444' },
  { value: 'restoration', label: 'Restauração', color: '#3B82F6' },
  { value: 'extraction', label: 'Extração', color: '#6B7280' },
  { value: 'crown', label: 'Coroa', color: '#F59E0B' },
  { value: 'root_canal', label: 'Canal', color: '#8B5CF6' },
  { value: 'implant', label: 'Implante', color: '#06B6D4' },
  { value: 'bridge', label: 'Ponte', color: '#EC4899' },
  { value: 'missing', label: 'Ausente', color: '#9CA3AF' },
];

function getConditionColor(condition: string) {
  return CONDITIONS.find((c) => c.value === condition)?.color ?? '#22C55E';
}

function ToothSVG({
  number,
  condition,
  onClick,
  isSelected,
}: {
  number: number;
  condition?: string;
  onClick: () => void;
  isSelected: boolean;
}) {
  const fill = condition ? getConditionColor(condition) : '#E5E7EB';
  const isUpper = number < 30;
  const isMolar = [16, 17, 18, 26, 27, 28, 36, 37, 38, 46, 47, 48].includes(number);
  const isPremolar = [14, 15, 24, 25, 34, 35, 44, 45].includes(number);

  const w = isMolar ? 36 : isPremolar ? 30 : 26;
  const h = 50;

  return (
    <div
      className={`flex flex-col items-center gap-1 cursor-pointer group transition-transform hover:scale-110 ${
        isSelected ? 'scale-110' : ''
      }`}
      onClick={onClick}
    >
      {isUpper && <span className="text-[10px] text-muted-foreground font-medium">{number}</span>}
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {/* Root */}
        <rect
          x={w / 2 - 3}
          y={isUpper ? h - 18 : 0}
          width={6}
          height={18}
          rx={2}
          fill={condition === 'missing' ? '#D1D5DB' : '#FDE68A'}
          opacity={0.6}
        />
        {/* Crown */}
        <rect
          x={2}
          y={isUpper ? 2 : 18}
          width={w - 4}
          height={h - 22}
          rx={isMolar ? 6 : 5}
          fill={fill}
          stroke={isSelected ? '#1D4ED8' : '#D1D5DB'}
          strokeWidth={isSelected ? 2 : 1}
          className="group-hover:stroke-primary transition-colors"
        />
        {condition === 'missing' && (
          <>
            <line x1={4} y1={isUpper ? 4 : 20} x2={w - 4} y2={isUpper ? h - 22 : h - 4} stroke="#9CA3AF" strokeWidth={2} />
            <line x1={w - 4} y1={isUpper ? 4 : 20} x2={4} y2={isUpper ? h - 22 : h - 4} stroke="#9CA3AF" strokeWidth={2} />
          </>
        )}
      </svg>
      {!isUpper && <span className="text-[10px] text-muted-foreground font-medium">{number}</span>}
    </div>
  );
}

export default function Odontogram() {
  const { user } = useAuth();
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [showConditionDialog, setShowConditionDialog] = useState(false);
  const [notes, setNotes] = useState('');

  const { data: patients = [] } = useQuery({
    queryKey: ['patients-active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('patients').select('id, full_name').eq('is_active', true).order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: entries = [], refetch } = useQuery({
    queryKey: ['odontogram', selectedPatientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('odontogram_entries')
        .select('*')
        .eq('patient_id', selectedPatientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPatientId,
  });

  // Get latest condition per tooth
  const toothConditions: Record<number, string> = {};
  entries.forEach((e) => {
    if (!toothConditions[e.tooth_number]) {
      toothConditions[e.tooth_number] = e.condition;
    }
  });

  const handleToothClick = (num: number) => {
    if (!selectedPatientId) {
      toast.error('Selecione um paciente primeiro');
      return;
    }
    setSelectedTooth(num);
    setNotes('');
    setShowConditionDialog(true);
  };

  const handleSaveCondition = async (condition: string) => {
    if (!selectedPatientId || selectedTooth === null || !user) return;
    try {
      const { error } = await supabase.from('odontogram_entries').insert({
        patient_id: selectedPatientId,
        tooth_number: selectedTooth,
        condition,
        notes: notes || null,
        dentist_id: user.id,
      });
      if (error) throw error;
      toast.success(`Dente ${selectedTooth}: ${CONDITIONS.find((c) => c.value === condition)?.label}`);
      setShowConditionDialog(false);
      refetch();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Odontograma</h1>
          <p className="mt-1 text-sm text-muted-foreground">Prontuário odontológico visual</p>
        </div>
      </div>

      {/* Patient Selector */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Paciente:</Label>
        </div>
        <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Selecione um paciente" />
          </SelectTrigger>
          <SelectContent>
            {patients.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedPatientId ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-dashed border-border bg-muted/30">
          <p className="text-sm text-muted-foreground">Selecione um paciente para visualizar o odontograma</p>
        </div>
      ) : (
        <>
          {/* Dental Chart */}
          <Card className="border-border/50 p-6">
            <div className="flex flex-col items-center gap-6">
              {/* Upper jaw */}
              <div className="flex items-end gap-1">
                {UPPER_RIGHT.map((n) => (
                  <ToothSVG
                    key={n}
                    number={n}
                    condition={toothConditions[n]}
                    onClick={() => handleToothClick(n)}
                    isSelected={selectedTooth === n}
                  />
                ))}
                <div className="w-4" />
                {UPPER_LEFT.map((n) => (
                  <ToothSVG
                    key={n}
                    number={n}
                    condition={toothConditions[n]}
                    onClick={() => handleToothClick(n)}
                    isSelected={selectedTooth === n}
                  />
                ))}
              </div>

              <div className="w-full border-t border-dashed border-border" />

              {/* Lower jaw */}
              <div className="flex items-start gap-1">
                {LOWER_RIGHT.map((n) => (
                  <ToothSVG
                    key={n}
                    number={n}
                    condition={toothConditions[n]}
                    onClick={() => handleToothClick(n)}
                    isSelected={selectedTooth === n}
                  />
                ))}
                <div className="w-4" />
                {LOWER_LEFT.map((n) => (
                  <ToothSVG
                    key={n}
                    number={n}
                    condition={toothConditions[n]}
                    onClick={() => handleToothClick(n)}
                    isSelected={selectedTooth === n}
                  />
                ))}
              </div>
            </div>
          </Card>

          {/* Legend */}
          <div className="flex flex-wrap gap-3">
            {CONDITIONS.map((c) => (
              <div key={c.value} className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: c.color }} />
                <span className="text-xs text-muted-foreground">{c.label}</span>
              </div>
            ))}
          </div>

          {/* Recent entries */}
          {entries.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Histórico Recente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {entries.slice(0, 10).map((e) => (
                    <div key={e.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">Dente {e.tooth_number}</Badge>
                        <span className="font-medium">{CONDITIONS.find((c) => c.value === e.condition)?.label ?? e.condition}</span>
                      </div>
                      {e.notes && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{e.notes}</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Condition Dialog */}
      <Dialog open={showConditionDialog} onOpenChange={setShowConditionDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Dente {selectedTooth}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Condição</Label>
              <div className="grid grid-cols-3 gap-2">
                {CONDITIONS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => handleSaveCondition(c.value)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors text-sm"
                  >
                    <div className="h-3 w-3 rounded-sm flex-shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="truncate">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anotações..." />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
