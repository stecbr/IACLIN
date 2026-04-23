import ClinicalMapPage from '@/components/clinical-map/ClinicalMapPage';

/**
 * Legacy route. Now delegates to the generic ClinicalMapPage component, forcing
 * the tooth map type so this URL always shows the odontogram regardless of the
 * logged-in user's specialty (preserving backwards compatibility for odonto clinics).
 */
export default function Odontogram() {
  return <ClinicalMapPage forceMapType="tooth" />;
}

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
  const isCanine = [13, 23, 33, 43].includes(number);

  const w = 40;
  const h = 64;

  // Tooth-shaped paths for different tooth types (crown portion)
  // All paths are drawn in a 40x64 viewBox
  const getToothPath = () => {
    if (isMolar) {
      // Wide crown with bumpy occlusal surface and roots
      if (isUpper) {
        return {
          crown: "M8,28 C8,14 10,6 14,4 C17,2 23,2 26,4 C30,6 32,14 32,28 L32,32 C32,35 30,37 28,37 L12,37 C10,37 8,35 8,32 Z",
          roots: "M14,37 L12,52 C12,54 13,55 14,54 L16,44 M20,37 L20,56 C20,58 21,58 21,56 L21,44 M26,37 L28,52 C28,54 27,55 26,54 L24,44",
          occlusal: "M12,12 C14,9 18,8 20,10 C22,8 26,9 28,12"
        };
      } else {
        return {
          crown: "M8,32 C8,46 10,54 14,56 C17,58 23,58 26,56 C30,54 32,46 32,32 L32,28 C32,25 30,23 28,23 L12,23 C10,23 8,25 8,28 Z",
          roots: "M14,23 L12,8 C12,6 13,5 14,6 L16,16 M20,23 L20,4 C20,2 21,2 21,4 L21,16 M26,23 L28,8 C28,6 27,5 26,6 L24,16",
          occlusal: "M12,48 C14,51 18,52 20,50 C22,52 26,51 28,48"
        };
      }
    } else if (isPremolar) {
      if (isUpper) {
        return {
          crown: "M12,28 C12,16 14,8 17,5 C19,3 21,3 23,5 C26,8 28,16 28,28 L28,33 C28,35 27,36 25,36 L15,36 C13,36 12,35 12,33 Z",
          roots: "M18,36 L17,52 C17,55 18,56 19,54 L20,44 M22,36 L23,52 C23,55 22,56 21,54 L20,44",
          occlusal: "M15,14 C17,11 20,10 22,11 C24,12 25,14 25,14"
        };
      } else {
        return {
          crown: "M12,36 C12,48 14,56 17,59 C19,61 21,61 23,59 C26,56 28,48 28,36 L28,31 C28,29 27,28 25,28 L15,28 C13,28 12,29 12,31 Z",
          roots: "M18,28 L17,12 C17,9 18,8 19,10 L20,20 M22,28 L23,12 C23,9 22,8 21,10 L20,20",
          occlusal: "M15,50 C17,53 20,54 22,53 C24,52 25,50 25,50"
        };
      }
    } else if (isCanine) {
      if (isUpper) {
        return {
          crown: "M14,28 C14,18 16,10 18,5 C19,3 21,3 22,5 C24,10 26,18 26,28 L26,34 C26,36 25,37 23,37 L17,37 C15,37 14,36 14,34 Z",
          roots: "M19,37 L18,54 C18,57 20,58 20,56 L20,44 M21,37 L22,54 C22,57 20,58 20,56",
          occlusal: ""
        };
      } else {
        return {
          crown: "M14,36 C14,46 16,54 18,59 C19,61 21,61 22,59 C24,54 26,46 26,36 L26,30 C26,28 25,27 23,27 L17,27 C15,27 14,28 14,30 Z",
          roots: "M19,27 L18,10 C18,7 20,6 20,8 L20,20 M21,27 L22,10 C22,7 20,6 20,8",
          occlusal: ""
        };
      }
    } else {
      // Incisor - shovel/chisel shaped
      if (isUpper) {
        return {
          crown: "M14,26 C14,16 15,9 17,6 C18,4 22,4 23,6 C25,9 26,16 26,26 L26,34 C26,36 25,37 23,37 L17,37 C15,37 14,36 14,34 Z",
          roots: "M19,37 L19,55 C19,57 20,58 21,57 L21,37",
          occlusal: ""
        };
      } else {
        return {
          crown: "M14,38 C14,48 15,55 17,58 C18,60 22,60 23,58 C25,55 26,48 26,38 L26,30 C26,28 25,27 23,27 L17,27 C15,27 14,28 14,30 Z",
          roots: "M19,27 L19,9 C19,7 20,6 21,7 L21,27",
          occlusal: ""
        };
      }
    }
  };

  const paths = getToothPath();
  const filterId = `glow-${number}`;

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
            {isSelected && (
              <defs>
                <filter id={filterId}>
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
            )}
            {/* Roots */}
            <path
              d={paths.roots}
              fill="none"
              stroke={condition === 'missing' ? '#D1D5DB' : '#E8D5A3'}
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.7}
            />
            {/* Crown */}
            <path
              d={paths.crown}
              fill={fill}
              stroke={isSelected ? 'hsl(215, 80%, 52%)' : '#D1D5DB'}
              strokeWidth={isSelected ? 2.5 : 1.2}
              className="group-hover:stroke-primary transition-colors"
              filter={isSelected ? `url(#${filterId})` : undefined}
            />
            {/* Occlusal detail */}
            {paths.occlusal && (!condition || condition === 'healthy') && (
              <path
                d={paths.occlusal}
                fill="none"
                stroke="#D1D5DB"
                strokeWidth={0.8}
                strokeLinecap="round"
              />
            )}
            {/* Missing X */}
            {condition === 'missing' && (
              <>
                <line x1={10} y1={isUpper ? 6 : 28} x2={30} y2={isUpper ? 36 : 58} stroke="#9CA3AF" strokeWidth={2} strokeLinecap="round" />
                <line x1={30} y1={isUpper ? 6 : 28} x2={10} y2={isUpper ? 36 : 58} stroke="#9CA3AF" strokeWidth={2} strokeLinecap="round" />
              </>
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
