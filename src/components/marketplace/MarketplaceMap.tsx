import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { geocodeAddress } from "@/lib/geocode";
import { cn } from "@/lib/utils";
import { format, parseISO, isAfter, isBefore, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import type { DoctorData } from "./DoctorCard";

const FORTALEZA_CENTER: [number, number] = [-3.7172, -38.5433];

interface ClinicGeoData {
  clinicId: string;
  clinicName: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MarketplaceMapHandle {
  focusClinic: (clinicId: string) => void;
}

interface MarketplaceMapProps {
  className?: string;
  clinics?: ClinicGeoData[];
  doctors?: DoctorData[];
  onBoundsSearch?: (bounds: MapBounds) => void;
  onCoordsReady?: (coords: Map<string, { lat: number; lng: number }>) => void;
}

function createBlueIcon() {
  return L.divIcon({
    className: "",
    html: '<div style="width:24px;height:24px;background:hsl(var(--primary));border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

function createHighlightIcon() {
  return L.divIcon({
    className: "",
    html: '<div style="width:32px;height:32px;background:hsl(var(--primary));border:4px solid white;border-radius:50%;box-shadow:0 4px 12px rgba(37,99,235,0.5)"></div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

const DAY_MAP: Record<number, string> = {
  0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat",
};

function generateSlots(date: Date, bh: any, appointments: any[]): string[] {
  const dayKey = DAY_MAP[date.getDay()];
  const dayConfig = bh?.[dayKey];
  if (!dayConfig?.enabled) return [];
  const openTime = parse(dayConfig.open, "HH:mm", date);
  const closeTime = parse(dayConfig.close, "HH:mm", date);
  const now = new Date();
  const slots: string[] = [];
  let cursor = openTime;
  while (isBefore(cursor, closeTime)) {
    const slotEnd = new Date(cursor.getTime() + 30 * 60 * 1000);
    if (isSameDay(date, now) && isBefore(cursor, now)) { cursor = slotEnd; continue; }
    const hasConflict = appointments.some((apt) => {
      if (apt.status === "cancelled") return false;
      const aptStart = new Date(apt.start_time);
      const aptEnd = new Date(apt.end_time);
      return isBefore(cursor, aptEnd) && isAfter(slotEnd, aptStart);
    });
    if (!hasConflict) slots.push(format(cursor, "HH:mm"));
    cursor = slotEnd;
  }
  return slots;
}

interface SidebarDoctorItemProps {
  doctor: DoctorData;
  onFocus: (clinicId: string) => void;
}

function SidebarDoctorItem({ doctor, onFocus }: SidebarDoctorItemProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const initials = doctor.fullName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const days = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 4 }, (_, i) => {
      const date = addDays(today, i);
      const dayAppts = doctor.appointments.filter((a) => isSameDay(new Date(a.start_time), date));
      const slots = generateSlots(date, doctor.businessHours, dayAppts);
      return { date, slots };
    });
  }, [doctor]);

  const handleClick = () => {
    onFocus(doctor.clinicId);
    setExpanded(!expanded);
  };

  const handleSlotClick = (date: Date, time: string) => {
    const dateStr = format(date, "yyyy-MM-dd");
    navigate(`/marketplace/agendar?dentistId=${doctor.userId}&clinicId=${doctor.clinicId}&date=${dateStr}&time=${time}`);
  };

  return (
    <div className="rounded-lg border transition-colors hover:border-primary/40">
      <button
        type="button"
        className="flex w-full items-center gap-3 p-2 text-left text-sm"
        onClick={handleClick}
      >
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage src={doctor.avatarUrl ?? undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{doctor.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">{doctor.clinicName}</p>
        </div>
      </button>

      {expanded && (
        <div className="border-t px-2 pb-2 pt-1">
          {doctor.clinicAddress && (
            <p className="mb-1 text-[11px] text-muted-foreground">{doctor.clinicAddress}</p>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            {days.map(({ date, slots }) => (
              <div key={date.toISOString()} className="min-w-0">
                <p className="mb-1 text-center text-[10px] font-medium capitalize text-muted-foreground">
                  {format(date, "EEE dd/MM", { locale: ptBR })}
                </p>
                <div className="flex flex-col gap-0.5">
                  {slots.length === 0 ? (
                    <span className="py-1 text-center text-[10px] text-muted-foreground/60">—</span>
                  ) : (
                    slots.slice(0, 3).map((time) => (
                      <Button
                        key={time}
                        variant="outline"
                        size="sm"
                        className="h-6 w-full text-[10px] font-medium text-primary hover:bg-primary hover:text-primary-foreground"
                        onClick={(e) => { e.stopPropagation(); handleSlotClick(date, time); }}
                      >
                        {time}
                      </Button>
                    ))
                  )}
                  {slots.length > 3 && (
                    <span className="text-center text-[10px] text-muted-foreground">+{slots.length - 3}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const MarketplaceMap = forwardRef<MarketplaceMapHandle, MarketplaceMapProps>(
  function MarketplaceMap({ className, clinics = [], doctors = [], onBoundsSearch, onCoordsReady }, ref) {
    const [expanded, setExpanded] = useState(false);
    const [showSearchBtn, setShowSearchBtn] = useState(false);
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markersRef = useRef<Map<string, L.Marker>>(new Map());
    const coordsRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());
    const userMovedRef = useRef(false);

    const handleMoveEnd = useCallback(() => {
      if (userMovedRef.current) setShowSearchBtn(true);
    }, []);

    const handleSearchArea = useCallback(() => {
      const map = mapInstanceRef.current;
      if (!map || !onBoundsSearch) return;
      const b = map.getBounds();
      onBoundsSearch({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
      setShowSearchBtn(false);
    }, [onBoundsSearch]);

    const focusClinic = useCallback((clinicId: string) => {
      const map = mapInstanceRef.current;
      const marker = markersRef.current.get(clinicId);
      if (map && marker) {
        userMovedRef.current = false;
        map.setView(marker.getLatLng(), 16, { animate: true });
        marker.setIcon(createHighlightIcon());
        marker.openPopup();
        setTimeout(() => marker.setIcon(createBlueIcon()), 3000);
      }
    }, []);

    useImperativeHandle(ref, () => ({ focusClinic }));

    useEffect(() => {
      if (!mapContainerRef.current) return;
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }

      const map = L.map(mapContainerRef.current, { center: FORTALEZA_CENTER, zoom: 13, zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      mapInstanceRef.current = map;
      markersRef.current.clear();
      userMovedRef.current = false;
      setShowSearchBtn(false);

      map.on("movestart", () => { userMovedRef.current = true; });
      map.on("moveend", handleMoveEnd);

      const icon = createBlueIcon();
      let cancelled = false;

      (async () => {
        const results = await Promise.allSettled(
          clinics.map((clinic) =>
            geocodeAddress(clinic.address, clinic.city, clinic.state, clinic.zipCode).then(
              (coords) => ({ clinicId: clinic.clinicId, clinicName: clinic.clinicName, coords })
            )
          )
        );
        if (cancelled) return;

        const bounds: L.LatLng[] = [];
        const newCoords = new Map<string, { lat: number; lng: number }>();

        for (const result of results) {
          if (result.status === "fulfilled" && result.value.coords && mapInstanceRef.current) {
            const { clinicId, clinicName, coords } = result.value;
            const latlng = L.latLng(coords.lat, coords.lng);
            bounds.push(latlng);
            newCoords.set(clinicId, coords);
            const marker = L.marker(latlng, { icon })
              .addTo(mapInstanceRef.current)
              .bindPopup(`<strong>${clinicName}</strong>`);
            markersRef.current.set(clinicId, marker);
          }
        }

        coordsRef.current = newCoords;
        onCoordsReady?.(newCoords);

        if (!cancelled && bounds.length > 0 && mapInstanceRef.current) {
          userMovedRef.current = false;
          mapInstanceRef.current.fitBounds(L.latLngBounds(bounds).pad(0.15));
        }
      })();

      return () => { cancelled = true; if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clinics]);

    useEffect(() => {
      if (mapInstanceRef.current) setTimeout(() => mapInstanceRef.current?.invalidateSize(), 100);
    }, [expanded]);

    return (
      <div className={cn(expanded ? "fixed inset-0 z-50 flex bg-background" : className)}>
        {/* Sidebar with doctors — only in expanded mode */}
        {expanded && doctors.length > 0 && (
          <div className="hidden w-80 flex-col border-r md:flex">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                {doctors.length} profissional{doctors.length !== 1 ? "is" : ""}
              </p>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-2 p-3">
                {doctors.map((d) => (
                  <SidebarDoctorItem
                    key={`${d.userId}_${d.clinicId}`}
                    doctor={d}
                    onFocus={focusClinic}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Map area */}
        <div className={cn("relative", expanded ? "flex-1" : "h-full min-h-[400px] overflow-hidden rounded-lg border")}>
          <div ref={mapContainerRef} className="h-full w-full" />

          {showSearchBtn && onBoundsSearch && (
            <Button
              size="sm"
              className="absolute left-1/2 top-3 z-[1000] -translate-x-1/2 shadow-lg"
              onClick={handleSearchArea}
            >
              <Search className="mr-1 h-4 w-4" />
              Buscar nesta área
            </Button>
          )}

          {expanded ? (
            <Button
              size="sm"
              variant="secondary"
              className="absolute bottom-3 right-3 z-[1000] shadow-md"
              onClick={() => setExpanded(false)}
            >
              <Minimize2 className="mr-1 h-4 w-4" />
              Diminuir mapa
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="absolute bottom-3 right-3 z-[1000] shadow-md"
              onClick={() => setExpanded(true)}
            >
              <Maximize2 className="mr-1 h-4 w-4" />
              Ampliar mapa
            </Button>
          )}
        </div>
      </div>
    );
  }
);
