import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Maximize2, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { geocodeAddress } from "@/lib/geocode";
import { cn } from "@/lib/utils";
import type { DoctorData } from "./DoctorCard";

const FORTALEZA_CENTER: [number, number] = [-3.7172, -38.5433];

interface ClinicGeoData {
  clinicId: string;
  clinicName: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}

interface MarketplaceMapProps {
  className?: string;
  clinics?: ClinicGeoData[];
  doctors?: DoctorData[];
}

function createGreenIcon() {
  return L.divIcon({
    className: "",
    html: '<div style="width:24px;height:24px;background:hsl(142,71%,45%);border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

export function MarketplaceMap({ className, clinics = [], doctors = [] }: MarketplaceMapProps) {
  const [expanded, setExpanded] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Initialize and update Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clean up previous instance
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: FORTALEZA_CENTER,
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    mapInstanceRef.current = map;

    const icon = createGreenIcon();
    let cancelled = false;

    (async () => {
      const bounds: L.LatLng[] = [];
      for (const clinic of clinics) {
        if (cancelled) break;
        const coords = await geocodeAddress(clinic.address, clinic.city, clinic.state);
        if (coords && mapInstanceRef.current) {
          const latlng = L.latLng(coords.lat, coords.lng);
          bounds.push(latlng);
          L.marker(latlng, { icon })
            .addTo(mapInstanceRef.current)
            .bindPopup(`<strong>${clinic.clinicName}</strong>`);
        }
      }
      if (!cancelled && bounds.length > 0 && mapInstanceRef.current) {
        mapInstanceRef.current.fitBounds(L.latLngBounds(bounds).pad(0.15));
      }
    })();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinics]);

  // Invalidate map size when toggling expanded
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 100);
    }
  }, [expanded]);

  return (
    <div
      className={cn(
        expanded
          ? "fixed inset-0 z-50 flex bg-background"
          : className
      )}
    >
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
              {doctors.map((d) => {
                const initials = d.fullName
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                return (
                  <div
                    key={`${d.userId}_${d.clinicId}`}
                    className="flex items-center gap-3 rounded-lg border p-2 text-sm"
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={d.avatarUrl ?? undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{d.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">{d.clinicName}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Map area */}
      <div className={cn("relative", expanded ? "flex-1" : "h-full min-h-[400px] overflow-hidden rounded-lg border")}>
        <div ref={mapContainerRef} className="h-full w-full" />

        {expanded ? (
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-3 top-3 z-[1000] shadow-md"
            onClick={() => setExpanded(false)}
          >
            <X className="h-5 w-5" />
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
