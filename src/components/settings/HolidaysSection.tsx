import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, CalendarOff } from 'lucide-react';

type Holiday = { id: string; date: string; name: string };

export default function HolidaysSection() {
  const { currentClinicId } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ['clinic-holidays', currentClinicId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('clinic_holidays')
        .select('id, date, name')
        .eq('clinic_id', currentClinicId!)
        .order('date');
      if (error) throw error;
      return data as Holiday[];
    },
    enabled: !!currentClinicId,
  });

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from('clinic_holidays').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Feriado removido');
    queryClient.invalidateQueries({ queryKey: ['clinic-holidays', currentClinicId] });
  };

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['clinic-holidays', currentClinicId] });

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Feriados e Pontos Facultativos</CardTitle>
          <CardDescription>
            Datas marcadas como feriado aparecem com destaque na agenda.
          </CardDescription>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => { setEditing(null); setDialogOpen(true); }}
        >
          <Plus className="h-3.5 w-3.5" />
          Novo
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : holidays.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarOff className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum feriado cadastrado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Adicione feriados nacionais, estaduais ou pontos facultativos.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {holidays.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <CalendarOff className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{h.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {format(parseISO(h.date + 'T12:00:00'), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => { setEditing(h); setDialogOpen(true); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(h.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {dialogOpen && (
        <HolidayDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          holiday={editing}
          clinicId={currentClinicId!}
          onSuccess={invalidate}
        />
      )}
    </Card>
  );
}

function HolidayDialog({ open, onOpenChange, holiday, clinicId, onSuccess }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  holiday: Holiday | null;
  clinicId: string;
  onSuccess: () => void;
}) {
  const isEdit = !!holiday;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    date: holiday?.date ?? '',
    name: holiday?.name ?? '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date) { toast.error('Selecione a data'); return; }
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setLoading(true);
    try {
      if (isEdit) {
        const { error } = await (supabase as any)
          .from('clinic_holidays')
          .update({ date: form.date, name: form.name.trim() })
          .eq('id', holiday!.id);
        if (error) throw error;
        toast.success('Feriado atualizado!');
      } else {
        const { error } = await (supabase as any)
          .from('clinic_holidays')
          .insert({ clinic_id: clinicId, date: form.date, name: form.name.trim() });
        if (error) throw error;
        toast.success('Feriado cadastrado!');
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Feriado' : 'Novo Feriado'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Data *</Label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Nome do Feriado *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Natal, Tiradentes, Ponto Facultativo..."
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : isEdit ? 'Salvar' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
