import { useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Pencil, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePatientData } from '@/hooks/usePatientData';

export default function PatientPlan() {
  const { account, loading, refetch } = usePatientData();
  const [editOpen, setEditOpen] = useState(false);
  const [editProvider, setEditProvider] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [saving, setSaving] = useState(false);

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
    </div>
  );
}
