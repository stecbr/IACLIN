import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Users, FileHeart } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import {
  CONDITIONS_BY_MAP,
  getConditionMeta,
  getMapForSpecialty,
  type MapType,
  type MapConfig,
} from './mapRegistry';
import { ToothMap, getToothRegionLabel } from './ToothMap';
import { FootMap, getFootRegionLabel } from './FootMap';
import { BodyMap, getBodyRegionLabel } from './BodyMap';
import { MealMap, getMealRegionLabel } from './MealMap';
import { MusculoskeletalMap, getMusculoskeletalRegionLabel } from './MusculoskeletalMap';
import type { ClinicalMapEntry } from './types';

function getRegionLabel(mapType: MapType, regionCode: string): string {
  switch (mapType) {
    case 'tooth': return getToothRegionLabel(regionCode);
    case 'foot': return getFootRegionLabel(regionCode);
    case 'body': return getBodyRegionLabel(regionCode);
    case 'meal': return getMealRegionLabel(regionCode);
    case 'musculoskeletal': return getMusculoskeletalRegionLabel(regionCode);
  }
}

interface ClinicalMapPageProps {
  /** If provided, locks the map type (e.g. odonto clinic showing tooth map regardless of specialty) */
  forceMapType?: MapType;
  /** If provided, locks to one patient (e.g. when used inside the attendance flow) */
  patientId?: string;
  /** Optional appointment id to attach entries to */
  appointmentId?: string;
  /** Hide the page header (useful when embedded) */
  embedded?: boolean;
}

