import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { MemberProceduresEditor } from './MemberProceduresEditor';

type ClinicMembership = {
  id: string;
  clinic_id: string;
  role: string;
  clinic_name: string;
  clinic_category: string | null;
};

/**
 * Tela do profissional para declarar quais procedimentos ele realiza
 * em cada clínica em que é membro.
 */
export function MyProceduresPerClinic() {
  const { user } = useAuth();
  const [memberships, setMemberships] = useState<ClinicMembership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('clinic_members')
        .select('id, clinic_id, role, clinics:clinics(name, category)')
        .eq('user_id', user.id);
      if (cancelled) return;
      const rows = (data ?? []) as any[];
      const list: ClinicMembership[] = rows
        .filter((r) => r.role === 'dentist' || r.role === 'admin')
        .map((r) => ({
          id: r.id,
          clinic_id: r.clinic_id,
          role: r.role,
          clinic_name: r.clinics?.name ?? 'Clínica',
          clinic_category: r.clinics?.category ?? null,
        }));
      setMemberships(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return (
      <Card className="shadow-card border-border/50">
        <CardContent className="py-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando suas clínicas…
        </CardContent>
      </Card>
    );
  }

  if (memberships.length === 0) {
    return (
      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Procedimentos que realizo</CardTitle>
          <CardDescription>
            Você ainda não está vinculado a nenhuma clínica como profissional.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {memberships.map((m) => (
        <Card key={m.id} className="shadow-card border-border/50">
          <CardHeader>
            <CardTitle className="text-base">{m.clinic_name}</CardTitle>
            <CardDescription>
              Marque os procedimentos que você atende nesta clínica. A Secretária IA e a recepção usam essa lista
              para direcionar pacientes corretamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MemberProceduresEditor clinicMemberId={m.id} clinicId={m.clinic_id} clinicCategory={m.clinic_category} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}