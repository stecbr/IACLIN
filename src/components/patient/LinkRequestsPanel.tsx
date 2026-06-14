import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function LinkRequestsPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['my-patient-link-requests', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_link_requests')
        .select('id, clinic_id, requested_by_user_id, expires_at, status, created_at')
        .eq('patient_user_id', user!.id)
        .eq('status', 'pending')
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;

      const clinicIds = Array.from(new Set((data ?? []).map(r => r.clinic_id).filter(Boolean))) as string[];
      const userIds = Array.from(new Set((data ?? []).map(r => r.requested_by_user_id)));

      const [clinicsRes, profilesRes] = await Promise.all([
        clinicIds.length
          ? supabase.from('clinics').select('id, name, logo_url').in('id', clinicIds)
          : Promise.resolve({ data: [] as any[] }),
        userIds.length
          ? supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const clinics = new Map((clinicsRes.data ?? []).map((c: any) => [c.id, c]));
      const profiles = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
      return (data ?? []).map(r => ({
        ...r,
        clinic: r.clinic_id ? clinics.get(r.clinic_id) : null,
        requester: profiles.get(r.requested_by_user_id) ?? null,
      }));
    },
  });

  const respond = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'accept' | 'reject' }) => {
      const { error } = await supabase.functions.invoke('respond-patient-link', {
        body: { request_id: id, action },
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.action === 'accept' ? 'Vinculação aceita' : 'Solicitação recusada');
      qc.invalidateQueries({ queryKey: ['my-patient-link-requests'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (requests.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Solicitações de vinculação
          <Badge variant="secondary">{requests.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((r: any) => {
          const who = r.clinic?.name || r.requester?.full_name || 'Um profissional';
          return (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{who}</p>
                <p className="text-xs text-muted-foreground">
                  Deseja adicionar você à lista de pacientes. Expira em{' '}
                  {formatDistanceToNow(new Date(r.expires_at), { locale: ptBR, addSuffix: false })}.
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ id: r.id, action: 'reject' })}
                >
                  Recusar
                </Button>
                <Button
                  size="sm"
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ id: r.id, action: 'accept' })}
                >
                  Aceitar
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}