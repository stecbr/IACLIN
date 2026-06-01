import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Search } from 'lucide-react';

interface Row {
  id: string;
  clinic_id: string;
  status: string;
  requested_at?: string;
  updated_at?: string;
  clinic_name?: string | null;
  clinic_cnpj?: string | null;
  clinic_city?: string | null;
  doctors?: Array<{ name: string; specialty: string | null; registration_number: string | null }>;
}

export default function OperatorNetwork() {
  const { operatorId, user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [revoking, setRevoking] = useState<Row | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!operatorId) return;
    setLoading(true);
    const { data: creds } = await supabase
      .from('operator_credentialings')
      .select('id, clinic_id, status, requested_at, updated_at')
      .eq('operator_id', operatorId)
      .order('requested_at', { ascending: false });
    const all = (creds ?? []) as Row[];

    // Keep only the latest credentialing per clinic for this operator.
    const latestMap = new Map<string, Row>();
    for (const row of all) {
      const key = row.clinic_id;
      const prev = latestMap.get(key);
      if (!prev) {
        latestMap.set(key, row);
        continue;
      }
      const prevTs = new Date(prev.requested_at ?? prev.updated_at ?? 0).getTime();
      const currTs = new Date(row.requested_at ?? row.updated_at ?? 0).getTime();
      if (currTs >= prevTs) latestMap.set(key, row);
    }
    const list = Array.from(latestMap.values()).filter((r) => r.status === 'approved');

    if (list.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    const clinicIds = [...new Set(list.map((r) => r.clinic_id))];
    const [{ data: clinics }, { data: clinicMembers }, { data: profiles }] = await Promise.all([
      supabase.from('clinics').select('id, name, city, cnpj').in('id', clinicIds),
      supabase.from('clinic_members').select('id, clinic_id, user_id, specialty, registration_number, role').in('clinic_id', clinicIds).eq('role', 'dentist'),
      supabase.from('profiles').select('id, full_name'),
    ]);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const clinicMap = new Map((clinics ?? []).map((c) => [c.id, c]));
    const doctorsByClinic = new Map<string, Array<{ name: string; specialty: string | null; registration_number: string | null }>>();
    (clinicMembers ?? []).forEach((m: any) => {
      const arr = doctorsByClinic.get(m.clinic_id) ?? [];
      arr.push({
        name: profileMap.get(m.user_id)?.full_name ?? '—',
        specialty: m.specialty ?? null,
        registration_number: m.registration_number ?? null,
      });
      doctorsByClinic.set(m.clinic_id, arr);
    });

    const merged: Row[] = list.map((r) => ({
      ...r,
      clinic_name: clinicMap.get(r.clinic_id)?.name ?? '—',
      clinic_cnpj: clinicMap.get(r.clinic_id)?.cnpj ?? null,
      clinic_city: clinicMap.get(r.clinic_id)?.city ?? null,
      doctors: doctorsByClinic.get(r.clinic_id) ?? [],
    }));
    setRows(merged);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [operatorId]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      [
        r.clinic_name,
        r.clinic_city,
        r.clinic_cnpj,
        ...(r.doctors ?? []).flatMap((d) => [d.name, d.specialty, d.registration_number]),
      ]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(term))
    );
  }, [rows, q]);

  const revokeCredentialing = async () => {
    if (!revoking || !operatorId) return;
    setBusyId(revoking.id);
    const { error } = await supabase
      .from('operator_credentialings')
      .update({
        status: 'revoked',
        decided_at: new Date().toISOString(),
        decided_by: user?.id ?? null,
        rejection_reason: revokeReason || 'Revogado pela operadora (rede credenciada)',
      } as any)
      .eq('operator_id', operatorId)
      .eq('clinic_id', revoking.clinic_id)
      .eq('status', 'approved');

    setBusyId(null);
    if (error) {
      toast.error('Erro ao revogar credenciamento: ' + error.message);
      return;
    }
    toast.success('Credenciamento cancelado na rede');
    setRevoking(null);
    setRevokeReason('');
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Rede credenciada</h1>
        <p className="text-sm text-muted-foreground">Clínicas credenciadas e médicos vinculados</p>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por clínica, médico, especialidade, cidade..."
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
            Nenhuma clínica credenciada ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Clínica</th>
                  <th className="px-4 py-3 font-medium">CNPJ</th>
                  <th className="px-4 py-3 font-medium">Médicos vinculados</th>
                  <th className="px-4 py-3 font-medium">Cidade</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{r.clinic_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.clinic_cnpj ?? '—'}</td>
                    <td className="px-4 py-3">
                      {r.doctors && r.doctors.length > 0 ? (
                        <div className="space-y-1">
                          {r.doctors.slice(0, 3).map((d, i) => (
                            <div key={`${d.name}-${i}`} className="text-xs">
                              <span className="font-medium">{d.name}</span>
                              {d.specialty ? <span className="text-muted-foreground"> · {d.specialty}</span> : null}
                            </div>
                          ))}
                          {r.doctors.length > 3 ? <div className="text-xs text-muted-foreground">+{r.doctors.length - 3} médico(s)</div> : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Sem médicos vinculados</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.clinic_city ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="destructive" onClick={() => setRevoking(r)}>
                        Cancelar credenciamento
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!revoking} onOpenChange={(o) => !o && setRevoking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar credenciamento da rede</DialogTitle>
          </DialogHeader>
          <Textarea
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
            placeholder="Motivo (opcional)"
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRevoking(null)}>Voltar</Button>
            <Button variant="destructive" onClick={revokeCredentialing} disabled={busyId === revoking?.id}>
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}