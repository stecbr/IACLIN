import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Pencil, Loader2, Plus, Trash2, Users } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePatientData } from '@/hooks/usePatientData';

const RELATIONSHIPS = ['Filho', 'Filha', 'Esposa', 'Marido', 'Pai', 'Mãe', 'Irmão', 'Irmã', 'Outro'];

type Dependent = {
  id: string;
  patient_account_id: string;
  relationship: string;
  full_name: string;
  insurance_provider: string | null;
  insurance_number: string | null;
  date_of_birth: string | null;
};

export default function PatientPlan() {
  const { account, loading, refetch } = usePatientData();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editProvider, setEditProvider] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [saving, setSaving] = useState(false);

  const [depOpen, setDepOpen] = useState(false);
  const [depSaving, setDepSaving] = useState(false);
  const [depEditing, setDepEditing] = useState<Dependent | null>(null);
  const [depForm, setDepForm] = useState({
    relationship: 'Filho',
    full_name: '',
    insurance_provider: '',
    insurance_number: '',
    date_of_birth: '',
  });
  const [depToDelete, setDepToDelete] = useState<Dependent | null>(null);

  const { data: dependents = [] } = useQuery({
    queryKey: ['patient-dependents', account?.id],
    enabled: !!account?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_dependents_insurance')
        .select('*')
        .eq('patient_account_id', account!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Dependent[];
    },
  });

  const invalidateDeps = () =>
    queryClient.invalidateQueries({ queryKey: ['patient-dependents', account?.id] });

  const openNewDep = () => {
    setDepEditing(null);
    setDepForm({ relationship: 'Filho', full_name: '', insurance_provider: '', insurance_number: '', date_of_birth: '' });
    setDepOpen(true);
  };

  const openEditDep = (d: Dependent) => {
    setDepEditing(d);
    setDepForm({
      relationship: d.relationship,
      full_name: d.full_name,
      insurance_provider: d.insurance_provider ?? '',
      insurance_number: d.insurance_number ?? '',
      date_of_birth: d.date_of_birth ?? '',
    });
    setDepOpen(true);
  };

  const saveDep = async () => {
    if (!account) return;
    if (!depForm.full_name.trim()) return toast.error('Nome do dependente é obrigatório');
    setDepSaving(true);
    const payload = {
      patient_account_id: account.id,
      relationship: depForm.relationship,
      full_name: depForm.full_name.trim(),
      insurance_provider: depForm.insurance_provider.trim() || null,
      insurance_number: depForm.insurance_number.trim() || null,
      date_of_birth: depForm.date_of_birth || null,
    };
    const { error } = depEditing
      ? await supabase.from('patient_dependents_insurance').update(payload).eq('id', depEditing.id)
      : await supabase.from('patient_dependents_insurance').insert(payload);
    setDepSaving(false);
    if (error) return toast.error(error.message);
    toast.success(depEditing ? 'Dependente atualizado' : 'Dependente adicionado');
    setDepOpen(false);
    invalidateDeps();
  };

  const confirmDelete = async () => {
    if (!depToDelete) return;
    const { error } = await supabase
      .from('patient_dependents_insurance')
      .delete()
      .eq('id', depToDelete.id);
    if (error) return toast.error(error.message);
    toast.success('Dependente removido');
    setDepToDelete(null);
    invalidateDeps();
  };

  const openEdit = () => {
    setEditProvider(account?.insurance_provider ?? '');
    setEditNumber(account?.insurance_number ?? '');
    setEditOpen(true);
  };

  const save = async () => {
    if (!account) return;
    setSaving(true);
    const { error } = await supabase
      .from('patient_accounts')
      .update({
        insurance_provider: editProvider || null,
        insurance_number: editNumber || null,
      })
      .eq('id', account.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Convênio atualizado');
    setEditOpen(false);
    refetch();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plano de Saúde</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie os dados do seu convênio.</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="overflow-hidden">
          <div className="h-3 bg-gradient-to-r from-primary via-primary/70 to-primary/40" />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Cartão do convênio
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={openEdit} className="gap-1 h-8">
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {account?.insurance_provider ? (
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Operadora</p>
                  <p className="text-3xl font-bold tracking-tight">{account.insurance_provider}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Número da carteirinha</p>
                  <p className="text-lg font-mono">{account.insurance_number ?? '—'}</p>
                </div>
                <div className="pt-3 border-t border-border">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Titular</p>
                  <p className="text-base font-medium">{account.full_name}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">CPF {account.cpf}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 space-y-3">
                <div className="h-12 w-12 mx-auto rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Nenhum convênio cadastrado</p>
                  <p className="text-sm text-muted-foreground">Adicione seu convênio para facilitar o atendimento.</p>
                </div>
                <Button size="sm" onClick={openEdit}>Adicionar convênio</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" /> Dependentes
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Cartões de convênio dos seus dependentes.</p>
          </div>
          <Button size="sm" variant="outline" onClick={openNewDep} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>

        {dependents.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center space-y-2">
              <div className="h-10 w-10 mx-auto rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Users className="h-4 w-4" />
              </div>
              <p className="text-sm text-muted-foreground">
                Adicione cartões de seus dependentes para mantê-los organizados.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {dependents.map((d) => (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-primary/80 via-primary/50 to-primary/20" />
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {d.relationship} • {d.full_name}
                        </CardTitle>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={() => openEditDep(d)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 gap-1 text-destructive hover:text-destructive"
                            onClick={() => setDepToDelete(d)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      {d.insurance_provider ? (
                        <>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Operadora</p>
                            <p className="text-xl font-bold tracking-tight">{d.insurance_provider}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Nº carteirinha</p>
                            <p className="text-base font-mono">{d.insurance_number ?? '—'}</p>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Sem convênio cadastrado</p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar convênio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Convênio</Label>
              <Input
                value={editProvider}
                onChange={(e) => setEditProvider(e.target.value)}
                placeholder="Ex: Amil, Unimed..."
              />
            </div>
            <div className="space-y-2">
              <Label>Nº carteirinha</Label>
              <Input
                value={editNumber}
                onChange={(e) => setEditNumber(e.target.value)}
                placeholder="000000000000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={depOpen} onOpenChange={setDepOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{depEditing ? 'Editar dependente' : 'Novo dependente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Parentesco</Label>
              <Select value={depForm.relationship} onValueChange={(v) => setDepForm((s) => ({ ...s, relationship: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RELATIONSHIPS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input
                value={depForm.full_name}
                onChange={(e) => setDepForm((s) => ({ ...s, full_name: e.target.value }))}
                placeholder="Nome do dependente"
              />
            </div>
            <div className="space-y-2">
              <Label>Convênio</Label>
              <Input
                value={depForm.insurance_provider}
                onChange={(e) => setDepForm((s) => ({ ...s, insurance_provider: e.target.value }))}
                placeholder="Ex: Amil, Unimed..."
              />
            </div>
            <div className="space-y-2">
              <Label>Nº carteirinha</Label>
              <Input
                value={depForm.insurance_number}
                onChange={(e) => setDepForm((s) => ({ ...s, insurance_number: e.target.value }))}
                placeholder="000000000000"
              />
            </div>
            <div className="space-y-2">
              <Label>Data de nascimento (opcional)</Label>
              <Input
                type="date"
                value={depForm.date_of_birth}
                onChange={(e) => setDepForm((s) => ({ ...s, date_of_birth: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepOpen(false)}>Cancelar</Button>
            <Button onClick={saveDep} disabled={depSaving}>
              {depSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!depToDelete} onOpenChange={(o) => !o && setDepToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover dependente?</AlertDialogTitle>
            <AlertDialogDescription>
              {depToDelete && `O cartão de ${depToDelete.full_name} será removido permanentemente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
