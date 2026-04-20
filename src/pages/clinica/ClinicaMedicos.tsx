import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Stethoscope } from 'lucide-react';
import { AddMedicoDialog } from '@/components/clinica/AddMedicoDialog';
import { Skeleton } from '@/components/ui/skeleton';

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
  const { currentClinicId } = useAuth();
  const [addOpen, setAddOpen] = useState(false);

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

  const initials = (name?: string | null) =>
    (name ?? 'M').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <PageHeader title="Médicos" description="Gestão de profissionais vinculados à clínica">
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Adicionar médico
        </Button>
      </PageHeader>

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
                    <TableCell className="text-muted-foreground">{m.registration_number ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{m.specialty ?? '—'}</TableCell>
                    <TableCell>
                      {m.is_owner ? (
                        <Badge variant="default">Administrador</Badge>
                      ) : (
                        <Badge variant="secondary" className="capitalize">{m.role}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddMedicoDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}