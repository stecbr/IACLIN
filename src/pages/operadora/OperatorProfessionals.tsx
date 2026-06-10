import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Send, MessageCircle } from 'lucide-react';

type ClinicSearchRow = {
  clinic_id: string;
  clinic_name: string;
  category: 'medico' | 'odonto' | 'outro';
  cnpj: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  professionals_count: number;
  professionals: Array<{
    user_id: string;
    full_name: string;
    avatar_url: string | null;
    phone: string | null;
    specialties: string[];
  }>;
  specialties: string[];
};

const normalizePhone = (value: string) => value.replace(/\D/g, '');

const BR_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
];

export default function OperatorProfessionals() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ClinicSearchRow[]>([]);
  const [q, setQ] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [professionalType, setProfessionalType] = useState<'all' | 'medico' | 'dentista'>('all');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: memberships } = await supabase
          .from('clinic_members')
          .select('clinic_id, user_id, role, specialty')
          .in('role', ['dentist', 'admin']);

        const normalizedMemberships = (memberships ?? []) as Array<{
          clinic_id: string;
          user_id: string;
          role: string;
          specialty: string | null;
        }>;
        const clinicIds = [...new Set(normalizedMemberships.map((m) => m.clinic_id))];
        const userIds = [...new Set(normalizedMemberships.map((m) => m.user_id))];

        if (clinicIds.length === 0 || userIds.length === 0) {
          setRows([]);
          return;
        }

        const [{ data: clinics }, { data: profiles }, { data: specs }] = await Promise.all([
          supabase
            .from('clinics')
            .select('id, name, city, state, cnpj, phone, email, category')
            .in('id', clinicIds),
          supabase
            .from('profiles')
            .select('id, full_name, avatar_url, phone')
            .in('id', userIds),
          supabase
            .from('professional_specialties' as any)
            .select('user_id, specialty')
            .in('user_id', userIds),
        ]);

        const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

        const specMap = new Map<string, string[]>();
        (specs ?? []).forEach((s: any) => {
          const prev = specMap.get(s.user_id) ?? [];
          if (!prev.includes(s.specialty)) specMap.set(s.user_id, [...prev, s.specialty]);
        });

        const membersByClinic = new Map<string, typeof normalizedMemberships>();
        normalizedMemberships.forEach((m) => {
          const prev = membersByClinic.get(m.clinic_id) ?? [];
          membersByClinic.set(m.clinic_id, [...prev, m]);
        });

        const merged: ClinicSearchRow[] = (clinics ?? []).map((clinic: any) => {
          const clinicMembers = membersByClinic.get(clinic.id) ?? [];
          const professionals = clinicMembers.map((m) => {
            const p = profileMap.get(m.user_id);
            const specialties = specMap.get(m.user_id) ?? (m.specialty ? [m.specialty] : []);
            return {
              user_id: m.user_id,
              full_name: p?.full_name ?? 'Profissional',
              avatar_url: p?.avatar_url ?? null,
              phone: p?.phone ?? null,
              specialties,
            };
          });

          const allSpecs = [...new Set(professionals.flatMap((p) => p.specialties).filter(Boolean))] as string[];
          const normalizedCategory: ClinicSearchRow['category'] =
            clinic.category === 'medico' ? 'medico' : clinic.category === 'odonto' ? 'odonto' : 'outro';

          return {
            clinic_id: clinic.id,
            clinic_name: clinic.name ?? 'Clínica',
            category: normalizedCategory,
            cnpj: clinic.cnpj ?? null,
            city: clinic.city ?? null,
            state: clinic.state ?? null,
            phone: clinic.phone ?? null,
            email: clinic.email ?? null,
            professionals_count: professionals.length,
            professionals,
            specialties: allSpecs,
          };
        });

        merged.sort((a, b) => a.clinic_name.localeCompare(b.clinic_name));
        setRows(merged);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const specialtyOptions = useMemo(() => {
    return [...new Set(rows.flatMap((r) => r.specialties).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const stateOptions = useMemo(() => BR_STATES, []);

  const cityOptions = useMemo(() => {
    const source = stateFilter === 'all'
      ? rows
      : rows.filter((r) => (r.state ?? '').toUpperCase() === stateFilter);
    return [...new Set(source.map((r) => r.city).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b));
  }, [rows, stateFilter]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      const searchMatch = !term
        ? true
        : [
            r.clinic_name,
            r.cnpj,
            r.city,
            r.state,
            r.phone,
            r.email,
            ...r.specialties,
            ...r.professionals.map((p) => p.full_name),
            ...r.professionals.flatMap((p) => p.specialties),
          ]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(term));

      const typeMatch = professionalType === 'all'
        ? true
        : professionalType === 'medico'
          ? r.category === 'medico'
          : r.category === 'odonto';
      const specialtyMatch = specialtyFilter === 'all' || r.specialties.includes(specialtyFilter);
      const stateMatch = stateFilter === 'all' || (r.state ?? '').toUpperCase() === stateFilter;
      const cityMatch = cityFilter === 'all' || (r.city ?? '').toLowerCase() === cityFilter.toLowerCase();
      return searchMatch && specialtyMatch && stateMatch && cityMatch && typeMatch;
    });
  }, [rows, q, specialtyFilter, stateFilter, cityFilter, professionalType]);

  const handleContact = (phone: string | null) => {
    if (!phone) return;
    const digits = normalizePhone(phone);
    if (!digits) return;
    window.open(`https://wa.me/${digits}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Rede de Busca</h1>
        <p className="text-sm text-muted-foreground">Busque clínicas da base IACLIN para prospectar profissionais e enviar convites.</p>
      </div>

      <Card className="rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por clínica, profissional, especialidade, cidade..."
              className="pl-9"
            />
          </div>
          <div>
            <Select
              value={professionalType}
              onValueChange={(v) => setProfessionalType(v as 'all' | 'medico' | 'dentista')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Médicos e dentistas</SelectItem>
                <SelectItem value="medico">Só médicos</SelectItem>
                <SelectItem value="dentista">Só dentistas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Especialidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas especialidades</SelectItem>
                {specialtyOptions.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas UFs</SelectItem>
                {stateOptions.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Cidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas cidades</SelectItem>
                {cityOptions.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">{filtered.length} clínica(s) encontrada(s)</div>
      </Card>

      <Card className="rounded-xl p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando rede de clínicas...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma clínica encontrada com os filtros atuais.</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((clinic) => {
              const mainProfessional = clinic.professionals[0];
              return (
              <div key={clinic.clinic_id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={mainProfessional?.avatar_url ?? undefined} />
                    <AvatarFallback>
                      {(clinic.clinic_name || 'C')
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{clinic.clinic_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {clinic.phone ?? 'Telefone da clínica não informado'}
                      {clinic.state ? ` · ${clinic.state}` : ''}
                      {clinic.city ? ` · ${clinic.city}` : ''}
                      {clinic.cnpj ? ` · CNPJ ${clinic.cnpj}` : ''}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="outline">{clinic.category === 'medico' ? 'Médica' : clinic.category === 'odonto' ? 'Odontológica' : 'Outras'}</Badge>
                      {clinic.specialties.length === 0 ? (
                        <Badge variant="outline">Sem especialidade</Badge>
                      ) : (
                        clinic.specialties.slice(0, 3).map((s) => (
                          <Badge key={s} variant="secondary">{s}</Badge>
                        ))
                      )}
                      <Badge variant="outline">{clinic.professionals_count} profissional(is)</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {clinic.professionals.slice(0, 3).map((p) => p.full_name).join(' · ')}
                      {clinic.professionals.length > 3 ? ` · +${clinic.professionals.length - 3}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    disabled={!clinic.phone && !mainProfessional?.phone}
                    onClick={() => handleContact(clinic.phone ?? mainProfessional?.phone ?? null)}
                  >
                    <MessageCircle className="h-4 w-4 mr-1" /> Contato
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-xl"
                    onClick={() => navigate(`/operadora/convites?name=${encodeURIComponent(clinic.clinic_name)}&email=${encodeURIComponent(clinic.email ?? '')}`)}
                  >
                    <Send className="h-4 w-4 mr-1" /> Convidar
                  </Button>
                </div>
              </div>
            )})}
          </div>
        )}
      </Card>
    </div>
  );
}
