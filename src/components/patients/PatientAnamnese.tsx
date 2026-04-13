import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil, Save, Heart, Pill, AlertTriangle, Cigarette, Droplets } from 'lucide-react';

interface Props {
  patientId: string;
}

export function PatientAnamnese({ patientId }: Props) {
  const { user, currentClinicId } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: anamnese, isLoading } = useQuery({
    queryKey: ['anamnese', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('anamneses')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    allergies: '',
    medications: '',
    medical_conditions: '',
    habits: '',
    blood_type: '',
    notes: '',
  });

  const startEditing = () => {
    setForm({
      allergies: anamnese?.allergies ?? '',
      medications: anamnese?.medications ?? '',
      medical_conditions: anamnese?.medical_conditions ?? '',
      habits: anamnese?.habits ?? '',
      blood_type: anamnese?.blood_type ?? '',
      notes: anamnese?.notes ?? '',
    });
    setEditing(true);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (anamnese) {
        const { error } = await supabase.from('anamneses').update({
          ...form,
          filled_by: user?.id,
        }).eq('id', anamnese.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('anamneses').insert({
          ...form,
          patient_id: patientId,
          clinic_id: currentClinicId ?? null,
          filled_by: user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anamnese', patientId] });
      setEditing(false);
      toast.success('Anamnese salva!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  const fields = [
    { key: 'allergies' as const, label: 'Alergias', icon: AlertTriangle, placeholder: 'Ex: Penicilina, Látex…' },
    { key: 'medications' as const, label: 'Medicamentos em uso', icon: Pill, placeholder: 'Ex: Losartana 50mg, AAS…' },
    { key: 'medical_conditions' as const, label: 'Condições médicas', icon: Heart, placeholder: 'Ex: Hipertensão, Diabetes tipo 2…' },
    { key: 'habits' as const, label: 'Hábitos', icon: Cigarette, placeholder: 'Ex: Fumante, etilista social…' },
  ];

  if (editing) {
    return (
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base">Ficha de Anamnese</CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button size="sm" className="gap-1.5" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              <Save className="h-3.5 w-3.5" />
              {mutation.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {fields.map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs">
                  <f.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  {f.label}
                </Label>
                <Textarea
                  value={form[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  rows={3}
                />
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs">
                <Droplets className="h-3.5 w-3.5 text-muted-foreground" />
                Tipo sanguíneo
              </Label>
              <Input
                value={form.blood_type}
                onChange={e => setForm(prev => ({ ...prev, blood_type: e.target.value }))}
                placeholder="Ex: O+"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Observações adicionais</Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Outras informações relevantes…"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!anamnese) {
    return (
      <div className="flex flex-col items-center justify-center h-48 rounded-xl border border-dashed border-border bg-muted/30">
        <Heart className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-3">Nenhuma anamnese preenchida</p>
        <Button size="sm" className="gap-1.5" onClick={startEditing}>
          <Pencil className="h-3.5 w-3.5" />
          Preencher Anamnese
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-base">Ficha de Anamnese</CardTitle>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={startEditing}>
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map(f => (
            <div key={f.key} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <f.icon className="h-3.5 w-3.5" />
                {f.label}
              </p>
              <p className="text-sm whitespace-pre-wrap">{(anamnese as any)[f.key] || '—'}</p>
            </div>
          ))}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Droplets className="h-3.5 w-3.5" />
              Tipo sanguíneo
            </p>
            <p className="text-sm">{anamnese.blood_type || '—'}</p>
          </div>
        </div>
        {anamnese.notes && (
          <div className="mt-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Observações</p>
            <p className="text-sm whitespace-pre-wrap">{anamnese.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
