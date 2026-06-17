import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Calendar, Users, DollarSign, Bot, MessageSquare } from 'lucide-react';

export type StaffPermissions = {
  agenda: boolean;
  pacientes: boolean;
  financeiro: boolean;
  ia: boolean;
  chamados: boolean;
};

export const STAFF_PERMISSION_DEFAULTS: Record<string, StaffPermissions> = {
  secretary: { agenda: true, pacientes: true, financeiro: true, ia: false, chamados: true },
  auxiliary: { agenda: true, pacientes: true, financeiro: false, ia: false, chamados: false },
};

const PERMISSION_ITEMS: Array<{
  key: keyof StaffPermissions;
  label: string;
  description: string;
  icon: typeof Calendar;
}> = [
  { key: 'agenda',     label: 'Agenda & Sala de Espera', description: 'Visualizar e gerenciar a agenda da clínica', icon: Calendar },
  { key: 'pacientes',  label: 'Pacientes & Aprovações',  description: 'Acessar cadastro e dados dos pacientes',     icon: Users },
  { key: 'financeiro', label: 'Financeiro',               description: 'Visualizar lançamentos e recebimentos',      icon: DollarSign },
  { key: 'ia',         label: 'Inteligência Artificial',  description: 'Usar IA Gestor na plataforma',              icon: Bot },
  { key: 'chamados',   label: 'Chamados',                 description: 'Acessar a área de suporte e chamados',      icon: MessageSquare },
];

interface StaffPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string | null;
  memberName?: string;
  memberRole?: string;
  currentPermissions?: StaffPermissions | null;
  onSaved?: () => void;
}

export function StaffPermissionsDialog({
  open,
  onOpenChange,
  memberId,
  memberName,
  memberRole,
  currentPermissions,
  onSaved,
}: StaffPermissionsDialogProps) {
  const roleKey = memberRole ?? 'secretary';
  const defaults = STAFF_PERMISSION_DEFAULTS[roleKey] ?? STAFF_PERMISSION_DEFAULTS.secretary;

  const [perms, setPerms] = useState<StaffPermissions>(currentPermissions ?? defaults);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPerms(currentPermissions ?? STAFF_PERMISSION_DEFAULTS[memberRole ?? 'secretary'] ?? STAFF_PERMISSION_DEFAULTS.secretary);
  }, [currentPermissions, memberRole, open]);

  const toggle = (key: keyof StaffPermissions) => {
    setPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!memberId) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('clinic_members')
        .update({ permissions: perms })
        .eq('id', memberId);
      if (error) throw error;
      toast.success('Permissões salvas');
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao salvar permissões');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Permissões — {memberName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            Defina o que <strong>{memberName}</strong> pode acessar na plataforma.
          </p>
          <div className="space-y-2">
            {PERMISSION_ITEMS.map(({ key, label, description, icon: Icon }) => (
              <div
                key={key}
                className="flex items-center justify-between gap-4 rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${perms[key] ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </div>
                <Switch checked={perms[key]} onCheckedChange={() => toggle(key)} />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar permissões'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
