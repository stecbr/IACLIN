import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Send, MessageCircle, X, Mail, Phone, MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { geocodeAddress } from '@/lib/geocode';
import { useTheme } from '@/components/ThemeProvider';

type ClinicSearchRow = {
  clinic_id: string;
  clinic_name: string;
  category: 'medico' | 'odonto' | 'outro';
  cnpj: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  address: string | null;
  address_number: string | null;
  neighborhood: string | null;
  zip_code: string | null;
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
            .select('id, name, city, state, cnpj, phone, email, category, logo_url, address, address_number, neighborhood, zip_code')
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
            logo_url: clinic.logo_url ?? null,
            address: clinic.address ?? null,
            address_number: clinic.address_number ?? null,
            neighborhood: clinic.neighborhood ?? null,
            zip_code: clinic.zip_code ?? null,
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

  // ====== Map ======
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [coords, setCoords] = useState<Map<string, { lat: number; lng: number }>>(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { resolved } = useTheme();

  // Init map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [-14.235, -51.9253], // Brazil center
      zoom: 4,
      zoomControl: false,
      attributionControl: false,
    });
    L.control.zoom({ position: 'topright' }).addTo(map);
    tileLayerRef.current = L.tileLayer(
      resolved === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { maxZoom: 20 },
    ).addTo(map);
    mapInstanceRef.current = map;
    return () => {
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap tile layer on theme change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    tileLayerRef.current = L.tileLayer(
      resolved === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { maxZoom: 20 },
    ).addTo(map);
  }, [resolved]);

  // Geocode all clinics once loaded
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = new Map(coords);
      const pending = rows.filter((r) => !next.has(r.clinic_id));
      const results = await Promise.allSettled(
        pending.map((r) =>
          geocodeAddress(r.address, r.city, r.state, r.zip_code, r.address_number, r.neighborhood).then((c) => ({
            id: r.clinic_id,
            c,
          })),
        ),
      );
      if (cancelled) return;
      let changed = false;
      for (const res of results) {
        if (res.status === 'fulfilled' && res.value.c) {
          next.set(res.value.id, res.value.c);
          changed = true;
        }
      }
      if (changed) setCoords(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  // Render markers when filtered or coords change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current.clear();

    const bounds: L.LatLng[] = [];
    filtered.forEach((clinic) => {
      const c = coords.get(clinic.clinic_id);
      if (!c) return;
      const latlng = L.latLng(c.lat, c.lng);
      bounds.push(latlng);
      const initials = clinic.clinic_name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
      const inner = clinic.logo_url
        ? `<img src="${clinic.logo_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:9999px"/>`
        : `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:hsl(var(--primary));color:#fff;border-radius:9999px;font-weight:700;font-size:13px;">${initials}</div>`;
      const icon = L.divIcon({
        className: '',
        html: `<div style="position:relative;width:44px;height:44px"><div style="position:absolute;inset:0;border-radius:9999px;background:#fff;border:3px solid hsl(var(--primary));box-shadow:0 8px 18px rgba(0,0,0,.35);overflow:hidden">${inner}</div><div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid hsl(var(--primary));"></div></div>`,
        iconSize: [44, 50],
        iconAnchor: [22, 50],
      });
      const marker = L.marker(latlng, { icon }).addTo(map);
      marker.on('click', () => {
        setSelectedId(clinic.clinic_id);
        map.setView(latlng, Math.max(map.getZoom(), 14), { animate: true });
      });
      markersRef.current.set(clinic.clinic_id, marker);
    });

    if (bounds.length > 0 && !selectedId) {
      map.fitBounds(L.latLngBounds(bounds).pad(0.2), { animate: false });
    }
    setTimeout(() => map.invalidateSize(), 50);
  }, [filtered, coords]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = useMemo(
    () => filtered.find((c) => c.clinic_id === selectedId) ?? null,
    [filtered, selectedId],
  );

  return (
    <div className="-m-4 md:-m-8 relative h-[calc(100vh-4rem)] overflow-hidden">
      {/* Center Leaflet zoom controls vertically on the right */}
      <style>{`
        .rede-busca-map .leaflet-top.leaflet-right {
          top: 50%;
          transform: translateY(-50%);
        }
      `}</style>
      {/* Map */}
      <div ref={mapContainerRef} className="rede-busca-map absolute inset-0 z-0" />

      {/* Floating filters */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-3 md:p-4">
        <Card className="pointer-events-auto mx-auto max-w-5xl rounded-2xl border border-border/60 bg-background/85 p-3 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2 mb-2 px-1">
            <h1 className="text-base font-semibold">Rede de Busca</h1>
            <Badge variant="outline" className="text-[10px]">
              {filtered.length} clínica{filtered.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <div className="md:col-span-2 relative">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar clínica, profissional..."
                className="pl-9 h-9 rounded-xl bg-background/70"
              />
            </div>
            <Select value={professionalType} onValueChange={(v) => setProfessionalType(v as any)}>
              <SelectTrigger className="h-9 rounded-xl bg-background/70"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent className="z-[1000]">
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="medico">Médicos</SelectItem>
                <SelectItem value="dentista">Dentistas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
              <SelectTrigger className="h-9 rounded-xl bg-background/70"><SelectValue placeholder="Especialidade" /></SelectTrigger>
              <SelectContent className="z-[1000]">
                <SelectItem value="all">Todas especialidades</SelectItem>
                {specialtyOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="h-9 rounded-xl bg-background/70"><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent className="z-[1000]">
                <SelectItem value="all">Todas UFs</SelectItem>
                {stateOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="h-9 rounded-xl bg-background/70"><SelectValue placeholder="Cidade" /></SelectTrigger>
              <SelectContent className="z-[1000]">
                <SelectItem value="all">Todas cidades</SelectItem>
                {cityOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </Card>
      </div>

      {/* Bottom info panel */}
      {selected && (
        <div className="absolute inset-x-0 bottom-0 z-[500] p-3 md:p-4 pointer-events-none">
          <Card className="pointer-events-auto mx-auto max-w-4xl rounded-2xl border border-border/60 bg-background/95 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-start gap-4">
              <Avatar className="h-14 w-14 shrink-0">
                <AvatarImage src={selected.logo_url ?? undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-base font-semibold">
                  {selected.clinic_name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{selected.clinic_name}</div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <Badge variant="outline" className="text-[10px]">
                        {selected.category === 'medico' ? 'Médica' : selected.category === 'odonto' ? 'Odontológica' : 'Outras'}
                      </Badge>
                      {selected.specialties.slice(0, 3).map((s) => (
                        <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                      ))}
                      <Badge variant="outline" className="text-[10px]">{selected.professionals_count} profissional(is)</Badge>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                    aria-label="Fechar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  {(selected.address || selected.city) && (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span className="truncate">
                        {[selected.address, selected.address_number].filter(Boolean).join(', ')}
                        {selected.neighborhood ? ` · ${selected.neighborhood}` : ''}
                        {selected.city ? ` · ${selected.city}` : ''}
                        {selected.state ? `/${selected.state}` : ''}
                      </span>
                    </div>
                  )}
                  {selected.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{selected.phone}</span>
                    </div>
                  )}
                  {selected.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{selected.email}</span>
                    </div>
                  )}
                  {selected.cnpj && <div>CNPJ {selected.cnpj}</div>}
                </div>
                {selected.professionals.length > 0 && (
                  <div className="mt-3 text-xs">
                    <div className="text-muted-foreground mb-1">Profissionais:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.professionals.slice(0, 5).map((p) => (
                        <Badge key={p.user_id} variant="outline" className="text-[10px] font-normal">
                          {p.full_name}{p.specialties[0] ? ` · ${p.specialties[0]}` : ''}
                        </Badge>
                      ))}
                      {selected.professionals.length > 5 && (
                        <span className="text-muted-foreground">+{selected.professionals.length - 5}</span>
                      )}
                    </div>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    disabled={!selected.phone && !selected.professionals[0]?.phone}
                    onClick={() => handleContact(selected.phone ?? selected.professionals[0]?.phone ?? null)}
                  >
                    <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                  </Button>
                  {selected.email && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => window.open(`mailto:${selected.email}`)}
                    >
                      <Mail className="h-4 w-4 mr-1" /> E-mail
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="rounded-xl"
                    onClick={() =>
                      navigate(
                        `/operadora/convites?name=${encodeURIComponent(selected.clinic_name)}&email=${encodeURIComponent(selected.email ?? '')}`,
                      )
                    }
                  >
                    <Send className="h-4 w-4 mr-1" /> Convidar
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-[400] flex items-center justify-center pointer-events-none">
          <div className="bg-background/80 backdrop-blur px-4 py-2 rounded-xl text-sm text-muted-foreground border border-border/60">
            Carregando rede de clínicas...
          </div>
        </div>
      )}
    </div>
  );
}
