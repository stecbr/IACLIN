import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DoctorCard, type DoctorData } from "@/components/marketplace/DoctorCard";
import {
  MarketplaceMap,
  type MarketplaceMapHandle,
  type MapBounds,
} from "@/components/marketplace/MarketplaceMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, MapPin, Loader2, ArrowRight, Map as MapIcon, List, X,
} from "lucide-react";
import { startOfDay, addDays } from "date-fns";
import { motion } from "framer-motion";

// ─── Helpers ────────────────────────────────────────────────────────────────
function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const SPECIALTIES = [
  { id: "clinico-geral",    label: "Clínico Geral" },
  { id: "ortodontia",       label: "Ortodontia" },
  { id: "implantodontia",   label: "Implantodontia" },
  { id: "endodontia",       label: "Endodontia" },
  { id: "periodontia",      label: "Periodontia" },
  { id: "estetica",         label: "Estética" },
  { id: "psicologia",       label: "Psicologia" },
  { id: "nutricao",         label: "Nutrição" },
  { id: "fisioterapia",     label: "Fisioterapia" },
];

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, ease: "easeOut" },
};

export function MarketplaceSection() {
  const navigate = useNavigate();
  const mapRef = useRef<MarketplaceMapHandle>(null);

  const [doctors, setDoctors] = useState<DoctorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [selectedSpec, setSelectedSpec] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false); // mobile toggle
  const [clinicCoords, setClinicCoords] = useState<Map<string, { lat: number; lng: number }>>(new Map());
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);

  // ── Fetch doctors ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: members } = await supabase
        .from("clinic_members")
        .select("user_id, clinic_id, role, specialty")
        .in("role", ["dentist", "admin"]);

      if (!members?.length) { setLoading(false); return; }

      const userIds  = [...new Set(members.map((m) => m.user_id))];
      const clinicIds = [...new Set(members.map((m) => m.clinic_id))];
      const today = startOfDay(new Date());

      const [{ data: profiles }, { data: clinics }, { data: templates }, { data: appointments }] =
        await Promise.all([
          supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds),
          supabase.from("clinics").select("id, name, city, state, phone, address, zip_code").in("id", clinicIds),
          supabase.from("professional_schedule_template")
            .select("user_id, clinic_id, weekday, start_time, end_time, is_active")
            .in("user_id", userIds).eq("is_active", true),
          supabase.from("appointments")
            .select("dentist_id, start_time, end_time, status")
            .in("dentist_id", userIds)
            .gte("start_time", today.toISOString())
            .lte("start_time", addDays(today, 7).toISOString())
            .neq("status", "cancelled"),
        ]);

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const clinicMap  = new Map((clinics  ?? []).map((c) => [c.id, c]));

      const availMap = new Map<string, { date: string; start: string; end: string }[]>();
      for (const t of (templates ?? []) as any[]) {
        const k = `${t.user_id}|${t.clinic_id}`;
        const arr = availMap.get(k) ?? [];
        for (let i = 0; i < 30; i++) {
          const d = addDays(today, i);
          if (d.getDay() === t.weekday)
            arr.push({ date: toLocalDateStr(d), start: t.start_time, end: t.end_time });
        }
        availMap.set(k, arr);
      }

      const seen = new Set<string>();
      const list: DoctorData[] = members
        .filter((m) => availMap.has(`${m.user_id}|${m.clinic_id}`))
        .reduce<DoctorData[]>((acc, m: any) => {
          const key = `${m.user_id}_${m.clinic_id}`;
          if (seen.has(key)) return acc;
          seen.add(key);
          const profile = profileMap.get(m.user_id);
          const clinic  = clinicMap.get(m.clinic_id);
          const appts   = (appointments ?? []).filter((a) => a.dentist_id === m.user_id);
          const shifts  = (availMap.get(`${m.user_id}|${m.clinic_id}`) ?? []).sort((a, b) =>
            a.date !== b.date ? a.date.localeCompare(b.date) : a.start.localeCompare(b.start));
          acc.push({
            userId: m.user_id,
            specialty: m.specialty ?? null,
            fullName: profile?.full_name ?? "Profissional",
            avatarUrl: profile?.avatar_url ?? null,
            clinicId: m.clinic_id,
            clinicName: clinic?.name ?? "Clínica",
            clinicCity: clinic?.city ?? null,
            clinicState: clinic?.state ?? null,
            clinicPhone: clinic?.phone ?? null,
            clinicAddress: clinic?.address ?? null,
            clinicZipCode: clinic?.zip_code ?? null,
            shifts,
            appointments: appts.map((a) => ({
              start_time: a.start_time,
              end_time: a.end_time,
              status: a.status,
            })),
          });
          return acc;
        }, []);

      setDoctors(list);
      setLoading(false);
    })();
  }, []);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return doctors.filter((d) => {
      const nameOk = !searchName || d.fullName.toLowerCase().includes(searchName.toLowerCase()) ||
        (d.clinicName ?? "").toLowerCase().includes(searchName.toLowerCase()) ||
        (d.specialty  ?? "").toLowerCase().includes(searchName.toLowerCase());
      const cityOk = !searchCity || (d.clinicCity ?? "").toLowerCase().includes(searchCity.toLowerCase());
      const specOk = !selectedSpec || (d.specialty ?? "").toLowerCase().includes(selectedSpec.toLowerCase());
      let boundsOk = true;
      if (mapBounds) {
        const c = clinicCoords.get(d.clinicId);
        boundsOk = c
          ? c.lat >= mapBounds.south && c.lat <= mapBounds.north &&
            c.lng >= mapBounds.west  && c.lng <= mapBounds.east
          : false;
      }
      return nameOk && cityOk && specOk && boundsOk;
    });
  }, [doctors, searchName, searchCity, selectedSpec, mapBounds, clinicCoords]);

  const clinicsGeo = useMemo(() => {
    const seen = new Set<string>();
    return doctors.filter((d) => { if (seen.has(d.clinicId)) return false; seen.add(d.clinicId); return true; })
      .map((d) => ({ clinicId: d.clinicId, clinicName: d.clinicName, address: d.clinicAddress, city: d.clinicCity, state: d.clinicState, zipCode: d.clinicZipCode }));
  }, [doctors]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleShowOnMap = useCallback((clinicId: string) => {
    setShowMap(true);
    setTimeout(() => mapRef.current?.focusClinic(clinicId), 250);
  }, []);

  const handleBoundsSearch = useCallback((b: MapBounds) => setMapBounds(b), []);
  const handleCoordsReady  = useCallback((c: Map<string, { lat: number; lng: number }>) => setClinicCoords(c), []);

  const handleBuscar = () => {
    const params = new URLSearchParams();
    if (searchName) params.set("name", searchName);
    if (searchCity) params.set("city", searchCity);
    if (selectedSpec) params.set("specialty", selectedSpec);
    navigate(`/marketplace${params.toString() ? "?" + params.toString() : ""}`);
  };

  const toggleSpec = (id: string) => setSelectedSpec((s) => (s === id ? null : id));

  return (
    <section id="marketplace" className="container py-20">
      {/* ── Cabeçalho ──────────────────────────────────────────────────────── */}
      <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Rede Médica</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Sua clínica encontrada por novos pacientes.
        </h2>
        <p className="mt-4 text-muted-foreground">
          Profissionais do Iaclin ganham um perfil público com agenda em tempo real — pacientes
          buscam por especialidade, cidade e horário, e agendam em poucos cliques.
        </p>
      </motion.div>

      {/* ── Barra de busca ─────────────────────────────────────────────────── */}
      <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.05 }} className="mx-auto mt-10 max-w-3xl">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2 shadow-card">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            placeholder="Nome do profissional, clínica ou procedimento"
            className="h-9 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
          />
          <div className="mx-2 hidden h-6 w-px bg-border sm:block" />
          <MapPin className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
          <Input
            placeholder="Cidade"
            className="hidden h-9 max-w-[140px] border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 sm:block"
            value={searchCity}
            onChange={(e) => setSearchCity(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
          />
          <Button size="sm" className="ml-auto shrink-0" onClick={handleBuscar}>
            Buscar
          </Button>
        </div>

        {/* Chips de especialidade */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {SPECIALTIES.map((s) => (
            <Badge
              key={s.id}
              variant={selectedSpec === s.id ? "default" : "outline"}
              className="cursor-pointer rounded-full px-3 py-1 text-xs transition-colors hover:border-primary hover:text-primary"
              onClick={() => toggleSpec(s.id)}
            >
              {s.label}
              {selectedSpec === s.id && (
                <X className="ml-1 h-2.5 w-2.5 inline" />
              )}
            </Badge>
          ))}
        </div>

        {/* Contador + toggle mapa (mobile) */}
        <div className="mt-4 flex items-center justify-between">
          {!loading && (
            <p className="text-sm text-muted-foreground">
              {filtered.length} profissional{filtered.length !== 1 ? "is" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
              {mapBounds && (
                <button className="ml-2 text-primary underline text-xs" onClick={() => setMapBounds(null)}>
                  limpar filtro do mapa
                </button>
              )}
            </p>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto flex gap-1.5 text-xs sm:hidden"
            onClick={() => setShowMap((v) => !v)}
          >
            {showMap ? <><List className="h-3.5 w-3.5" /> Ver lista</> : <><MapIcon className="h-3.5 w-3.5" /> Ver mapa</>}
          </Button>
        </div>
      </motion.div>

      {/* ── Split view: lista + mapa ────────────────────────────────────────── */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mx-auto mt-6 max-w-7xl"
      >
        <div className="flex gap-4">
          {/* Lista de médicos */}
          {(!showMap) && (
            <div className="w-full sm:w-3/5 overflow-y-auto pr-1" style={{ maxHeight: 680 }}>
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed py-16 text-center">
                  <p className="font-medium text-foreground">Nenhum profissional encontrado</p>
                  <p className="mt-1 text-sm text-muted-foreground">Tente ajustar os filtros ou</p>
                  <Button variant="link" size="sm" onClick={handleBuscar} className="mt-1">
                    buscar na Rede Médica completa
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filtered.slice(0, 10).map((d) => (
                    <DoctorCard
                      key={`${d.userId}_${d.clinicId}`}
                      doctor={d}
                      onShowOnMap={handleShowOnMap}
                    />
                  ))}
                  {filtered.length > 10 && (
                    <button
                      onClick={handleBuscar}
                      className="w-full rounded-xl border border-dashed py-5 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      + {filtered.length - 10} profissionais — ver todos na Rede Médica
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mapa — sticky, altura igual à lista */}
          <div
            className={`${showMap ? "w-full" : "hidden sm:block sm:w-2/5"} sticky top-24`}
            style={{ height: 680 }}
          >
            <MarketplaceMap
              ref={mapRef}
              className="h-full rounded-2xl overflow-hidden shadow-lg border border-border"
              clinics={clinicsGeo}
              doctors={[]}
              onBoundsSearch={handleBoundsSearch}
              onCoordsReady={handleCoordsReady}
            />
          </div>
        </div>
      </motion.div>

      {/* ── CTA final ──────────────────────────────────────────────────────── */}
      <motion.div {...fadeUp} className="mt-10 flex justify-center">
        <Button asChild size="lg" variant="outline" className="shadow-card gap-2">
          <a href="/marketplace">
            Explorar Rede Médica completa
            <ArrowRight className="h-4 w-4" />
          </a>
        </Button>
      </motion.div>
    </section>
  );
}
