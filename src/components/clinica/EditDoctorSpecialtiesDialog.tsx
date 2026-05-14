import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { specialtyLabel } from '@/components/SpecialtySelect';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  memberId: string | null;
  userId: string | null;
  doctorName?: string | null;
  onSaved?: () => void;
}

type PersonalSpec = { id: string; specialty: string; is_primary: boolean };

export function EditDoctorSpecialtiesDialog({ open, onOpenChange, memberId, userId, doctorName, onSaved }: Props) {
  const [personal, setPersonal] = useState<PersonalSpec[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initial, setInitial] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !memberId || !userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: ps } = await supabase
        .from('professional_specialties' as any)
        .select('id, specialty, is_primary')
        .eq('user_id', userId)
        .order('is_primary', { ascending: false });
      const list = ((ps ?? []) as unknown as PersonalSpec[]);

      const { data: cms } = await supabase
        .from('clinic_member_specialties' as any)
        .select('specialty')
        .eq('clinic_member_id', memberId);
      const active = new Set(((cms ?? []) as unknown as { specialty: string }[]).map((r) => r.specialty));

      if (cancelled) return;
      setPersonal(list);
      setSelected(active);
      setInitial(active);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, memberId, userId]);

  const toggle = (s: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(s)) n.delete(s); else n.add(s);
      return n;
    });
  };

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
      toast.success('Especialidades atualizadas');
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Especialidades nesta clínica</DialogTitle>
          <DialogDescription>
            Selecione quais das especialidades pessoais de <strong>{doctorName ?? 'do profissional'}</strong> serão atendidas nesta clínica.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Carregando...</p>
        ) : personal.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Este profissional ainda não cadastrou especialidades no perfil dele.
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {personal.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-3 rounded-md border border-border/40 px-3 py-2 cursor-pointer hover:bg-muted/40"
              >
                <Checkbox checked={selected.has(s.specialty)} onCheckedChange={() => toggle(s.specialty)} />
                <span className="text-sm flex-1">{specialtyLabel(s.specialty)}</span>
                {s.is_primary && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">primária</span>}
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || loading || personal.length === 0}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
