import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Send, MessageCircle, X, Mail, Phone, MapPin, ArrowLeft, SlidersHorizontal } from "lucide-react";
import { Loader2 } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { geocodeAddress } from "@/lib/geocode";
import { useTheme } from "@/components/ThemeProvider";
import iaclinDefaultLogo from "@/assets/iaclin-logo.png.asset.json";
import { EXTERNAL_CLINICS } from "@/data/externalClinics";
import { lookupManausCoords } from "@/data/manausCoords";

const GENERAL_NETWORK_LOGO_BG = "#F5F7FA";

type ClinicSearchRow = {
  clinic_id: string;
  clinic_name: string;
  category: "medico" | "odonto" | "outro";
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
  source?: "iaclin" | "servdonto";
};

const normalizePhone = (value: string) => value.replace(/\D/g, "");

const BR_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

const MAP_TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const DARK_MAP_FILTER = "brightness(0.20) contrast(1.35) sepia(1) saturate(4) hue-rotate(178deg)";
const DARK_MAP_BACKGROUND = "#0a1020";
const DARK_LOGO_BACKGROUND = "#142447";

const getAdaptiveMarkerSize = (zoom: number) => {
  if (zoom <= 8) return 32;
  if (zoom <= 11) return 36;
  return 44;
};

const resolveFallbackCoords = (clinic: ClinicSearchRow) => {
  if (clinic.city?.toLowerCase() === "manaus") {
    const [lat, lng] = lookupManausCoords(clinic.neighborhood);
    return { lat, lng };
  }
  return null;
};

const isManausLikeCoords = (coords: { lat: number; lng: number }) =>
  coords.lat >= -3.25 && coords.lat <= -2.9 && coords.lng >= -60.16 && coords.lng <= -59.86;

