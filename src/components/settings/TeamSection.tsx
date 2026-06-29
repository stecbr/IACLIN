import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Crown, ListChecks, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MemberProceduresDialog } from './MemberProceduresDialog';
import { StaffPermissionsDialog, type StaffPermissions } from './StaffPermissionsDialog';
import { useSeatUsage } from '@/hooks/useSeatUsage';

const roleLabels: Record<string, string> = {
  admin:     'Administrador',
  dentist:   'Profissional',
  secretary: 'Secretário(a)',
  auxiliary: 'Auxiliar Adm',
};

const roleColors: Record<string, string> = {
  admin:     'default',
  dentist:   'secondary',
  secretary: 'outline',
  auxiliary: 'outline',
};

export default function TeamSection() {
  const { user, currentClinicId, isClinicOwner } = useAuth();
  const queryClient = useQueryClient();
  const { usage } = useSeatUsage(currentClinicId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: '', full_name: '', password: '', role: 'secretary' });
  const [saving, setSaving] = useState(false);
  const [procEditor, setProcEditor] = useState<{ id: string; name: string } | null>(null);
  const [permEditor, setPermEditor] = useState<{
    id: string;
    name: string;
    role: string;
    permissions: StaffPermissions | null;
  } | null>(null);
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: '',
    message: '',
  });

  const { data: clinicCategory } = useQuery({
    queryKey: ['clinic-category', currentClinicId],
    queryFn: async () => {
      if (!currentClinicId) return null;
      const { data } = await supabase.from('clinics').select('category').eq('id', currentClinicId).maybeSingle();
      return (data?.category as string | null) ?? null;
    },
    enabled: !!currentClinicId,
  });

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['clinic-members', currentClinicId],
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      if (!currentClinicId) return [];
      const { data, error } = await (supabase as any)
        .from('clinic_members')
        .select('id, user_id, role, is_owner, created_at, permissions, is_active')
        .eq('clinic_id', currentClinicId);
      if (error) throw error;

      const userIds = (data ?? []).map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

      const memberIds = (data ?? []).map((m: any) => m.id);
      const { data: procCounts } = memberIds.length
        ? await supabase
            .from('clinic_member_procedures' as any)
            .select('clinic_member_id')
            .in('clinic_member_id', memberIds)
        : { data: [] as Array<{ clinic_member_id: string }> };
      const procCountMap = new Map<string, number>();
      for (const r of ((procCounts ?? []) as unknown as Array<{ clinic_member_id: string }>)) {
        procCountMap.set(r.clinic_member_id, (procCountMap.get(r.clinic_member_id) ?? 0) + 1);
      }

      return (data ?? []).map((m: any) => ({
        ...m,
        full_name: profileMap.get(m.user_id)?.full_name ?? 'Sem nome',
        procedure_count: procCountMap.get(m.id) ?? 0,
      }));
    },
    enabled: !!currentClinicId,
  });

  const handleAdd = async () => {
    if (!currentClinicId) return;
    setSaving(true);
    const handleFailure = (rawMsg: string) => {
      const msg = rawMsg || 'Erro ao adicionar funcionário.';
      const emailDup = /já está cadastrado|already been registered|email_exists/i.test(msg);
      if (emailDup) {
        setErrorDialog({
          open: true,
          title: 'E-mail já cadastrado',
          message: 'Este e-mail já está cadastrado na plataforma. Use outro e-mail para o funcionário.',
        });
        return;
      }
      if (/at least 6|6 caracteres/i.test(msg)) {
        toast.error('A senha precisa ter ao menos 6 caracteres.');
        return;
      }
      toast.error(msg);
    };

    let data: any = null;
    let error: any = null;
    try {
      const res = await supabase.functions.invoke('invite-member', {
        body: { ...form, clinic_id: currentClinicId },
      });
      data = res.data;
      error = res.error;
    } catch (e: any) {
      // Rede ou exceção inesperada — não deixa propagar para o overlay
      error = e;
    }

    if (error) {
      handleFailure('Não foi possível adicionar o funcionário. Tente novamente.');
      setSaving(false);
      return;
    }

    if (data?.ok === false) {
      const code = String(data.code ?? '');
      const message = String(data.error ?? 'Erro ao adicionar funcionário.');
      if (code === 'email_exists') {
        setErrorDialog({
          open: true,
          title: 'E-mail já cadastrado',
          message,
        });
      } else {
        handleFailure(message);
      }
      setSaving(false);
      return;
    }

    if (data?.error) {
      handleFailure(String(data.error));
      setSaving(false);
      return;
    }

    toast.success(`${form.full_name} adicionado(a) com sucesso!`);
    setForm({ email: '', full_name: '', password: '', role: 'secretary' });
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ['clinic-members'] });
    setSaving(false);
  };

  const handleRemove = async (memberId: string, memberUserId: string) => {
    if (memberUserId === user?.id) {
      toast.error('Você não pode remover a si mesmo.');
      return;
    }
    try {
      const { error } = await (supabase as any).rpc('remove_clinic_member', { _member_id: memberId });
      if (error) throw error;
      toast.success('Profissional desvinculado da clínica.');
      queryClient.invalidateQueries({ queryKey: ['clinic-members'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-seat-usage'] });
    } catch (err: any) {
      toast.error(err.message ?? 'Falha ao remover membro');
    }
  };

  const handleToggleActive = async (memberId: string, nextValue: boolean) => {
    try {
      const { error } = await (supabase as any).rpc('set_clinic_member_active', {
        _member_id: memberId,
        _is_active: nextValue,
      });
      if (error) throw error;
      toast.success(nextValue ? 'Acesso liberado.' : 'Acesso suspenso.');
      queryClient.invalidateQueries({ queryKey: ['clinic-members'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-seat-usage'] });
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

  const isStaffRole = (role: string) => role === 'secretary' || role === 'auxiliary';

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Equipe</CardTitle>
          <CardDescription>Gerencie os membros da sua clínica.</CardDescription>
          {usage && (
            <div className="pt-2">
              <Badge
                variant={!usage.unlimited && usage.available <= 0 ? 'destructive' : 'outline'}
                className="font-normal"
              >
                {usage.unlimited
                  ? `${usage.used} profissionais (plano ilimitado)`
                  : `${usage.used} de ${usage.limit} profissionais utilizados`}
                {usage.plan_name ? ` · ${usage.plan_name}` : ''}
              </Badge>
            </div>
          )}
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
                <DialogTitle>Adicionar Funcionário</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="Maria Silva"
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="maria@clinica.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Senha temporária</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Papel</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="secretary">Secretário(a)</SelectItem>
                      <SelectItem value="auxiliary">Auxiliar Adm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleAdd}
                  disabled={saving || !form.email || !form.full_name || !form.password}
                  className="w-full"
                >
                  {saving ? 'Cadastrando...' : 'Cadastrar Funcionário'}
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
                <TableHead>Procedimentos</TableHead>
                <TableHead>Acesso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m: any) => {
                const canEditPerms = isClinicOwner && !m.is_owner && isStaffRole(m.role);
                return (
                <TableRow
                  key={m.id}
                  className={`${m.is_active === false ? 'opacity-60 ' : ''}${canEditPerms ? 'cursor-pointer hover:bg-muted/40' : ''}`}
                  onClick={() => {
                    if (!canEditPerms) return;
                    setPermEditor({
                      id: m.id,
                      name: m.full_name,
                      role: m.role,
                      permissions: (m.permissions as StaffPermissions | null) ?? null,
                    });
                  }}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {m.full_name}
                      {m.is_owner && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={roleColors[m.role] as any}>{roleLabels[m.role] ?? m.role}</Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {(m.role === 'dentist' || m.role === 'admin') ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                        onClick={() => setProcEditor({ id: m.id, name: m.full_name })}
                      >
                        <ListChecks className="h-3.5 w-3.5" />
                        {m.procedure_count > 0
                          ? `${m.procedure_count} procedimento(s)`
                          : 'Adicionar'}
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {m.is_owner ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={m.is_active !== false}
                          disabled={!isClinicOwner}
                          onCheckedChange={(v) => handleToggleActive(m.id, v)}
                        />
                        <span className="text-xs text-muted-foreground">
                          {m.is_active === false ? 'Suspenso' : 'Ativo'}
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {isClinicOwner && !m.is_owner && isStaffRole(m.role) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Permissões"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() =>
                            setPermEditor({
                              id: m.id,
                              name: m.full_name,
                              role: m.role,
                              permissions: (m.permissions as StaffPermissions | null) ?? null,
                            })
                          }
                        >
                          <ShieldCheck className="h-4 w-4" />
                        </Button>
                      )}
                      {isClinicOwner && !m.is_owner && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemove(m.id, m.user_id)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );})}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <MemberProceduresDialog
        open={!!procEditor}
        onOpenChange={(o) => !o && setProcEditor(null)}
        clinicMemberId={procEditor?.id ?? null}
        clinicCategory={clinicCategory ?? null}
        memberName={procEditor?.name}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['clinic-members'] })}
      />

      <StaffPermissionsDialog
        open={!!permEditor}
        onOpenChange={(o) => !o && setPermEditor(null)}
        memberId={permEditor?.id ?? null}
        memberName={permEditor?.name}
        memberRole={permEditor?.role}
        currentPermissions={permEditor?.permissions}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['clinic-members'] })}
      />

      <AlertDialog
        open={errorDialog.open}
        onOpenChange={(o) => setErrorDialog((s) => ({ ...s, open: o }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{errorDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{errorDialog.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorDialog((s) => ({ ...s, open: false }))}>
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
