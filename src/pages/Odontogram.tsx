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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, FileHeart } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

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

function getConditionLabel(condition: string) {
  return CONDITIONS.find((c) => c.value === condition)?.label ?? condition;
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

  const w = isMolar ? 38 : isPremolar ? 32 : 28;
  const h = 52;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`flex flex-col items-center gap-1 cursor-pointer group transition-all duration-200 ${
            isSelected ? 'scale-110 -translate-y-1' : 'hover:scale-105 hover:-translate-y-0.5'
          }`}
          onClick={onClick}
        >
          {isUpper && <span className="text-[10px] text-muted-foreground font-medium">{number}</span>}
          <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
            {/* Root */}
            <rect
              x={w / 2 - 3}
              y={isUpper ? h - 16 : 0}
              width={6}
              height={16}
              rx={2}
              fill={condition === 'missing' ? '#D1D5DB' : '#FDE68A'}
              opacity={0.5}
            />
            {/* Crown */}
            <rect
              x={2}
              y={isUpper ? 2 : 16}
              width={w - 4}
              height={h - 20}
              rx={isMolar ? 7 : 6}
              fill={fill}
              stroke={isSelected ? 'hsl(215, 80%, 52%)' : '#D1D5DB'}
              strokeWidth={isSelected ? 2.5 : 1}
              className="group-hover:stroke-primary transition-colors"
              filter={isSelected ? 'url(#glow)' : undefined}
            />
            {/* Surfaces - cross pattern for anatomical detail */}
            {!condition || condition === 'healthy' ? (
              <>
                <line x1={w * 0.35} y1={isUpper ? (h - 20) * 0.4 + 2 : 16 + (h - 20) * 0.4} x2={w * 0.65} y2={isUpper ? (h - 20) * 0.4 + 2 : 16 + (h - 20) * 0.4} stroke="#D1D5DB" strokeWidth={0.5} />
                <line x1={w * 0.5} y1={isUpper ? (h - 20) * 0.3 + 2 : 16 + (h - 20) * 0.3} x2={w * 0.5} y2={isUpper ? (h - 20) * 0.7 + 2 : 16 + (h - 20) * 0.7} stroke="#D1D5DB" strokeWidth={0.5} />
              </>
            ) : null}
            {condition === 'missing' && (
              <>
                <line x1={4} y1={isUpper ? 4 : 18} x2={w - 4} y2={isUpper ? h - 20 : h - 4} stroke="#9CA3AF" strokeWidth={2} />
                <line x1={w - 4} y1={isUpper ? 4 : 18} x2={4} y2={isUpper ? h - 20 : h - 4} stroke="#9CA3AF" strokeWidth={2} />
              </>
            )}
            {isSelected && (
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
            )}
          </svg>
          {!isUpper && <span className="text-[10px] text-muted-foreground font-medium">{number}</span>}
        </div>
      </TooltipTrigger>
      <TooltipContent side={isUpper ? 'top' : 'bottom'} className="text-xs">
        <p className="font-medium">Dente {number}</p>
        {condition && <p className="text-muted-foreground">{getConditionLabel(condition)}</p>}
      </TooltipContent>
    </Tooltip>
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
      toast.success(`Dente ${selectedTooth}: ${getConditionLabel(condition)}`);
      setShowConditionDialog(false);
      refetch();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Odontograma" description="Prontuário odontológico visual" />

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
        <EmptyState
          icon={FileHeart}
          title="Selecione um paciente"
          description="Escolha um paciente acima para visualizar e editar o odontograma."
        />
      ) : (
        <>
          {/* Dental Chart */}
          <Card className="shadow-card border-border/50 p-4 md:p-6 overflow-x-auto">
            <div className="flex flex-col items-center gap-4 md:gap-6 min-w-[320px]">
              {/* Upper jaw */}
              <div className="flex items-end gap-0.5 md:gap-1 flex-wrap justify-center">
                {UPPER_RIGHT.map((n) => (
                  <ToothSVG key={n} number={n} condition={toothConditions[n]} onClick={() => handleToothClick(n)} isSelected={selectedTooth === n} />
                ))}
                <div className="w-2 md:w-4" />
                {UPPER_LEFT.map((n) => (
                  <ToothSVG key={n} number={n} condition={toothConditions[n]} onClick={() => handleToothClick(n)} isSelected={selectedTooth === n} />
                ))}
              </div>

              <div className="w-full border-t border-dashed border-border" />

              {/* Lower jaw */}
              <div className="flex items-start gap-0.5 md:gap-1 flex-wrap justify-center">
                {LOWER_RIGHT.map((n) => (
                  <ToothSVG key={n} number={n} condition={toothConditions[n]} onClick={() => handleToothClick(n)} isSelected={selectedTooth === n} />
                ))}
                <div className="w-2 md:w-4" />
                {LOWER_LEFT.map((n) => (
                  <ToothSVG key={n} number={n} condition={toothConditions[n]} onClick={() => handleToothClick(n)} isSelected={selectedTooth === n} />
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
            <Card className="shadow-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Histórico Recente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {entries.slice(0, 10).map((e) => (
                    <div key={e.id} className="flex items-center justify-between text-sm py-2 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">#{e.tooth_number}</Badge>
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getConditionColor(e.condition) }} />
                        <span className="font-medium text-foreground">{getConditionLabel(e.condition)}</span>
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
            <DialogTitle className="flex items-center gap-2">
              Dente {selectedTooth}
              {selectedTooth && toothConditions[selectedTooth] && (
                <Badge variant="outline" className="text-xs ml-2">
                  {getConditionLabel(toothConditions[selectedTooth])}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Condição</Label>
              <div className="grid grid-cols-3 gap-2">
                {CONDITIONS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => handleSaveCondition(c.value)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border hover:bg-muted/50 hover:border-primary/30 transition-all text-sm"
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
