import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Crown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  dentist: 'Profissional',
  secretary: 'Secretária',
};

const roleColors: Record<string, string> = {
  admin: 'default',
  dentist: 'secondary',
  secretary: 'outline',
};

export default function TeamSection() {
  const { user, currentClinicId, isClinicOwner } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: '', full_name: '', password: '', role: 'dentist' });
  const [saving, setSaving] = useState(false);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['clinic-members', currentClinicId],
    queryFn: async () => {
      if (!currentClinicId) return [];
      const { data, error } = await supabase
        .from('clinic_members')
        .select('id, user_id, role, is_owner, created_at')
        .eq('clinic_id', currentClinicId);
      if (error) throw error;

      // Fetch profiles for all members
      const userIds = (data ?? []).map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

      return (data ?? []).map(m => ({
        ...m,
        full_name: profileMap.get(m.user_id)?.full_name ?? 'Sem nome',
      }));
    },
    enabled: !!currentClinicId,
  });

  const handleAdd = async () => {
    if (!currentClinicId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-member', {
        body: { ...form, clinic_id: currentClinicId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${form.full_name} adicionado(a) com sucesso!`);
      setForm({ email: '', full_name: '', password: '', role: 'dentist' });
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['clinic-members'] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (memberId: string, memberUserId: string) => {
    if (memberUserId === user?.id) {
      toast.error('Você não pode remover a si mesmo.');
      return;
    }
    try {
      const { error } = await supabase.from('clinic_members').delete().eq('id', memberId);
      if (error) throw error;
      toast.success('Membro removido.');
      queryClient.invalidateQueries({ queryKey: ['clinic-members'] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (!currentClinicId) {
    return (
      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Equipe</CardTitle>
          <CardDescription>Crie uma clínica primeiro na aba "Clínica" para gerenciar sua equipe.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Equipe</CardTitle>
          <CardDescription>Gerencie os membros da sua clínica.</CardDescription>
        </div>
        {isClinicOwner && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Membro</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Dr. Maria Silva" />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="maria@clinica.com" />
                </div>
                <div className="space-y-2">
                  <Label>Senha temporária</Label>
                  <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
                </div>
                <div className="space-y-2">
                  <Label>Papel</Label>
                  <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dentist">Dentista</SelectItem>
                      <SelectItem value="secretary">Secretária</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAdd} disabled={saving || !form.email || !form.full_name || !form.password} className="w-full">
                  {saving ? 'Cadastrando...' : 'Cadastrar Membro'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum membro na equipe.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {m.full_name}
                      {m.is_owner && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={roleColors[m.role] as any}>{roleLabels[m.role] ?? m.role}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {isClinicOwner && !m.is_owner && (
                      <Button variant="ghost" size="icon" onClick={() => handleRemove(m.id, m.user_id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
