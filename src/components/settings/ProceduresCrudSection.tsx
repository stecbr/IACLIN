import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface Props {
  procedures: any[];
  isLoading: boolean;
}

export default function ProceduresCrudSection() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProc, setEditingProc] = useState<any>(null);

  const { data: procedures = [], isLoading } = useQuery({
    queryKey: ['procedures-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('procedures').select('*').order('category, name');
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('procedures').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procedures-settings'] });
      queryClient.invalidateQueries({ queryKey: ['procedures-list'] });
      toast.success('Procedimento removido');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('procedures').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procedures-settings'] });
      queryClient.invalidateQueries({ queryKey: ['procedures-list'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const categories = [...new Set(procedures.map((p) => p.category))];

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Procedimentos</CardTitle>
          <CardDescription>Gerencie os procedimentos da clínica.</CardDescription>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => { setEditingProc(null); setDialogOpen(true); }}>
          <Plus className="h-3.5 w-3.5" />
          Novo
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : procedures.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum procedimento cadastrado.</p>
        ) : (
          <div className="space-y-6">
            {categories.map((cat) => (
              <div key={cat}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{cat}</h3>
                <div className="space-y-1">
                  {procedures.filter((p) => p.category === cat).map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="text-sm font-medium text-foreground">{p.name}</span>
                        {p.code && <Badge variant="outline" className="text-[10px]">{p.code}</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground hidden sm:inline">{p.default_duration}min</span>
                        <span className="text-xs text-muted-foreground hidden sm:inline">R$ {Number(p.default_price).toFixed(2)}</span>
                        <Switch
                          checked={p.is_active}
                          onCheckedChange={(v) => toggleActive.mutate({ id: p.id, is_active: v })}
                          className="scale-75"
                        />
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingProc(p); setDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {dialogOpen && (
        <ProcedureDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          procedure={editingProc}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['procedures-settings'] });
            queryClient.invalidateQueries({ queryKey: ['procedures-list'] });
          }}
        />
      )}
    </Card>
  );
}

const COLORS = ['#3B82F6', '#EF4444', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

function ProcedureDialog({ open, onOpenChange, procedure, onSuccess }: {
  open: boolean; onOpenChange: (v: boolean) => void; procedure: any; onSuccess: () => void;
}) {
  const isEdit = !!procedure;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: procedure?.name ?? '',
    code: procedure?.code ?? '',
    category: procedure?.category ?? 'Geral',
    color: procedure?.color ?? '#3B82F6',
    default_duration: procedure?.default_duration ?? 30,
    default_price: procedure?.default_price ?? 0,
    description: procedure?.description ?? '',
    is_active: procedure?.is_active ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setLoading(true);
    try {
      const payload = {
        ...form,
        code: form.code || null,
        description: form.description || null,
        default_price: Number(form.default_price),
        default_duration: Number(form.default_duration),
      };
      if (isEdit) {
        const { error } = await supabase.from('procedures').update(payload).eq('id', procedure.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('procedures').insert(payload);
        if (error) throw error;
      }
      toast.success(isEdit ? 'Procedimento atualizado!' : 'Procedimento cadastrado!');
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Procedimento' : 'Novo Procedimento'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Limpeza" required />
            </div>
            <div className="space-y-2">
              <Label>Código</Label>
              <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Ex: PROC001" />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Ex: Estética" />
            </div>
            <div className="space-y-2">
              <Label>Duração (min)</Label>
              <Input type="number" value={form.default_duration} onChange={e => setForm({ ...form, default_duration: Number(e.target.value) })} min={5} step={5} />
            </div>
            <div className="space-y-2">
              <Label>Preço (R$)</Label>
              <Input type="number" value={form.default_price} onChange={e => setForm({ ...form, default_price: Number(e.target.value) })} min={0} step={0.01} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${form.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
            <Label className="text-sm">Ativo</Label>
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
