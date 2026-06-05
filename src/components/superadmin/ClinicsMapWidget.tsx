import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { geocodeAddress } from '@/lib/geocode';
import type { PlatformClinic } from '@/types/superadmin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MapPin, Loader2 } from 'lucide-react';

const CAT_COLOR: Record<string, string> = {
  odonto:  '#3b82f6',
  medico:  '#8b5cf6',
  estetica:'#ec4899',
  outro:   '#64748b',
};
const CAT_LABEL: Record<string, string> = {
  odonto: 'Odontologia', medico: 'Medicina', estetica: 'Estética', outro: 'Outro',
};
const STATUS_COLOR: Record<string, string> = {
  active: '#10b981', trial: '#f59e0b', overdue: '#ef4444', cancelled: '#94a3b8',
};
const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo', trial: 'Trial', overdue: 'Inadimplente', cancelled: 'Cancelado',
};

interface Props { clinics: PlatformClinic[] }
interface ClinicMapped extends PlatformClinic { lat: number; lng: number }

function jitter(scale = 0.018) {
  return (Math.random() - 0.5) * scale;
}

export function ClinicsMapWidget({ clinics }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<L.Map | null>(null);
  const markersRef    = useRef<L.Layer[]>([]);
  const [geocoding, setGeocoding]   = useState(false);
  const [mapped,    setMapped]      = useState(0);
  const [total,     setTotal]       = useState(0);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [-14.24, -51.93],   // centro do Brasil
      zoom: 4,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Geocode + add markers when clinics change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || clinics.length === 0) return;

    // Clear old markers
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    const clinicsWithCity = clinics.filter(c => c.city || c.state);
    setTotal(clinicsWithCity.length);
    setMapped(0);

    if (clinicsWithCity.length === 0) return;
    setGeocoding(true);

    const cityCache = new Map<string, { lat: number; lng: number } | null>();
    let count = 0;

    const run = async () => {
      const positioned: ClinicMapped[] = [];

      for (const clinic of clinicsWithCity) {
        const key = `${clinic.city ?? ''}|${clinic.state ?? ''}`;
        if (!cityCache.has(key)) {
          const coords = await geocodeAddress(null, clinic.city, clinic.state, null);
          cityCache.set(key, coords);
          if (cityCache.size > 1) await new Promise(r => setTimeout(r, 250)); // rate-limit
        }
        const coords = cityCache.get(key);
        if (coords) {
          positioned.push({ ...clinic, lat: coords.lat + jitter(), lng: coords.lng + jitter() });
          count++;
          setMapped(count);
        }
      }

      const bounds: L.LatLngTuple[] = [];

      positioned.forEach(clinic => {
        const fill  = CAT_COLOR[clinic.category ?? 'outro'] ?? '#64748b';
        const sClr  = STATUS_COLOR[clinic.subscription?.status ?? ''] ?? '#94a3b8';
        const sLbl  = STATUS_LABEL[clinic.subscription?.status ?? ''] ?? 'Sem assinatura';
        const catLb = CAT_LABEL[clinic.category ?? 'outro'] ?? clinic.category;
        const loc   = [clinic.city, clinic.state].filter(Boolean).join('/');

        const marker = L.circleMarker([clinic.lat, clinic.lng], {
          radius: 9,
          fillColor: fill,
          color: 'rgba(255,255,255,0.9)',
          weight: 2.5,
          opacity: 1,
          fillOpacity: 0.88,
        });

        marker.bindPopup(`
          <div style="font-family:system-ui,sans-serif;min-width:170px;padding:2px 0">
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px">
              <span style="width:11px;height:11px;border-radius:50%;background:${fill};flex-shrink:0;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.2)"></span>
              <strong style="font-size:13px;line-height:1.3">${clinic.name}</strong>
            </div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:5px">${catLb}${loc ? ` · ${loc}` : ''}</div>
            <div style="display:flex;align-items:center;gap:5px;font-size:11px">
              <span style="width:7px;height:7px;border-radius:50%;background:${sClr};flex-shrink:0"></span>
              <span>${sLbl}</span>
              <span style="color:#9ca3af">·</span>
              <span>${clinic.member_count} membro${clinic.member_count !== 1 ? 's' : ''}</span>
            </div>
          </div>
        `, { maxWidth: 260, className: 'clinics-map-popup' });

        marker.addTo(map);
        markersRef.current.push(marker);
        bounds.push([clinic.lat, clinic.lng]);
      });

      if (bounds.length > 0) {
        try {
          map.fitBounds(L.latLngBounds(bounds), { padding: [48, 48], maxZoom: 13 });
        } catch {
          // ignore invalid bounds
        }
      }

      setGeocoding(false);
    };

    run();
  }, [clinics]);

  return (
    <Card className="shadow-md border-border/50 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-base">Distribuição Geográfica</CardTitle>
            </div>
            <CardDescription className="mt-0.5">
              Localização das clínicas na plataforma · clique em um marcador para detalhes
            </CardDescription>
          </div>
          {geocoding && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Mapeando {mapped} de {total}…
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-2">
          {Object.entries(CAT_LABEL).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-3 w-3 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: CAT_COLOR[k] }} />
              {v}
            </div>
          ))}
        </div>
      </CardHeader>

      <div ref={containerRef} style={{ height: 440, width: '100%' }} />
    </Card>
  );
}
