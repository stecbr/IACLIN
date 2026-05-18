import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';

interface Row {
  id: string;
  professional_user_id: string;
  clinic_id: string;
  clinic_member_id: string;
  status: string;
  full_name?: string | null;
  specialty?: string | null;
  registration_number?: string | null;
  clinic_name?: string | null;
  clinic_city?: string | null;
}

export default function OperatorNetwork() {
  const { operatorId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!operatorId) return;
    (async () => {
      const { data: creds } = await supabase
        .from('operator_credentialings')
        .select('id, professional_user_id, clinic_id, clinic_member_id, status')
        .eq('operator_id', operatorId)
        .eq('status', 'approved');
      const list = (creds ?? []) as Row[];
      if (list.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }
      const userIds = [...new Set(list.map((r) => r.professional_user_id))];
      const memberIds = [...new Set(list.map((r) => r.clinic_member_id))];
      const clinicIds = [...new Set(list.map((r) => r.clinic_id))];
      const [{ data: profiles }, { data: members }, { data: clinics }] = await Promise.all([
        supabase.from('profiles').select('id, full_name').in('id', userIds),
        supabase.from('clinic_members').select('id, specialty, registration_number').in('id', memberIds),
        supabase.from('clinics').select('id, name, city').in('id', clinicIds),
      ]);
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const memberMap = new Map((members ?? []).map((m) => [m.id, m]));
      const clinicMap = new Map((clinics ?? []).map((c) => [c.id, c]));
      const merged: Row[] = list.map((r) => ({
        ...r,
        full_name: profileMap.get(r.professional_user_id)?.full_name ?? '—',
        specialty: memberMap.get(r.clinic_member_id)?.specialty ?? null,
        registration_number: memberMap.get(r.clinic_member_id)?.registration_number ?? null,
        clinic_name: clinicMap.get(r.clinic_id)?.name ?? '—',
        clinic_city: clinicMap.get(r.clinic_id)?.city ?? null,
      }));
      setRows(merged);
      setLoading(false);
    })();
  }, [operatorId]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      [r.full_name, r.specialty, r.clinic_name, r.clinic_city, r.registration_number]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(term))
    );
  }, [rows, q]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Rede credenciada</h1>
        <p className="text-sm text-muted-foreground">Profissionais ativos na sua rede</p>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, especialidade, cidade..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Nenhum profissional credenciado ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Profissional</th>
                  <th className="px-4 py-3 font-medium">Especialidade</th>
                  <th className="px-4 py-3 font-medium">Registro</th>
                  <th className="px-4 py-3 font-medium">Clínica</th>
                  <th className="px-4 py-3 font-medium">Cidade</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{r.full_name}</td>
                    <td className="px-4 py-3">
                      {r.specialty ? <Badge variant="secondary">{r.specialty}</Badge> : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.registration_number ?? '—'}</td>
                    <td className="px-4 py-3">{r.clinic_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.clinic_city ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}