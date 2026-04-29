import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Stethoscope, Mail, X, Copy, AlertTriangle, UserMinus } from 'lucide-react';
import { AddMedicoDialog } from '@/components/clinica/AddMedicoDialog';
import { ClinicInviteCodeCard } from '@/components/clinica/ClinicInviteCodeCard';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { specialtyLabel, isCatalogSpecialty, registrationLabelForSpecialty } from '@/components/SpecialtySelect';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

interface MemberRow {
  id: string;
  user_id: string;
  role: string;
  specialty: string | null;
  registration_number: string | null;
  is_owner: boolean;
  profile?: { full_name: string | null; avatar_url: string | null } | null;
}

export default function ClinicaMedicos() {
  const { currentClinicId, user } = useAuth();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<MemberRow | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['clinica-medicos', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('clinic_members')
        .select('id, user_id, role, specialty, registration_number, is_owner')
        .eq('clinic_id', currentClinicId!)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const userIds = (rows ?? []).map((r) => r.user_id);
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (rows ?? []).map((r) => ({
        ...r,
        profile: profileMap.get(r.user_id) ?? null,
      })) as MemberRow[];
    },
  });

  const { data: invites = [] } = useQuery({
    queryKey: ['clinic-invites', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_invites')
        .select('id, email, full_name, specialty, token, status, expires_at, created_at')
        .eq('clinic_id', currentClinicId!)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const revokeInvite = async (id: string) => {
    const { error } = await supabase.from('clinic_invites').update({ status: 'revoked' }).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Convite revogado'); qc.invalidateQueries({ queryKey: ['clinic-invites'] }); }
  };

  const copyInviteLink = async (token: string) => {
    const url = `${window.location.origin}/auth?invite=${token}`;
    await navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const handleUnlink = async () => {
    if (!unlinkTarget) return;
    setUnlinking(true);
    const { error } = await supabase.from('clinic_members').delete().eq('id', unlinkTarget.id);
    setUnlinking(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Profissional desvinculado');
    setUnlinkTarget(null);
    qc.invalidateQueries({ queryKey: ['clinica-medicos'] });
  };

  const initials = (name?: string | null) =>
    (name ?? 'M').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <PageHeader title="Médicos" description="Gestão de profissionais vinculados à clínica">
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Adicionar médico
        </Button>
      </PageHeader>

      <ClinicInviteCodeCard />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                <Stethoscope className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium">Nenhum médico cadastrado</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Adicione o primeiro profissional à sua clínica.</p>
              <Button onClick={() => setAddOpen(true)} size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Adicionar médico
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CRM / CRO</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {initials(m.profile?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{m.profile?.full_name ?? '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.registration_number
                        ? `${registrationLabelForSpecialty(m.specialty)} ${m.registration_number}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {m.specialty ? (
                          <>
                            <span className={isCatalogSpecialty(m.specialty) ? 'text-foreground' : 'text-muted-foreground'}>
                              {specialtyLabel(m.specialty)}
                            </span>
                            {!isCatalogSpecialty(m.specialty) && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle className="h-3.5 w-3.5 text-warning cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs text-xs">
                                    Especialidade fora do catálogo. Este profissional não aparece nas buscas dos pacientes.
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {m.is_owner ? (
                        <Badge variant="default">Administrador</Badge>
                      ) : (
                        <Badge variant="secondary">Profissional</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!m.is_owner && m.user_id !== user?.id ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setUnlinkTarget(m)}
                              >
                                <UserMinus className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-xs">
                              Desvincular da clínica
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {invites.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-6 py-4 border-b flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Convites pendentes ({invites.length})</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.full_name ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{inv.email}</TableCell>
                    <TableCell>
                      {inv.specialty ? (
                        <div className="flex items-center gap-1.5">
                          <span className={isCatalogSpecialty(inv.specialty) ? 'text-foreground' : 'text-muted-foreground'}>
                            {specialtyLabel(inv.specialty)}
                          </span>
                          {!isCatalogSpecialty(inv.specialty) && (
                            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(inv.expires_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => copyInviteLink(inv.token)} className="gap-1.5">
                          <Copy className="h-3.5 w-3.5" /> Link
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => revokeInvite(inv.id)} className="text-destructive hover:text-destructive">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AddMedicoDialog open={addOpen} onOpenChange={setAddOpen} />

      <AlertDialog open={!!unlinkTarget} onOpenChange={(o) => !o && setUnlinkTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular profissional?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{unlinkTarget?.profile?.full_name ?? 'Este profissional'}</strong> perderá o acesso à clínica
              imediatamente. Ele poderá ser vinculado novamente através do código da clínica.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlinking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleUnlink();
              }}
              disabled={unlinking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {unlinking ? 'Desvinculando...' : 'Desvincular'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}