export default function OperatorProfessionals() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ClinicSearchRow[]>([]);
  const [q, setQ] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [professionalType, setProfessionalType] = useState<"all" | "medico" | "dentista">("all");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const [network, setNetwork] = useState<"iaclin" | "general">("iaclin");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: memberships } = await supabase
          .from("clinic_members")
          .select("clinic_id, user_id, role, specialty")
          .in("role", ["dentist", "admin"]);

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
            .from("clinics")
            .select(
              "id, name, city, state, cnpj, phone, email, category, logo_url, address, address_number, neighborhood, zip_code",
            )
            .in("id", clinicIds),
          supabase.from("profiles").select("id, full_name, avatar_url, phone").in("id", userIds),
          supabase
            .from("professional_specialties" as any)
            .select("user_id, specialty")
            .in("user_id", userIds),
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
              full_name: p?.full_name ?? "Profissional",
              avatar_url: p?.avatar_url ?? null,
              phone: p?.phone ?? null,
              specialties,
            };
          });

          const allSpecs = [...new Set(professionals.flatMap((p) => p.specialties).filter(Boolean))] as string[];
          const normalizedCategory: ClinicSearchRow["category"] =
            clinic.category === "medico" ? "medico" : clinic.category === "odonto" ? "odonto" : "outro";

          return {
            clinic_id: clinic.id,
            clinic_name: clinic.name ?? "Clínica",
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
        setRows(merged.map((r) => ({ ...r, source: "iaclin" as const })));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // External clinics (Servdonto network) mapped into the same row shape
  const externalRows: ClinicSearchRow[] = useMemo(() => {
    return EXTERNAL_CLINICS.map((c) => ({
      clinic_id: c.id,
      clinic_name: c.name,
      category: "odonto",
      cnpj: c.cnpj,
      city: c.city,
      state: c.state,
      phone: c.phone,
      email: c.email,
      logo_url: iaclinDefaultLogo.url,
      address: c.address,
      address_number: c.address_number,
      neighborhood: c.neighborhood,
      zip_code: c.zip_code,
      professionals_count: c.professionals.length,
      professionals: c.professionals.map((p, i) => ({
        user_id: `${c.id}-${i}`,
        full_name: p.name,
        avatar_url: null,
        phone: c.phone,
        specialties: [p.specialty],
      })),
      specialties: c.specialties,
      source: "servdonto",
    }));
  }, []);

  const activeRows = useMemo(
    () => (network === "general" ? [...rows, ...externalRows] : rows),
    [rows, externalRows, network],
  );

  const specialtyOptions = useMemo(() => {
    return [...new Set(activeRows.flatMap((r) => r.specialties).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [activeRows]);

  const stateOptions = useMemo(() => BR_STATES, []);

  const cityOptions = useMemo(() => {
    const source =
      stateFilter === "all"
        ? activeRows
        : activeRows.filter((r) => (r.state ?? "").toUpperCase() === stateFilter);
    return [...new Set(source.map((r) => r.city).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b));
  }, [activeRows, stateFilter]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return activeRows.filter((r) => {
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

      const typeMatch =
        professionalType === "all"
          ? true
          : professionalType === "medico"
            ? r.category === "medico"
            : r.category === "odonto";
      const specialtyMatch = specialtyFilter === "all" || r.specialties.includes(specialtyFilter);
      const stateMatch = stateFilter === "all" || (r.state ?? "").toUpperCase() === stateFilter;
      const cityMatch = cityFilter === "all" || (r.city ?? "").toLowerCase() === cityFilter.toLowerCase();
      return searchMatch && specialtyMatch && stateMatch && cityMatch && typeMatch;
    });
  }, [activeRows, q, specialtyFilter, stateFilter, cityFilter, professionalType]);

  const handleContact = (phone: string | null) => {
    if (!phone) return;
    const digits = normalizePhone(phone);
    if (!digits) return;
    window.open(`https://wa.me/${digits}`, "_blank");
  };

  // ====== Map ======
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const lastFitSignatureRef = useRef<string>("");
  const [coords, setCoords] = useState<Map<string, { lat: number; lng: number }>>(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [geocodeProgress, setGeocodeProgress] = useState({ done: 0, total: 0 });
  const [mapRevision, setMapRevision] = useState(0);
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
    L.control.zoom({ position: "topright" }).addTo(map);
    tileLayerRef.current = L.tileLayer(MAP_TILE_URL, { maxZoom: 20 }).addTo(map);
    const tilePane = map.getPane("tilePane");
    if (tilePane) {
      tilePane.style.filter = resolved === "dark" ? DARK_MAP_FILTER : "";
      tilePane.style.backgroundColor = resolved === "dark" ? DARK_MAP_BACKGROUND : "";
    }
    map.on("zoomend", () => setMapRevision((v) => v + 1));
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
    tileLayerRef.current = L.tileLayer(MAP_TILE_URL, { maxZoom: 20 }).addTo(map);
    const tilePane = map.getPane("tilePane");
    if (tilePane) {
      tilePane.style.filter = resolved === "dark" ? DARK_MAP_FILTER : "";
      tilePane.style.backgroundColor = resolved === "dark" ? DARK_MAP_BACKGROUND : "";
    }
  }, [resolved]);

  // Geocode all clinics once loaded
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!searched) {
        setMapLoading(false);
        setGeocodeProgress({ done: 0, total: 0 });
        return;
      }
      // Geocode every clinic with its real street address. Fallbacks are only
      // used when no reliable street result exists, never to visually move pins.
      const pending = filtered.filter((r) => !coords.has(r.clinic_id));
      if (pending.length === 0) {
        setMapLoading(false);
        setGeocodeProgress({ done: 0, total: 0 });
        return;
      }
      setMapLoading(true);
      setGeocodeProgress({ done: 0, total: pending.length });

      // Stream results: update map progressively, with a small concurrency cap to be nice to Nominatim
      // and to avoid blocking the UI on the slowest clinic.
      const CONCURRENCY = 4;
      let cursor = 0;
      let buffer: Array<[string, { lat: number; lng: number }]> = [];
      let flushTimer: ReturnType<typeof setTimeout> | null = null;
      const flush = () => {
        if (buffer.length === 0 || cancelled) return;
        const batch = buffer;
        buffer = [];
        setCoords((prev) => {
          const next = new Map(prev);
          for (const [id, c] of batch) next.set(id, c);
          return next;
        });
      };
      const scheduleFlush = () => {
        if (flushTimer) return;
        flushTimer = setTimeout(() => {
          flushTimer = null;
          flush();
        }, 150);
      };

      const worker = async () => {
        while (!cancelled) {
          const i = cursor++;
          if (i >= pending.length) return;
          const r = pending[i];
          const c = await geocodeAddress(r.address, r.city, r.state, r.zip_code, r.address_number, r.neighborhood);
          if (cancelled) return;
          setGeocodeProgress((p) => ({ done: p.done + 1, total: p.total }));
          const fallbackCoords = resolveFallbackCoords(r);
          const resolvedCoords =
            r.source === "servdonto" && c && !isManausLikeCoords(c)
              ? fallbackCoords
              : c ?? fallbackCoords;
          if (resolvedCoords) {
            buffer.push([r.clinic_id, resolvedCoords]);
            scheduleFlush();
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));
      if (cancelled) return;
      flush();
      setMapLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, searched, filtered.length]);

  // Render markers when filtered or coords change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current.clear();

    const zoom = map.getZoom();
    const markerSize = getAdaptiveMarkerSize(zoom);
    const markerAnchorX = markerSize / 2;
    const markerAnchorY = markerSize + 6;
    const bounds: L.LatLng[] = [];
    const visibleClinics = filtered
      .map((clinic) => ({ clinic, coords: coords.get(clinic.clinic_id) }))
      .filter((item): item is { clinic: ClinicSearchRow; coords: { lat: number; lng: number } } => Boolean(item.coords));

    visibleClinics.forEach(({ clinic, coords: c }) => {
      const realLatLng = L.latLng(c.lat, c.lng);
      bounds.push(realLatLng);
      const logoSrc = clinic.logo_url || iaclinDefaultLogo.url;
      const logoBg =
        clinic.source === "servdonto"
          ? GENERAL_NETWORK_LOGO_BG
          : resolved === "dark"
            ? DARK_LOGO_BACKGROUND
            : "#fff";
      const inner = `<img src="${logoSrc}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:9999px;background:${logoBg};padding:${clinic.source === "servdonto" ? 4 : 0}px;" onerror="this.onerror=null;this.src='${iaclinDefaultLogo.url}';"/>`;
      const icon = L.divIcon({
        className: "",
        html: `<div style="position:relative;width:${markerSize}px;height:${markerSize}px"><div style="position:absolute;inset:0;border-radius:9999px;background:${logoBg};border:3px solid hsl(var(--primary));box-shadow:0 2px 5px rgba(0,0,0,.14);overflow:hidden">${inner}</div><div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid hsl(var(--primary));"></div></div>`,
        iconSize: [markerSize, markerSize + 6],
        iconAnchor: [markerAnchorX, markerAnchorY],
      });
      const marker = L.marker(realLatLng, { icon, zIndexOffset: selectedId === clinic.clinic_id ? 1000 : 0 }).addTo(map);
      marker.on("click", () => {
        setSelectedId(clinic.clinic_id);
        map.setView(realLatLng, Math.max(map.getZoom(), 14), { animate: true });
      });
      markersRef.current.set(clinic.clinic_id, marker);
    });

    const fitSignature = `${searched}|${network}|${filtered.map((item) => item.clinic_id).join("|")}`;
    if (bounds.length > 0 && !selectedId && lastFitSignatureRef.current !== fitSignature) {
      lastFitSignatureRef.current = fitSignature;
      const b = L.latLngBounds(bounds).pad(0.3);
      map.fitBounds(b, { animate: false, maxZoom: network === "general" ? 12 : 14 });
    }
    setTimeout(() => map.invalidateSize(), 50);
  }, [filtered, coords, resolved, mapRevision]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = useMemo(() => filtered.find((c) => c.clinic_id === selectedId) ?? null, [filtered, selectedId]);

  const searchSuggestions = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return filtered.slice(0, 8);
  }, [filtered, q]);

  const handleSelectClinic = (clinic: ClinicSearchRow) => {
    setSelectedId(clinic.clinic_id);
    setSearchOpen(false);
    const c = coords.get(clinic.clinic_id);
    const map = mapInstanceRef.current;
    if (c && map) {
      map.setView([c.lat, c.lng], Math.max(map.getZoom(), 14), { animate: true });
    }
  };

  const handleSubmitSearch = () => {
    setSearchOpen(false);
    setSelectedId(null);
    setSearched(true);
  };

  const handleBackToSearch = () => {
    setSearched(false);
    setSelectedId(null);
    setMapLoading(false);
  };

  const noResults = searched && !mapLoading && filtered.length === 0;

  return (
    <div className="-m-4 md:-m-8 relative h-[calc(100vh-0rem)] md:h-screen overflow-hidden">
      {/* Center Leaflet zoom controls vertically on the right */}
      <style>{`
        .rede-busca-map .leaflet-top.leaflet-right {
          top: 50%;
          transform: translateY(-50%);
        }
      `}</style>
      {/* Map */}
      <div ref={mapContainerRef} className="rede-busca-map absolute inset-0 z-0" />

      {/* Loading overlay while geocoding clinics (only after a search) */}
      {searched && mapLoading && (
        <div className="absolute inset-0 z-[400] flex items-center justify-center bg-background/20 backdrop-blur-[2px] transition-opacity duration-500">
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/90 px-4 py-2 shadow-lg backdrop-blur">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm font-medium text-foreground">
              Carregando clínicas
              {geocodeProgress.total > 0 ? ` (${geocodeProgress.done}/${geocodeProgress.total})` : ""}…
            </span>
          </div>
        </div>
      )}

      {/* Centered search panel (before search) */}
      {!searched && (
        <div className="absolute inset-0 z-[600] flex items-center justify-center p-4 bg-background/40 backdrop-blur-sm">
          <Card className="w-full max-w-xl rounded-3xl border border-border/60 bg-background/95 p-6 md:p-8 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2 mb-1">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Busca de clínicas e profissionais</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-5">Encontre clínicas e profissionais da sua rede credenciada no mapa.</p>
            <div className="mb-4 inline-flex w-full rounded-xl border border-border/60 bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setNetwork("iaclin")}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                  network === "iaclin"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Busca na IACLIN
              </button>
              <button
                type="button"
                onClick={() => setNetwork("general")}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                  network === "general"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Rede Geral
              </button>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <Search className="h-4 w-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2 z-10" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Nome da clínica, profissional, CNPJ..."
                  className="pl-10 h-11 rounded-2xl"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmitSearch();
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground -mt-1">Use os filtros abaixo para refinar a sua busca.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Tipo de profissional</label>
                  <Select value={professionalType} onValueChange={(v) => setProfessionalType(v as any)}>
                    <SelectTrigger className="h-10 rounded-2xl">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="z-[1000]">
                      <SelectItem value="medico">Médicos</SelectItem>
                      <SelectItem value="dentista">Dentistas</SelectItem>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Especialidade</label>
                  <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                    <SelectTrigger className="h-10 rounded-2xl">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="z-[1000]">
                      <SelectItem value="all">Todas as especialidades</SelectItem>
                      {specialtyOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">UF</label>
                  <Select
                    value={stateFilter}
                    onValueChange={(v) => {
                      setStateFilter(v);
                      setCityFilter("all");
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-2xl">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="z-[1000]">
                      <SelectItem value="all">Todas as UFs</SelectItem>
                      {stateOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Cidade</label>
                  <Select value={cityFilter} onValueChange={setCityFilter}>
                    <SelectTrigger className="h-10 rounded-2xl">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="z-[1000]">
                      <SelectItem value="all">Todas as cidades</SelectItem>
                      {cityOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="w-full h-11 rounded-2xl mt-2" onClick={handleSubmitSearch} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando…
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" /> Buscar clínicas
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Floating back button (after search) */}
      {searched && (
        <div className="absolute top-3 left-3 md:top-4 md:left-4 z-[550] flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            onClick={handleBackToSearch}
            className="rounded-full shadow-xl border border-border/60 bg-background/90 backdrop-blur-md h-10 w-10"
            aria-label="Nova busca"
            title="Nova busca"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="inline-flex rounded-xl border border-border/60 bg-background/90 p-1 shadow-xl backdrop-blur-md">
            <button
              type="button"
              onClick={() => setNetwork("iaclin")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                network === "iaclin"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              IACLIN
            </button>
            <button
              type="button"
              onClick={() => setNetwork("general")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                network === "general"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Rede Geral
            </button>
          </div>
        </div>
      )}

      {/* No results message */}
      {noResults && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center p-4 pointer-events-none">
          <Card className="pointer-events-auto rounded-2xl border border-border/60 bg-background/95 p-6 shadow-2xl backdrop-blur-md text-center max-w-sm">
            <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <div className="font-semibold mb-1">Nenhuma clínica encontrada</div>
            <p className="text-sm text-muted-foreground mb-4">
              Não há clínicas que correspondam aos filtros selecionados.
            </p>
            <Button size="sm" onClick={handleBackToSearch} className="rounded-xl">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Ajustar filtros
            </Button>
          </Card>
        </div>
      )}

      {/* Bottom info panel */}
      {selected && (
        <div className="absolute inset-x-0 bottom-0 z-[500] p-3 md:p-4 pointer-events-none">
          <Card className="pointer-events-auto mx-auto max-w-4xl rounded-2xl border border-border/60 bg-background/95 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-start gap-4">
              <Avatar
                className="h-14 w-14 shrink-0"
                style={
                  selected.source === "servdonto"
                    ? { backgroundColor: GENERAL_NETWORK_LOGO_BG }
                    : undefined
                }
              >
                <AvatarImage
                  src={selected.logo_url ?? undefined}
                  className={selected.source === "servdonto" ? "object-contain p-1.5" : undefined}
                />
                <AvatarFallback className="bg-primary/10 text-primary text-base font-semibold">
                  {selected.clinic_name
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{selected.clinic_name}</div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <Badge variant="outline" className="text-[10px]">
                        {selected.category === "medico"
                          ? "Médica"
                          : selected.category === "odonto"
                            ? "Odontológica"
                            : "Outras"}
                      </Badge>
                      {selected.specialties.slice(0, 3).map((s) => (
                        <Badge key={s} variant="secondary" className="text-[10px]">
                          {s}
                        </Badge>
                      ))}
                      <Badge variant="outline" className="text-[10px]">
                        {selected.professionals_count} profissional(is)
                      </Badge>
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
                        {[selected.address, selected.address_number].filter(Boolean).join(", ")}
                        {selected.neighborhood ? ` · ${selected.neighborhood}` : ""}
                        {selected.city ? ` · ${selected.city}` : ""}
                        {selected.state ? `/${selected.state}` : ""}
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
                          {p.full_name}
                          {p.specialties[0] ? ` · ${p.specialties[0]}` : ""}
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
                        `/operadora/convites?name=${encodeURIComponent(selected.clinic_name)}&email=${encodeURIComponent(selected.email ?? "")}`,
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
    </div>
  );
}
