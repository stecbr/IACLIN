import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Stethoscope, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Link } from 'react-router-dom';
import { specialtyLabel } from '@/components/SpecialtySelect';

type PersonalSpec = { id: string; specialty: string; is_primary: boolean };

export default function SpecialtySection() {
  const { user, currentClinicId } = useAuth();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [personal, setPersonal] = useState<PersonalSpec[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initial, setInitial] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user || !currentClinicId) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data: m } = await supabase
        .from('clinic_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('clinic_id', currentClinicId)
        .maybeSingle();
      const mid = m?.id ?? null;

      const { data: ps } = await supabase
        .from('professional_specialties' as any)
        .select('id, specialty, is_primary')
        .eq('user_id', user.id)
        .order('is_primary', { ascending: false });
      const personalList = ((ps ?? []) as unknown as PersonalSpec[]);

      let active = new Set<string>();
      if (mid) {
        const { data: cms } = await supabase
          .from('clinic_member_specialties' as any)
          .select('specialty')
          .eq('clinic_member_id', mid);
        active = new Set(((cms ?? []) as unknown as { specialty: string }[]).map((r) => r.specialty));
      }

      if (cancelled) return;
      setMemberId(mid);
      setPersonal(personalList);
      setSelected(active);
      setInitial(active);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, currentClinicId]);

  const toggle = (s: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  const dirty = selected.size !== initial.size || [...selected].some((s) => !initial.has(s));

  const handleSave = async () => {
    if (!memberId) return;
    setSaving(true);
    try {
      const toAdd = [...selected].filter((s) => !initial.has(s));
      const toRemove = [...initial].filter((s) => !selected.has(s));
      if (toRemove.length) {
        const { error } = await supabase
          .from('clinic_member_specialties' as any)
          .delete()
          .eq('clinic_member_id', memberId)
          .in('specialty', toRemove);
        if (error) throw error;
      }
      if (toAdd.length) {
        const { error } = await supabase
          .from('clinic_member_specialties' as any)
          .insert(toAdd.map((s) => ({ clinic_member_id: memberId, specialty: s })));
        if (error) throw error;
      }
      setInitial(new Set(selected));
      toast.success('Especialidades atualizadas');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Stethoscope className="h-4 w-4" /> Especialidades atendidas nesta clínica
        </CardTitle>
        <CardDescription>
          Marque quais das suas especialidades pessoais você atende nesta clínica. Isso define em quais buscas dos pacientes você aparece para ela.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-xs text-muted-foreground">Carregando...</p>
        ) : personal.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Você ainda não tem especialidades pessoais cadastradas.{' '}
            <Link to="/perfil" className="text-primary underline-offset-2 hover:underline">Cadastre em Meu Perfil</Link>.
          </div>
        ) : (
          <div className="space-y-2">
            {personal.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-3 rounded-md border border-border/40 px-3 py-2 cursor-pointer hover:bg-muted/40"
              >
                <Checkbox
                  checked={selected.has(s.specialty)}
                  onCheckedChange={() => toggle(s.specialty)}
                />
                <span className="text-sm">{specialtyLabel(s.specialty)}</span>
                {s.is_primary && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">primária</span>}
              </label>
            ))}
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Pacientes que buscarem por uma especialidade não marcada aqui não verão você associado a esta clínica.
          </span>
        </div>

        <Button onClick={handleSave} disabled={saving || loading || !dirty || !memberId} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </CardContent>
    </Card>
  );
}
