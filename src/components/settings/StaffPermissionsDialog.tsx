import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, Calendar, DoorOpen, ClipboardCheck, Users, Receipt,
  DollarSign, Bot, Sparkles, MessageSquare, FolderHeart, ClipboardList, Reply,
} from 'lucide-react';

export type StaffPermissions = {
  dashboard: boolean;
  agenda: boolean;
  salaEspera: boolean;
  aprovacoes: boolean;
  pacientes: boolean;
  abrirProntuario: boolean;
  convenios: boolean;
  financeiro: boolean;
  iaGestor: boolean;
  secretariaIa: boolean;
  chamados: boolean;
  responderChamados: boolean;
  settings: boolean;
  historicoConsultas: boolean;
};

export const STAFF_PERMISSION_DEFAULTS: Record<string, StaffPermissions> = {
  secretary: {
    dashboard: true, agenda: true, salaEspera: true, aprovacoes: true,
    pacientes: true, abrirProntuario: true, convenios: true, financeiro: true, iaGestor: true,
    secretariaIa: false, chamados: true, responderChamados: false, settings: true, historicoConsultas: false,
  },
  auxiliary: {
    dashboard: true, agenda: true, salaEspera: true, aprovacoes: false,
    pacientes: true, abrirProntuario: false, convenios: false, financeiro: false, iaGestor: false,
    secretariaIa: false, chamados: true, responderChamados: false, settings: true, historicoConsultas: false,
  },
};

/**
 * Backward-compat: turns the previous 5-key shape into the new 11-key shape
 * so existing rows in `clinic_members.permissions` keep working.
 */
export function normalizeStaffPermissions(
  stored: any,
  role: string,
): StaffPermissions {
  const base = STAFF_PERMISSION_DEFAULTS[role] ?? STAFF_PERMISSION_DEFAULTS.secretary;
  if (!stored || typeof stored !== 'object') return base;
  // Already in new shape
  if ('dashboard' in stored && 'salaEspera' in stored) {
    return { ...base, ...stored };
  }
  // Old shape → map
  return {
    ...base,
    agenda: stored.agenda ?? base.agenda,
    salaEspera: stored.agenda ?? base.salaEspera,
    pacientes: stored.pacientes ?? base.pacientes,
    abrirProntuario: stored.pacientes ?? base.abrirProntuario,
    aprovacoes: stored.aprovacoes ?? base.aprovacoes,
    financeiro: stored.financeiro ?? base.financeiro,
    iaGestor: stored.ia ?? base.iaGestor,
    chamados: stored.chamados ?? base.chamados,
  };
}

const PERMISSION_ITEMS: Array<{
  key: keyof StaffPermissions;
  label: string;
  description: string;
  icon: typeof Calendar;
}> = [
  { key: 'dashboard',    label: 'Dashboard',           description: 'Página inicial com indicadores',    icon: LayoutDashboard },
  { key: 'agenda',       label: 'Agenda',              description: 'Ver e gerenciar consultas',         icon: Calendar },
  { key: 'salaEspera',   label: 'Sala de espera',      description: 'Acompanhar chegadas e fila',        icon: DoorOpen },
  { key: 'aprovacoes',   label: 'Aprovações',          description: 'Aprovar pedidos de pacientes',      icon: ClipboardCheck },
  { key: 'pacientes',    label: 'Pacientes',           description: 'Cadastro e prontuários',             icon: Users },
  { key: 'abrirProntuario', label: 'Abrir prontuário', description: 'Acessar o atalho "Abrir prontuário"', icon: FolderHeart },
  { key: 'convenios',    label: 'Convênios',           description: 'Planos e operadoras',                icon: Receipt },
  { key: 'financeiro',   label: 'Financeiro',          description: 'Lançamentos e recebimentos',         icon: DollarSign },
  { key: 'iaGestor',     label: 'IA Gestor',           description: 'Assistente de gestão por IA',        icon: Bot },
  { key: 'secretariaIa', label: 'Secretária IA',       description: 'Configurar a secretária no WhatsApp', icon: Sparkles },
  { key: 'chamados',           label: 'Chamados / Suporte',          description: 'Abrir chamados para operadoras e para a clínica',    icon: MessageSquare },
  { key: 'responderChamados', label: 'Responder chamados da equipe', description: 'Ver e responder chamados enviados à administração',   icon: Reply },
  { key: 'historicoConsultas', label: 'Histórico de consultas',  description: 'Ver histórico mensal de consultas por profissional', icon: ClipboardList },
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
  const [perms, setPerms] = useState<StaffPermissions>(
    normalizeStaffPermissions(currentPermissions, roleKey),
  );
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  // Fetch fresh permissions directly from DB every time the dialog opens
  useEffect(() => {
    if (!open || !memberId) {
      setPerms(normalizeStaffPermissions(currentPermissions, memberRole ?? 'secretary'));
      return;
    }
    setLoading(true);
    (supabase as any)
      .from('clinic_members')
      .select('permissions, role')
      .eq('id', memberId)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        const freshRole = data?.role ?? memberRole ?? 'secretary';
        setPerms(normalizeStaffPermissions(data?.permissions ?? null, freshRole));
      })
      .finally(() => setLoading(false));
  }, [open, memberId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      await queryClient.invalidateQueries({ queryKey: ['staff-permissions'] });
      await queryClient.invalidateQueries({ queryKey: ['clinic-members'] });
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
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permissões — {memberName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            Defina o que <strong>{memberName}</strong> pode acessar na plataforma.
          </p>
          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
          {!loading && (
            <div className="grid gap-2 sm:grid-cols-2">
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
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Salvando...' : 'Salvar permissões'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
