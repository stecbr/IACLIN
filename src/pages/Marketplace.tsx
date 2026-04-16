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

export default function Marketplace() {
  const isMobile = useIsMobile();
  const mapRef = useRef<MarketplaceMapHandle>(null);
  const [doctors, setDoctors] = useState<DoctorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [showMapMobile, setShowMapMobile] = useState(false);
  const [clinicCoords, setClinicCoords] = useState<Map<string, { lat: number; lng: number }>>(new Map());
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);

  useEffect(() => {
    async function fetchDoctors() {
      setLoading(true);
      const { data: members } = await supabase
        .from("clinic_members")
        .select("user_id, clinic_id, role")
        .in("role", ["dentist", "admin"]);

      if (!members || members.length === 0) {
        setDoctors([]);
        setLoading(false);
        return;
      }

      const userIds = [...new Set(members.map((m) => m.user_id))];
      const clinicIds = [...new Set(members.map((m) => m.clinic_id))];

      const [{ data: profiles }, { data: clinics }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds),
        supabase.from("clinics").select("id, name, city, state, phone, address, business_hours, zip_code").in("id", clinicIds),
      ]);

      const today = startOfDay(new Date());
      const endRange = addDays(today, 7);
      const { data: appointments } = await supabase
        .from("appointments")
        .select("dentist_id, start_time, end_time, status")
        .in("dentist_id", userIds)
        .gte("start_time", today.toISOString())
        .lte("start_time", endRange.toISOString())
        .neq("status", "cancelled");

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const clinicMap = new Map((clinics ?? []).map((c) => [c.id, c]));

      const doctorList: DoctorData[] = members.map((m) => {
        const profile = profileMap.get(m.user_id);
        const clinic = clinicMap.get(m.clinic_id);
        const appts = (appointments ?? []).filter((a) => a.dentist_id === m.user_id);
        return {
          userId: m.user_id,
          fullName: profile?.full_name ?? "Profissional",
          avatarUrl: profile?.avatar_url ?? null,
          clinicId: m.clinic_id,
          clinicName: clinic?.name ?? "Clínica",
          clinicCity: clinic?.city ?? null,
          clinicState: clinic?.state ?? null,
          clinicPhone: clinic?.phone ?? null,
          clinicAddress: clinic?.address ?? null,
          clinicZipCode: clinic?.zip_code ?? null,
          businessHours: (clinic?.business_hours as any) ?? null,
          appointments: appts.map((a) => ({
            start_time: a.start_time,
            end_time: a.end_time,
            status: a.status,
          })),
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
      setLoading(false);
    }

    fetchDoctors();
  }, []);

  const cities = useMemo(() => {
    const set = new Set(doctors.map((d) => d.clinicCity).filter(Boolean) as string[]);
    return [...set].sort();
  }, [doctors]);

  const filtered = useMemo(() => {
    return doctors.filter((d) => {
      const nameMatch =
        !searchName || d.fullName.toLowerCase().includes(searchName.toLowerCase());
      const cityFilter = selectedCity || searchCity;
      const cityMatch =
        !cityFilter || (d.clinicCity ?? "").toLowerCase().includes(cityFilter.toLowerCase());

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

      return nameMatch && cityMatch && boundsMatch;
    });
  }, [doctors, searchName, searchCity, selectedCity, mapBounds, clinicCoords]);

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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketplaceHeader
        searchName={searchName}
        searchCity={searchCity}
        onSearchNameChange={setSearchName}
        onSearchCityChange={(v) => {
          setSearchCity(v);
          setSelectedCity("");
        }}
      />
      <MarketplaceFilters
        cities={cities}
        selectedCity={selectedCity}
        onCitySelect={(c) => {
          setSelectedCity(c);
          setSearchCity("");
        }}
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
          />
        ) : (
          <>
            <div className={isMobile ? "w-full" : "w-3/5"}>
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
