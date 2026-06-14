import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getFamilyConfig } from '@/lib/specialtyFamily';

interface ProcedureOption { id: string; name: string; default_price: number }

function ProcedureCombobox({
  procedures,
  procedureId,
  customName,
  onPickFromCatalog,
  onUseCustom,
}: {
  procedures: ProcedureOption[];
  procedureId: string;
  customName: string;
  onPickFromCatalog: (id: string) => void;
  onUseCustom: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = procedures.find(p => p.id === procedureId);
  const label = selected?.name ?? customName ?? '';
  const term = search.trim();
  const hasExactMatch = term.length > 0 && procedures.some(p => p.name.toLowerCase() === term.toLowerCase());
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className={cn(
            'h-9 w-full justify-between font-normal',
            !label && 'text-muted-foreground'
          )}
        >
          <span className="truncate">{label || 'Selecione ou digite...'}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command shouldFilter>
          <CommandInput
            placeholder="Buscar ou digitar..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {term.length > 0 && !hasExactMatch && (
              <CommandGroup heading="Personalizado">
                <CommandItem
                  value={`__custom__${term}`}
                  onSelect={() => { onUseCustom(term); setOpen(false); setSearch(''); }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Usar "{term}"
                </CommandItem>
              </CommandGroup>
            )}
            <CommandEmpty>Nenhum procedimento encontrado.</CommandEmpty>
            <CommandGroup heading="Catálogo">
              {procedures.map(p => (
                <CommandItem
                  key={p.id}
                  value={p.name}
                  onSelect={() => { onPickFromCatalog(p.id); setOpen(false); setSearch(''); }}
                >
                  <Check className={cn('mr-2 h-4 w-4', procedureId === p.id ? 'opacity-100' : 'opacity-0')} />
                  {p.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface PlanItem {
  procedure_id: string;          // empty string = free-text item
  custom_name: string;           // free-text procedure name when procedure_id is empty
  tooth_number: string;
  price: string;
  notes: string;
}

interface BudgetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  preselectedPatientId?: string;
}

export function BudgetFormDialog({ open, onOpenChange, onSuccess, preselectedPatientId }: BudgetFormDialogProps) {
  const { user, currentClinicId } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [patientId, setPatientId] = useState(preselectedPatientId ?? '');
  const [items, setItems] = useState<PlanItem[]>([
    { procedure_id: '', custom_name: '', tooth_number: '', price: '', notes: '' },
  ]);

  const { data: patients = [] } = useQuery({
    queryKey: ['patients-select', currentClinicId],
    queryFn: async () => {
      let q = supabase.from('patients').select('id, full_name').eq('is_active', true).order('full_name');
      if (currentClinicId) q = q.eq('clinic_id', currentClinicId);
      const { data } = await q;
      return data ?? [];
    },
  });

  // Doctor's specialty in the current clinic — used to filter the procedure catalog
  const { data: memberSpecialty } = useQuery({
    queryKey: ['budget-member-specialty', user?.id, currentClinicId],
    enabled: !!user?.id && !!currentClinicId,
    queryFn: async () => {
      const { data } = await supabase
        .from('clinic_members')
        .select('specialty')
        .eq('user_id', user!.id)
        .eq('clinic_id', currentClinicId!)
        .maybeSingle();
      return data?.specialty ?? null;
    },
  });

  const family = getFamilyConfig(memberSpecialty);
  const showToothField = family.hasTooth;
  const procedureCategory = family.procedureCategory;

  const { data: procedures = [] } = useQuery({
    queryKey: ['procedures-select', procedureCategory, currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const { data: scoped } = await supabase
        .from('procedures')
        .select('id, name, default_price, category, specialty_category')
        .eq('clinic_id', currentClinicId!)
        .eq('is_active', true)
        .eq('specialty_category', procedureCategory)
        .order('name');
      if (scoped && scoped.length > 0) return scoped;
      const { data } = await supabase
        .from('procedures')
        .select('id, name, default_price, category, specialty_category')
        .eq('clinic_id', currentClinicId!)
        .eq('is_active', true)
        .order('name');
      return data ?? [];
    },
  });

  const addItem = () => {
    setItems(prev => [...prev, { procedure_id: '', custom_name: '', tooth_number: '', price: '', notes: '' }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof PlanItem, value: string) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      // Auto-fill price when procedure is selected
      if (field === 'procedure_id' && value) {
        const proc = procedures.find(p => p.id === value);
        if (proc && !item.price) {
          updated.price = String(proc.default_price);
        }
        updated.custom_name = '';
      }
      if (field === 'custom_name' && value) {
        updated.procedure_id = '';
      }
      return updated;
    }));
  };

  const totalCost = items.reduce((sum, item) => {
    const v = parseFloat(item.price);
    return sum + (isNaN(v) || v < 0 ? 0 : v);
  }, 0);

  const createPlan = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Não autenticado');
      if (!patientId) throw new Error('Selecione um paciente');
      if (!title.trim()) throw new Error('Informe um título');
      
      const validItems = items.filter(i => (i.procedure_id || i.custom_name.trim()) && parseFloat(i.price) > 0);
      if (validItems.length === 0) throw new Error('Adicione pelo menos um procedimento com valor');

      const { data: plan, error: planError } = await supabase
        .from('treatment_plans')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          patient_id: patientId,
          dentist_id: user.id,
          total_cost: totalCost,
          status: 'pending',
        })
        .select('id')
        .single();

      if (planError) throw planError;

      const planItems = validItems.map(item => ({
        treatment_plan_id: plan.id,
        procedure_id: item.procedure_id || null,
        custom_procedure_name: item.procedure_id ? null : item.custom_name.trim(),
        tooth_number: item.tooth_number ? parseInt(item.tooth_number, 10) : null,
        price: parseFloat(item.price),
        notes: item.notes.trim() || null,
      }));

      const { error: itemsError } = await supabase.from('treatment_plan_items').insert(planItems);
      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      toast.success('Orçamento criado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['treatment-plans-kanban'] });
      onOpenChange(false);
      onSuccess?.();
      // Reset
      setTitle('');
      setDescription('');
      if (!preselectedPatientId) setPatientId('');
      setItems([{ procedure_id: '', custom_name: '', tooth_number: '', price: '', notes: '' }]);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Orçamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Patient + Title */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Paciente *</Label>
              <Select value={patientId} onValueChange={setPatientId} disabled={!!preselectedPatientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {patients.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={
                family.family === 'odonto' ? 'Ex: Restaurações + Clareamento' :
                family.family === 'aesthetic' ? 'Ex: Toxina Botulínica + Preenchimento' :
                family.family === 'nutrition' ? 'Ex: Plano alimentar + Acompanhamento' :
                family.family === 'physio' ? 'Ex: 10 sessões + Avaliação' :
                family.family === 'medical' ? 'Ex: Consulta + Exames' :
                family.family === 'podology' ? 'Ex: Curativo + Atendimento mensal' :
                'Ex: Avaliação + Procedimento'
              }
            />
          </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Observações gerais do orçamento..." rows={2} />
          </div>

          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Procedimentos</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </Button>
            </div>

            {items.map((item, idx) => (
              <div key={idx} className="rounded-lg border border-border/50 p-3 space-y-3 bg-muted/20">
                <div className={`grid gap-3 ${showToothField ? 'sm:grid-cols-[1fr_80px_100px_32px]' : 'sm:grid-cols-[1fr_100px_32px]'}`}>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Procedimento</Label>
                    <ProcedureCombobox
                      procedures={procedures}
                      procedureId={item.procedure_id}
                      customName={item.custom_name}
                      onPickFromCatalog={(id) => updateItem(idx, 'procedure_id', id)}
                      onUseCustom={(name) => updateItem(idx, 'custom_name', name)}
                    />
                  </div>
                  {showToothField && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Dente</Label>
                      <Input
                        className="h-9"
                        value={item.tooth_number}
                        onChange={e => updateItem(idx, 'tooth_number', e.target.value)}
                        placeholder="Ex: 14"
                        type="number"
                        min="1"
                        max="48"
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                    <Input
                      className="h-9"
                      value={item.price}
                      onChange={e => updateItem(idx, 'price', e.target.value)}
                      placeholder="0,00"
                      type="number"
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(idx)}
                      disabled={items.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Observação</Label>
                  <Input
                    className="h-9"
                    value={item.notes}
                    onChange={e => updateItem(idx, 'notes', e.target.value)}
                    placeholder="Observação opcional..."
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Total + Submit */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <span className="text-sm text-muted-foreground">Total:</span>
              <span className="ml-2 text-lg font-semibold text-foreground">
                R$ {totalCost.toFixed(2).replace('.', ',')}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={() => createPlan.mutate()} disabled={createPlan.isPending}>
                {createPlan.isPending ? 'Criando...' : 'Criar Orçamento'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
