import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Stethoscope, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SPECIALTIES } from '@/components/patient/booking/SpecialtyStep';

export default function SpecialtySection() {
  const { user, currentClinicId } = useAuth();
  const [value, setValue] = useState<string>('');
  const [initial, setInitial] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user || !currentClinicId) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('clinic_members')
        .select('specialty')
        .eq('user_id', user.id)
        .eq('clinic_id', currentClinicId)
        .maybeSingle();
      if (cancelled) return;
      const v = (data as any)?.specialty ?? '';
      setValue(v);
      setInitial(v);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, currentClinicId]);

  const sortedSpecialties = useMemo(
    () => [...SPECIALTIES].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    []
  );

  const handleSave = async () => {
    if (!user || !currentClinicId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('clinic_members')
        .update({ specialty: value || null } as any)
        .eq('user_id', user.id)
        .eq('clinic_id', currentClinicId);
      if (error) throw error;
      setInitial(value);
      toast.success('Especialidade salva');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Stethoscope className="h-4 w-4" /> Especialidade
        </CardTitle>
        <CardDescription>
          Defina sua especialidade principal. Você só aparecerá nas buscas dos pacientes para esta especialidade.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Sua especialidade</Label>
          <Select value={value} onValueChange={setValue} disabled={loading}>
            <SelectTrigger>
              <SelectValue placeholder={loading ? 'Carregando...' : 'Selecione uma especialidade'} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {sortedSpecialties.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Pacientes que buscarem por outra especialidade não verão o seu perfil. Para aparecer em mais buscas, escolha "Clínico Geral" ou similar.
          </span>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving || loading || value === initial}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </CardContent>
    </Card>
  );
}
