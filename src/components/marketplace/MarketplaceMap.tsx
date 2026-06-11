import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { geocodeAddress } from "@/lib/geocode";
import { cn } from "@/lib/utils";
import type { DoctorData } from "./DoctorCard";

const FORTALEZA_CENTER: [number, number] = [-3.7172, -38.5433];

interface ClinicGeoData {
  clinicId: string;
  clinicName: string;
  address?: string | null;
  addressNumber?: string | null;
  neighborhood?: string | null;
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
  onMarkerClick?: (clinicId: string) => void;
  highlightedClinicId?: string | null;
  showZoomControl?: boolean;
}

function createBlueIcon() {
  return L.divIcon({
    className: "",
    html: '<div style="position:relative;width:26px;height:26px"><div style="position:absolute;inset:0;border-radius:9999px;background:radial-gradient(circle at 30% 30%, #7ea7ff, hsl(var(--primary)));border:3px solid #fff;box-shadow:0 8px 18px rgba(37,99,235,.35)"></div><div style="position:absolute;left:50%;top:50%;width:8px;height:8px;transform:translate(-50%,-50%);border-radius:9999px;background:#fff;opacity:.95"></div></div>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -16],
  });
}

function createHighlightIcon() {
  return L.divIcon({
    className: "",
    html: '<div style="position:relative;width:34px;height:34px"><div style="position:absolute;inset:0;border-radius:9999px;background:hsl(var(--primary));border:4px solid #fff;box-shadow:0 12px 28px rgba(37,99,235,.45)"></div><div style="position:absolute;left:50%;top:50%;width:10px;height:10px;transform:translate(-50%,-50%);border-radius:9999px;background:#fff"></div><div style="position:absolute;left:50%;top:50%;width:34px;height:34px;transform:translate(-50%,-50%);border-radius:9999px;border:2px solid rgba(59,130,246,.35);animation:marketplace-ping 1.6s ease-out infinite"></div></div>',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -19],
  });
}

export const MarketplaceMap = forwardRef<MarketplaceMapHandle, MarketplaceMapProps>(
  function MarketplaceMap({ className, clinics = [], doctors: _doctors = [], onBoundsSearch, onCoordsReady, onMarkerClick, highlightedClinicId, showZoomControl = true }, ref) {
    const [showSearchBtn, setShowSearchBtn] = useState(false);
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markersRef = useRef<Map<string, L.Marker>>(new Map());
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
        const targetZoom = Math.max(map.getZoom(), 14);
        map.flyTo(marker.getLatLng(), targetZoom, { duration: 0.6 });
        marker.openPopup();
      }
    }, []);

    useImperativeHandle(ref, () => ({ focusClinic }));

    useEffect(() => {
      if (!mapContainerRef.current) return;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: FORTALEZA_CENTER,
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });

      // attributionControl está desativado; evite acessar map.attributionControl aqui.
      if (showZoomControl) L.control.zoom({ position: "topright" }).addTo(map);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 20,
      }).addTo(map);

      mapInstanceRef.current = map;
      markersRef.current.clear();
      userMovedRef.current = false;
      setShowSearchBtn(false);

      map.on("movestart", () => {
        userMovedRef.current = true;
      });
      map.on("moveend", handleMoveEnd);

      const icon = createBlueIcon();
      let cancelled = false;

      (async () => {
        const results = await Promise.allSettled(
          clinics.map((clinic) =>
          geocodeAddress(
            clinic.address,
            clinic.city,
            clinic.state,
            clinic.zipCode,
            clinic.addressNumber,
            clinic.neighborhood,
          ).then((coords) => ({
              clinicId: clinic.clinicId,
              clinicName: clinic.clinicName,
              coords,
            })),
          ),
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
            marker.on("click", () => {
              onMarkerClick?.(clinicId);
            });
            markersRef.current.set(clinicId, marker);
          }
        }

        onCoordsReady?.(newCoords);

        if (!cancelled && bounds.length > 0 && mapInstanceRef.current) {
          userMovedRef.current = false;
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

    // Highlight marker when external selection changes
    useEffect(() => {
      const blue = createBlueIcon();
      markersRef.current.forEach((marker, clinicId) => {
        marker.setIcon(clinicId === highlightedClinicId ? createHighlightIcon() : blue);
      });
      if (highlightedClinicId) {
        const marker = markersRef.current.get(highlightedClinicId);
        const map = mapInstanceRef.current;
        if (marker && map) {
          userMovedRef.current = false;
          map.panTo(marker.getLatLng(), { animate: true });
        }
      }
    }, [highlightedClinicId]);

    return (
      <div className={cn(className)}>
        <div className="relative h-full min-h-[400px] overflow-hidden rounded-xl border border-border/70 shadow-sm">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[900] h-16 bg-gradient-to-b from-background/30 to-transparent" />
          <div ref={mapContainerRef} className="marketplace-map google-like-map h-full w-full" />

          {showSearchBtn && onBoundsSearch && (
            <Button
              size="sm"
              className="absolute left-1/2 top-3 z-[1000] -translate-x-1/2 border border-border/60 bg-background/95 text-foreground shadow-lg backdrop-blur hover:bg-muted"
              onClick={handleSearchArea}
            >
              <Search className="mr-1 h-4 w-4" />
              Buscar nesta área
            </Button>
          )}
        </div>
      </div>
    );
  },
);