export default function ClinicalMapPage({ forceMapType, patientId: forcedPatientId, appointmentId, embedded }: ClinicalMapPageProps) {
  const { user, currentClinicId } = useAuth();
  const [selectedPatientId, setSelectedPatientId] = useState<string>(forcedPatientId ?? '');
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [notes, setNotes] = useState('');
  const [kcal, setKcal] = useState<string>('');

  useEffect(() => {
    if (forcedPatientId) setSelectedPatientId(forcedPatientId);
  }, [forcedPatientId]);

  // Detect specialty of logged-in member to pick the map
  const { data: membership } = useQuery({
    queryKey: ['clinic-member-specialty', user?.id, currentClinicId],
    queryFn: async () => {
      if (!user?.id || !currentClinicId) return null;
      const { data } = await supabase
        .from('clinic_members')
        .select('specialty, role')
        .eq('user_id', user.id)
        .eq('clinic_id', currentClinicId)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && !!currentClinicId && !forceMapType,
  });

  const mapConfig: MapConfig | null = useMemo(() => {
    if (forceMapType) {
      // Build a config on the fly from the forced type
      const presets: Record<MapType, Pick<MapConfig, 'label' | 'description'>> = {
        tooth: { label: 'Odontograma', description: 'Prontuário odontológico visual' },
        foot: { label: 'Mapa Podológico', description: 'Achados clínicos nos pés' },
        body: { label: 'Mapa Corporal', description: 'Achados anatômicos por região' },
        meal: { label: 'Diário Alimentar', description: 'Refeições e hábitos alimentares' },
        musculoskeletal: { label: 'Mapa Musculoesquelético', description: 'Articulações e grupos musculares' },
      };
      const preset = presets[forceMapType];
      return { mapType: forceMapType, label: preset.label, description: preset.description, icon: FileHeart };
    }
    return getMapForSpecialty(membership?.specialty);
  }, [forceMapType, membership?.specialty]);

  const { data: patients = [] } = useQuery({
    queryKey: ['patients-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: !forcedPatientId,
  });

  const { data: entries = [], refetch } = useQuery<ClinicalMapEntry[]>({
    queryKey: ['clinical-map', selectedPatientId, mapConfig?.mapType],
    queryFn: async () => {
      if (!selectedPatientId || !mapConfig) return [];
      const { data, error } = await supabase
        .from('clinical_map_entries')
        .select('*')
        .eq('patient_id', selectedPatientId)
        .eq('map_type', mapConfig.mapType)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClinicalMapEntry[];
    },
    enabled: !!selectedPatientId && !!mapConfig,
  });

  const handleRegionClick = (regionCode: string) => {
    if (!selectedPatientId) {
      toast.error('Selecione um paciente primeiro');
      return;
    }
    setSelectedRegion(regionCode);
    setNotes('');
    setKcal('');
    setShowDialog(true);
  };

  const handleSaveCondition = async (condition: string) => {
    if (!selectedPatientId || !selectedRegion || !user || !mapConfig) return;
    try {
      const payload: Record<string, unknown> = {};
      if (mapConfig.mapType === 'meal' && kcal) {
        const k = parseInt(kcal, 10);
        if (!Number.isNaN(k)) payload.kcal = k;
      }
      const { error } = await supabase.from('clinical_map_entries').insert({
        patient_id: selectedPatientId,
        clinic_id: currentClinicId,
        dentist_id: user.id,
        appointment_id: appointmentId ?? null,
        map_type: mapConfig.mapType,
        region_code: selectedRegion,
        condition,
        notes: notes || null,
        payload,
      });
      if (error) throw error;
      const meta = getConditionMeta(mapConfig.mapType, condition);
      toast.success(`${getRegionLabel(mapConfig.mapType, selectedRegion)}: ${meta.label}`);
      setShowDialog(false);
      refetch();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // No map for this specialty
  if (!mapConfig) {
    return (
      <div className="space-y-6">
        {!embedded && <PageHeader title="Mapa Clínico" description="Mapa visual do paciente" />}
        <EmptyState
          icon={FileHeart}
          title="Mapa não disponível"
          description="A sua especialidade ainda não tem um mapa clínico configurado. Em breve adicionaremos mais opções."
        />
      </div>
    );
  }

  const conditions = CONDITIONS_BY_MAP[mapConfig.mapType];
  const MapComponent = {
    tooth: ToothMap,
    foot: FootMap,
    body: BodyMap,
    meal: MealMap,
    musculoskeletal: MusculoskeletalMap,
  }[mapConfig.mapType];

  return (
    <div className="space-y-6">
      {!embedded && <PageHeader title={mapConfig.label} description={mapConfig.description} />}

      {!forcedPatientId && (
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
      )}

      {!selectedPatientId ? (
        <EmptyState
          icon={FileHeart}
          title="Selecione um paciente"
          description={`Escolha um paciente acima para visualizar e editar o ${mapConfig.label.toLowerCase()}.`}
        />
      ) : (
        <>
          <MapComponent
            patientId={selectedPatientId}
            entries={entries}
            onRegionClick={handleRegionClick}
            selectedRegion={selectedRegion}
          />

          {/* Legend */}
          <div className="flex flex-wrap gap-3">
            {conditions.map((c) => (
              <div key={c.value} className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: c.color }} />
                <span className="text-xs text-muted-foreground">{c.label}</span>
              </div>
            ))}
          </div>

          {/* History */}
          {entries.length > 0 && (
            <Card className="shadow-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Histórico Recente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {entries.slice(0, 12).map((e) => {
                    const meta = getConditionMeta(mapConfig.mapType, e.condition);
                    return (
                      <div key={e.id} className="flex items-center justify-between text-sm py-2 border-b border-border/50 last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="text-xs font-mono whitespace-nowrap">
                            {getRegionLabel(mapConfig.mapType, e.region_code)}
                          </Badge>
                          <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                          <span className="font-medium text-foreground truncate">{meta.label}</span>
                        </div>
                        {e.notes && <span className="text-xs text-muted-foreground truncate max-w-[200px] ml-2">{e.notes}</span>}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {selectedRegion && mapConfig ? getRegionLabel(mapConfig.mapType, selectedRegion) : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{mapConfig.mapType === 'meal' ? 'Tipo de refeição' : 'Condição'}</Label>
              <div className="grid grid-cols-2 gap-2">
                {conditions.map((c) => (
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
            {mapConfig.mapType === 'meal' && (
              <div className="space-y-2">
                <Label>Calorias (kcal)</Label>
                <Input type="number" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="Ex: 450" />
              </div>
            )}
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
