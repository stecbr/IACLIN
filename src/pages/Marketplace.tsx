import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MarketplaceHeader } from "@/components/marketplace/MarketplaceHeader";
import { MarketplaceFilters } from "@/components/marketplace/MarketplaceFilters";
import { DoctorCard, type DoctorData } from "@/components/marketplace/DoctorCard";
import { MarketplaceMap, type MarketplaceMapHandle, type MapBounds } from "@/components/marketplace/MarketplaceMap";
import { Button } from "@/components/ui/button";
import { Map as MapIcon, List, Loader2, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { startOfDay, addDays } from "date-fns";

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Marketplace() {
  const isMobile = useIsMobile();
  const mapRef = useRef<MarketplaceMapHandle>(null);
  const [doctors, setDoctors] = useState<DoctorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);
  const [searchName, setSearchName] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [selectedInsurance, setSelectedInsurance] = useState<string | null>(null);
  const [showMapMobile, setShowMapMobile] = useState(false);
  const [clinicCoords, setClinicCoords] = useState<Map<string, { lat: number; lng: number }>>(new Map());
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [highlightedClinicId, setHighlightedClinicId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDoctors() {
      setLoading(true);
      setFetchError(false);
      try {
      const { data: members } = await supabase
        .from("clinic_members")
        .select("user_id, clinic_id, role, specialty")
        .in("role", ["dentist", "admin"]);

      if (!members || members.length === 0) {
        setDoctors([]);
        return;
      }

      const userIds = [...new Set(members.map((m) => m.user_id))];
      const clinicIds = [...new Set(members.map((m) => m.clinic_id))];

      const today = startOfDay(new Date());

      const [{ data: profiles }, { data: clinics }, { data: templates }, { data: appointments }, { data: insurancePlansData }] = await Promise.all([
        supabase.rpc("get_marketplace_doctor_profiles", { _user_ids: userIds }),
        supabase.from("clinics").select("id, name, city, state, phone, address, address_number, neighborhood, zip_code, is_published").in("id", clinicIds).eq("is_published", true),
        supabase
          .from("professional_schedule_template")
          .select("user_id, clinic_id, weekday, start_time, end_time, is_active")
          .in("user_id", userIds)
          .eq("is_active", true),
        supabase
          .from("appointments")
          .select("dentist_id, start_time, end_time, status")
          .in("dentist_id", userIds)
          .gte("start_time", today.toISOString())
          .lte("start_time", addDays(today, 30).toISOString())
          .neq("status", "cancelled"),
        supabase.from("insurance_plans").select("clinic_id, name").in("clinic_id", clinicIds).eq("is_active", true),
      ]);

      const profileMap = new Map(((profiles ?? []) as any[]).map((p: any) => [p.id, p]));
      const clinicMap = new Map((clinics ?? []).map((c) => [c.id, c]));
      const clinicInsuranceMap = new Map<string, string[]>();
      for (const plan of (insurancePlansData ?? []) as any[]) {
        const arr = clinicInsuranceMap.get(plan.clinic_id) ?? [];
        arr.push(plan.name);
        clinicInsuranceMap.set(plan.clinic_id, arr);
      }

      // Derive upcoming dates (next 30 days) from the weekly template
      const availMap = new Map<string, { date: string; start: string; end: string }[]>();
      for (const t of (templates ?? []) as any[]) {
        const k = `${t.user_id}|${t.clinic_id}`;
        const arr = availMap.get(k) ?? [];
        for (let i = 0; i < 30; i++) {
          const d = addDays(today, i);
          if (d.getDay() === t.weekday) {
            arr.push({ date: toLocalDateStr(d), start: t.start_time, end: t.end_time });
          }
        }
        availMap.set(k, arr);
      }

      const doctorList: DoctorData[] = members
        .filter((m) => availMap.has(`${m.user_id}|${m.clinic_id}`))
        .map((m: any) => {
          const profile = profileMap.get(m.user_id);
          const clinic = clinicMap.get(m.clinic_id);
          const appts = (appointments ?? []).filter((a) => a.dentist_id === m.user_id);
          const shifts = (availMap.get(`${m.user_id}|${m.clinic_id}`) ?? []).sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.start.localeCompare(b.start);
          });
          return {
            userId: m.user_id,
            specialty: m.specialty ?? null,
            fullName: profile?.full_name ?? "",
            avatarUrl: profile?.avatar_url ?? null,
            clinicId: m.clinic_id,
            clinicName: clinic?.name ?? "Clínica",
            clinicCity: clinic?.city ?? null,
            clinicState: clinic?.state ?? null,
            clinicPhone: clinic?.phone ?? null,
            clinicAddress: clinic?.address ?? null,
            clinicAddressNumber: (clinic as any)?.address_number ?? null,
            clinicNeighborhood: (clinic as any)?.neighborhood ?? null,
            clinicZipCode: clinic?.zip_code ?? null,
            profilePhone: (profile as any)?.phone ?? null,
            profileCity: (profile as any)?.city ?? null,
            profileState: (profile as any)?.state ?? null,
            profileAddress: (profile as any)?.address ?? null,
            profileAddressNumber: (profile as any)?.address_number ?? null,
            profileNeighborhood: (profile as any)?.neighborhood ?? null,
            shifts,
            appointments: appts.map((a) => ({
              start_time: a.start_time,
              end_time: a.end_time,
              status: a.status,
            })),
            insurancePlans: clinicInsuranceMap.get(m.clinic_id) ?? [],
          };
        });

      const seen = new Set<string>();
      const unique = doctorList.filter((d) => {
        const key = `${d.userId}_${d.clinicId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setDoctors(unique);
      } catch {
        setFetchError(true);
        setDoctors([]);
      } finally {
        setLoading(false);
      }
    }

    fetchDoctors();
  }, [fetchKey]);

  const handleToggleSpecialty = useCallback((spec: string) => {
    setSelectedSpecialties((prev) =>
      prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec]
    );
  }, []);

  const filtered = useMemo(() => {
    return doctors.filter((d) => {
      const nameMatch =
        !searchName || d.fullName.toLowerCase().includes(searchName.toLowerCase());
      const cityMatch =
        !searchCity || (d.clinicCity ?? "").toLowerCase().includes(searchCity.toLowerCase());

      const specMatch =
        selectedSpecialties.length === 0 ||
        (d.specialty && selectedSpecialties.includes(d.specialty));

      const insMatch =
        !selectedInsurance ||
        (d.insurancePlans ?? []).some(
          (p) => p.toLowerCase() === selectedInsurance.toLowerCase(),
        );

      // Map bounds filter
      let boundsMatch = true;
      if (mapBounds) {
        const coords = clinicCoords.get(d.clinicId);
        if (coords) {
          boundsMatch =
            coords.lat >= mapBounds.south &&
            coords.lat <= mapBounds.north &&
            coords.lng >= mapBounds.west &&
            coords.lng <= mapBounds.east;
        } else {
          boundsMatch = false;
        }
      }

      return nameMatch && cityMatch && specMatch && insMatch && boundsMatch;
    });
  }, [doctors, searchName, searchCity, selectedSpecialties, selectedInsurance, mapBounds, clinicCoords]);

  const clinicsGeo = useMemo(() => {
    const seen = new Set<string>();
    return doctors
      .filter((d) => {
        if (seen.has(d.clinicId)) return false;
        seen.add(d.clinicId);
        return true;
      })
      .map((d) => ({
        clinicId: d.clinicId,
        clinicName: d.clinicName,
        address: d.clinicAddress,
        addressNumber: d.clinicAddressNumber,
        neighborhood: d.clinicNeighborhood,
        city: d.clinicCity,
        state: d.clinicState,
        zipCode: d.clinicZipCode,
      }));
  }, [doctors]);

  const handleBoundsSearch = useCallback((bounds: MapBounds) => {
    setMapBounds(bounds);
  }, []);

  const handleCoordsReady = useCallback((coords: Map<string, { lat: number; lng: number }>) => {
    setClinicCoords(coords);
  }, []);

  const handleShowOnMap = useCallback((clinicId: string) => {
    if (isMobile) setShowMapMobile(true);
    setTimeout(() => mapRef.current?.focusClinic(clinicId), 200);
  }, [isMobile]);

  const handleMarkerClick = useCallback((clinicId: string) => {
    setHighlightedClinicId(clinicId);
    setTimeout(() => {
      document.getElementById(`doctor-card-${clinicId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <MarketplaceHeader
        searchName={searchName}
        searchCity={searchCity}
        onSearchNameChange={setSearchName}
        onSearchCityChange={setSearchCity}
      />
      <MarketplaceFilters
        selectedSpecialties={selectedSpecialties}
        onToggleSpecialty={handleToggleSpecialty}
        selectedInsurance={selectedInsurance}
        onChangeInsurance={setSelectedInsurance}
      />

      {/* Map bounds active badge */}
      {mapBounds && (
        <div className="flex justify-center border-b px-4 py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMapBounds(null)}
          >
            <X className="mr-1 h-3 w-3" />
            Limpar filtro do mapa
          </Button>
        </div>
      )}

      {/* Mobile map toggle */}
      {isMobile && (
        <div className="flex justify-center border-b px-4 py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMapMobile(!showMapMobile)}
          >
            {showMapMobile ? (
              <>
                <List className="mr-1 h-4 w-4" /> Ver lista
              </>
            ) : (
              <>
                <MapIcon className="mr-1 h-4 w-4" /> Ver mapa
              </>
            )}
          </Button>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-4 px-4 py-4">
        {isMobile && showMapMobile ? (
          <MarketplaceMap
            ref={mapRef}
            className="w-full"
            clinics={clinicsGeo}
            doctors={filtered}
            onBoundsSearch={handleBoundsSearch}
            onCoordsReady={handleCoordsReady}
            onMarkerClick={handleMarkerClick}
            highlightedClinicId={highlightedClinicId}
          />
        ) : (
          <>
            <div className={isMobile ? "w-full" : "w-3/5"}>
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : fetchError ? (
                <div className="py-20 text-center space-y-3">
                  <p className="text-base font-medium text-foreground">Não foi possível carregar os profissionais.</p>
                  <p className="text-sm text-muted-foreground">Verifique sua conexão e tente novamente.</p>
                  <Button variant="outline" size="sm" onClick={() => setFetchKey((k) => k + 1)}>
                    Tentar novamente
                  </Button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-20 text-center text-muted-foreground">
                  <p className="text-lg font-medium">Nenhum profissional encontrado</p>
                  <p className="text-sm">Tente ajustar os filtros de busca.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {filtered.length} profissional{filtered.length !== 1 ? "is" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
                  </p>
                  {filtered.map((doctor) => (
                    <DoctorCard
                      key={`${doctor.userId}_${doctor.clinicId}`}
                      doctor={doctor}
                      onShowOnMap={handleShowOnMap}
                      onHover={setHighlightedClinicId}
                      highlighted={highlightedClinicId === doctor.clinicId}
                    />
                  ))}
                </div>
              )}
            </div>

            {!isMobile && (
              <div className="sticky top-[130px] h-[calc(100vh-160px)] w-2/5">
                <MarketplaceMap
                  ref={mapRef}
                  className="h-full"
                  clinics={clinicsGeo}
                  doctors={filtered}
                  onBoundsSearch={handleBoundsSearch}
                  onCoordsReady={handleCoordsReady}
                  onMarkerClick={handleMarkerClick}
                  highlightedClinicId={highlightedClinicId}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
