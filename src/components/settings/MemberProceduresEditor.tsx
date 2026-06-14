import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Search, Stethoscope } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Procedure = {
  id: string;
  name: string;
  category: string;
  default_duration: number;
  default_price: number;
  specialty_category: string;
};

interface Props {
  /** clinic_members.id da pessoa cujos procedimentos vamos editar */
  clinicMemberId: string;
  /** clinic_id ao qual o membro pertence — usado para escopar o catálogo */
  clinicId?: string | null;
  /** category da clínica para filtrar o catálogo (odonto/medico/...) */
  clinicCategory?: string | null;
  /** Se true, mostra botão "Salvar"; se false, salva no toggle (autosave) */
  showSaveButton?: boolean;
  onSaved?: () => void;
}

/**
 * Editor de procedimentos que um profissional realiza dentro de uma clínica.
 * Lê do catálogo global `procedures` (filtrado por specialty_category quando informado)
 * e grava em `clinic_member_procedures`.
 */
export function MemberProceduresEditor({
  clinicMemberId,
  clinicId,
  clinicCategory,
  showSaveButton = true,
  onSaved,
}: Props) {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initial, setInitial] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from('procedures')
        .select('id, name, category, default_duration, default_price, specialty_category')
        .eq('is_active', true)
        .order('category')
        .order('name');
      if (clinicId) q = q.eq('clinic_id', clinicId);
      if (clinicCategory) q = q.eq('specialty_category', clinicCategory);
      const { data: procs } = await q;

      const { data: rows } = await supabase
        .from('clinic_member_procedures' as any)
        .select('procedure_id')
        .eq('clinic_member_id', clinicMemberId);

      if (cancelled) return;
      const active = new Set(
        ((rows ?? []) as unknown as Array<{ procedure_id: string }>).map((r) => r.procedure_id),
      );
      setProcedures((procs ?? []) as Procedure[]);
      setSelected(active);
      setInitial(active);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clinicMemberId, clinicId, clinicCategory]);

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? procedures.filter((p) => p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term))
      : procedures;
    const map = new Map<string, Procedure[]>();
    for (const p of filtered) {
      const arr = map.get(p.category) ?? [];
      arr.push(p);
      map.set(p.category, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [procedures, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const toAdd = [...selected].filter((id) => !initial.has(id));
      const toRemove = [...initial].filter((id) => !selected.has(id));
      if (toRemove.length) {
        const { error } = await supabase
          .from('clinic_member_procedures' as any)
          .delete()
          .eq('clinic_member_id', clinicMemberId)
          .in('procedure_id', toRemove);
        if (error) throw error;
      }
      if (toAdd.length) {
        const { error } = await supabase
          .from('clinic_member_procedures' as any)
          .insert(toAdd.map((procedure_id) => ({ clinic_member_id: clinicMemberId, procedure_id })));
        if (error) throw error;
      }
      setInitial(new Set(selected));
      toast.success('Procedimentos atualizados');
      onSaved?.();
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const dirty = useMemo(() => {
    if (selected.size !== initial.size) return true;
    for (const id of selected) if (!initial.has(id)) return true;
    return false;
  }, [selected, initial]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando catálogo…
      </div>
    );
  }

  if (procedures.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground py-8 text-center">
        <Stethoscope className="h-6 w-6 opacity-50" />
        Nenhum procedimento cadastrado no catálogo da clínica ainda.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar procedimento…"
            className="pl-9"
          />
        </div>
        <Badge variant="secondary">{selected.size} selecionado(s)</Badge>
      </div>

      <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
        {grouped.map(([category, items]) => (
          <div key={category} className="space-y-2">
            <div className="flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur py-1 z-10">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{category}</p>
              <button
                type="button"
                className="text-[11px] text-primary hover:underline"
                onClick={() => {
                  const ids = items.map((i) => i.id);
                  const allSelected = ids.every((id) => selected.has(id));
                  setSelected((prev) => {
                    const n = new Set(prev);
                    if (allSelected) ids.forEach((id) => n.delete(id));
                    else ids.forEach((id) => n.add(id));
                    return n;
                  });
                }}
              >
                {items.every((i) => selected.has(i.id)) ? 'Desmarcar todos' : 'Marcar todos'}
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {items.map((p) => (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                    selected.has(p.id)
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border/40 hover:bg-muted/40'
                  }`}
                >
                  <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                  <span className="text-sm flex-1 truncate">{p.name}</span>
                  <span className="text-[10px] text-muted-foreground">{p.default_duration}min</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showSaveButton && (
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button onClick={handleSave} disabled={!dirty || saving}>
            {saving ? 'Salvando…' : 'Salvar procedimentos'}
          </Button>
        </div>
      )}
    </div>
  );
}