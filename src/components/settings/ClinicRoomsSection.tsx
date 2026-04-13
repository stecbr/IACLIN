import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Armchair } from 'lucide-react';

export default function ClinicRoomsSection() {
  const { currentClinicId } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any>(null);

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['clinic-rooms', currentClinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_rooms')
        .select('*')
        .eq('clinic_id', currentClinicId!)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!currentClinicId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clinic_rooms').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-rooms'] });
      toast.success('Sala removida');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Cadeiras / Salas</CardTitle>
          <CardDescription>Gerencie os recursos da clínica para agendamento.</CardDescription>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => { setEditingRoom(null); setDialogOpen(true); }}>
          <Plus className="h-3.5 w-3.5" />
          Nova Sala
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Armchair className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma sala cadastrada</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rooms.map((room: any) => (
              <div key={room.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Armchair className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{room.name}</p>
                    {room.description && <p className="text-xs text-muted-foreground">{room.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={room.is_active ? 'default' : 'secondary'} className="text-[10px]">
                    {room.is_active ? 'Ativa' : 'Inativa'}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingRoom(room); setDialogOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(room.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {dialogOpen && (
        <RoomDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          room={editingRoom}
          clinicId={currentClinicId!}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['clinic-rooms'] })}
        />
      )}
    </Card>
  );
}

function RoomDialog({ open, onOpenChange, room, clinicId, onSuccess }: {
  open: boolean; onOpenChange: (v: boolean) => void; room: any; clinicId: string; onSuccess: () => void;
}) {
  const isEdit = !!room;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: room?.name ?? '',
    description: room?.description ?? '',
    is_active: room?.is_active ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setLoading(true);
    try {
      const payload = { ...form, description: form.description || null };
      if (isEdit) {
        const { error } = await supabase.from('clinic_rooms').update(payload).eq('id', room.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clinic_rooms').insert({ ...payload, clinic_id: clinicId });
        if (error) throw error;
      }
      toast.success(isEdit ? 'Sala atualizada!' : 'Sala cadastrada!');
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
          <DialogTitle>{isEdit ? 'Editar Sala' : 'Nova Sala'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Cadeira 1, Sala A" required />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Detalhes opcionais..." />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
            <Label className="text-sm">Ativa</Label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Salvando…' : isEdit ? 'Salvar' : 'Cadastrar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
