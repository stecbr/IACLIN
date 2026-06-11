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
import { Search, Building2, MapPin, Stethoscope, Users, Eye, Phone, Mail, FileText, IdCard, Calendar, User as UserIcon } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getAvatarColor, getInitials } from '@/lib/avatarColor';

interface Doctor {
  user_id: string;
  name: string;
  avatar_url: string | null;
  specialty: string | null;
  specialties: string[];
  registration_number: string | null;
  is_owner: boolean;
  created_at: string | null;
}

interface Row {
  id: string;
  clinic_id: string;
  status: string;
  requested_at?: string;
  updated_at?: string;
  clinic_name?: string | null;
  clinic_cnpj?: string | null;
  clinic_city?: string | null;
  clinic_phone?: string | null;
  clinic_email?: string | null;
  clinic_address?: string | null;
  clinic_neighborhood?: string | null;
  clinic_state?: string | null;
  clinic_category_label?: string | null;
  clinic_logo_url?: string | null;
  clinic_responsible?: string | null;
  clinic_created_at?: string | null;
  doctors?: Doctor[];
}

export default function OperatorNetwork() {
  const { operatorId, user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [revoking, setRevoking] = useState<Row | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Row | null>(null);
  const [doctorViewing, setDoctorViewing] = useState<Doctor | null>(null);

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
      supabase.from('clinics').select('id, name, city, cnpj, phone, email, address, neighborhood, state, category_label, logo_url, responsible_name, created_at').in('id', clinicIds),
      supabase.from('clinic_members').select('id, clinic_id, user_id, specialty, registration_number, role, is_owner, created_at').in('clinic_id', clinicIds).eq('role', 'dentist'),
      supabase.from('profiles').select('id, full_name, avatar_url'),
    ]);

    const memberIds = (clinicMembers ?? []).map((m: any) => m.id);
    const { data: extraSpecs } = memberIds.length > 0
      ? await supabase.from('clinic_member_specialties').select('clinic_member_id, specialty').in('clinic_member_id', memberIds)
      : { data: [] as any[] };
    const specsByMember = new Map<string, string[]>();
    (extraSpecs ?? []).forEach((s: any) => {
      const arr = specsByMember.get(s.clinic_member_id) ?? [];
      if (s.specialty) arr.push(s.specialty);
      specsByMember.set(s.clinic_member_id, arr);
    });

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const clinicMap = new Map((clinics ?? []).map((c) => [c.id, c]));
    const doctorsByClinic = new Map<string, Doctor[]>();
    (clinicMembers ?? []).forEach((m: any) => {
      const arr = doctorsByClinic.get(m.clinic_id) ?? [];
      const extra = specsByMember.get(m.id) ?? [];
      const merged = Array.from(new Set([m.specialty, ...extra].filter(Boolean))) as string[];
      arr.push({
        user_id: m.user_id,
        name: profileMap.get(m.user_id)?.full_name ?? '—',
        avatar_url: profileMap.get(m.user_id)?.avatar_url ?? null,
        specialty: m.specialty ?? null,
        specialties: merged,
        registration_number: m.registration_number ?? null,
        is_owner: !!m.is_owner,
        created_at: m.created_at ?? null,
      });
      doctorsByClinic.set(m.clinic_id, arr);
    });

    const merged: Row[] = list.map((r) => {
      const c: any = clinicMap.get(r.clinic_id);
      return {
        ...r,
        clinic_name: c?.name ?? '—',
        clinic_cnpj: c?.cnpj ?? null,
        clinic_city: c?.city ?? null,
        clinic_phone: c?.phone ?? null,
        clinic_email: c?.email ?? null,
        clinic_address: c?.address ?? null,
        clinic_neighborhood: c?.neighborhood ?? null,
        clinic_state: c?.state ?? null,
        clinic_category_label: c?.category_label ?? null,
        clinic_logo_url: c?.logo_url ?? null,
        clinic_responsible: c?.responsible_name ?? null,
        clinic_created_at: c?.created_at ?? null,
        doctors: doctorsByClinic.get(r.clinic_id) ?? [],
      };
    });
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
      <Card className="rounded-xl p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Nenhuma clínica credenciada ainda.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 p-3">
            {filtered.map((r) => {
              const specialties = Array.from(
                new Set((r.doctors ?? []).map((d) => d.specialty).filter(Boolean) as string[])
              );
              return (
                <div
                  key={r.id}
                  className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{r.clinic_name}</div>
                      <div className="text-xs text-muted-foreground truncate">{r.clinic_cnpj ?? '—'}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {r.clinic_city ?? '—'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {r.doctors?.length ?? 0} médico(s)
                    </span>
                  </div>

                  {specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {specialties.slice(0, 3).map((s) => (
                        <Badge key={s} variant="secondary" className="text-[10px] font-normal">
                          {s}
                        </Badge>
                      ))}
                      {specialties.length > 3 && (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          +{specialties.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 mt-auto pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl flex-1"
                      onClick={() => setViewing(r)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Detalhes
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="rounded-xl"
                      onClick={() => setRevoking(r)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              {viewing?.clinic_name}
            </DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">CNPJ</div>
                  <div>{viewing.clinic_cnpj ?? '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Cidade</div>
                  <div>{viewing.clinic_city ?? '—'}</div>
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                  <Stethoscope className="h-3 w-3" />
                  Médicos vinculados ({viewing.doctors?.length ?? 0})
                </div>
                {viewing.doctors && viewing.doctors.length > 0 ? (
                  <div className="rounded-lg border border-border divide-y divide-border max-h-72 overflow-y-auto">
                    {viewing.doctors.map((d, i) => (
                      <div key={`${d.name}-${i}`} className="px-3 py-2 flex flex-col">
                        <span className="font-medium text-sm">{d.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {d.specialty ?? 'Sem especialidade'}
                          {d.registration_number ? ` · ${d.registration_number}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">Sem médicos vinculados.</div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setViewing(null)}>
              Fechar
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              onClick={() => {
                setRevoking(viewing);
                setViewing(null);
              }}
            >
              Cancelar credenciamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Button variant="ghost" className="rounded-xl" onClick={() => setRevoking(null)}>Voltar</Button>
            <Button variant="destructive" className="rounded-xl" onClick={revokeCredentialing} disabled={busyId === revoking?.id}>
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}