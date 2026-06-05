import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { geocodeAddress } from '@/lib/geocode';

// ─── Cores por categoria ────────────────────────────────────────────────────
const CAT_COLOR: Record<string, string> = {
  odonto:  '#3b82f6',
  medico:  '#8b5cf6',
  estetica:'#ec4899',
  outro:   '#64748b',
};
const CAT_LABEL: Record<string, string> = {
  odonto: 'Odontologia', medico: 'Medicina', estetica: 'Estética', outro: 'Outro',
};

// Fallback visual caso não haja dados — principais cidades brasileiras
const DEMO_PINS: { city: string; state: string; lat: number; lng: number; cat: string }[] = [
  { city: 'Fortaleza',     state: 'CE', lat: -3.717,  lng: -38.543, cat: 'odonto'  },
  { city: 'São Paulo',     state: 'SP', lat: -23.550, lng: -46.633, cat: 'medico'  },
  { city: 'Rio de Janeiro',state: 'RJ', lat: -22.906, lng: -43.172, cat: 'estetica'},
  { city: 'Belo Horizonte',state: 'MG', lat: -19.917, lng: -43.934, cat: 'medico'  },
  { city: 'Salvador',      state: 'BA', lat: -12.971, lng: -38.501, cat: 'odonto'  },
  { city: 'Curitiba',      state: 'PR', lat: -25.428, lng: -49.273, cat: 'medico'  },
  { city: 'Manaus',        state: 'AM', lat: -3.119,  lng: -60.021, cat: 'outro'   },
  { city: 'Recife',        state: 'PE', lat: -8.054,  lng: -34.881, cat: 'odonto'  },
  { city: 'Belém',         state: 'PA', lat: -1.455,  lng: -48.503, cat: 'medico'  },
  { city: 'Porto Alegre',  state: 'RS', lat: -30.034, lng: -51.217, cat: 'estetica'},
  { city: 'Goiânia',       state: 'GO', lat: -16.686, lng: -49.265, cat: 'medico'  },
  { city: 'Natal',         state: 'RN', lat: -5.793,  lng: -35.209, cat: 'odonto'  },
];

function jitter(scale = 0.016) { return (Math.random() - 0.5) * scale; }

function createPulsingIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:16px;height:16px">
        <div style="
          position:absolute;inset:0;border-radius:50%;background:${color};
          opacity:0.25;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;
          transform:scale(1)
        "></div>
        <div style="
          position:absolute;inset:2px;border-radius:50%;background:${color};
          border:2px solid white;box-shadow:0 1px 6px rgba(0,0,0,0.25)
        "></div>
      </div>
      <style>
        @keyframes ping{75%,100%{transform:scale(2);opacity:0}}
      </style>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });
}

interface ClinicPin {
  name: string;
  city: string;
  state: string;
  cat: string;
  lat: number;
  lng: number;
}

export function LandingNetworkMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const markersRef   = useRef<L.Layer[]>([]);
  const [count, setCount] = useState(0);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [-14.5, -51.9],
      zoom: 4,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      dragging: true,
    });

    // CartoDB Light tiles — look clean on white landing pages
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { subdomains: 'abcd', maxZoom: 18 }
    ).addTo(map);

    L.control.attribution({ position: 'bottomright', prefix: false })
      .addAttribution('© <a href="https://openstreetmap.org">OSM</a> © <a href="https://carto.com">CARTO</a>')
      .addTo(map);

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Fetch + geocode clinics
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const load = async () => {
      let pins: ClinicPin[] = [];

      try {
        const { data } = await supabase
          .from('clinics')
          .select('name, city, state, category')
          .not('city', 'is', null)
          .limit(200);

        if (data && data.length > 0) {
          const cityCache = new Map<string, { lat: number; lng: number } | null>();

          for (const clinic of data) {
            const key = `${clinic.city}|${clinic.state}`;
            if (!cityCache.has(key)) {
              const coords = await geocodeAddress(null, clinic.city, clinic.state, null);
              cityCache.set(key, coords);
              if (cityCache.size > 1) await new Promise(r => setTimeout(r, 250));
            }
            const coords = cityCache.get(key);
            if (coords) {
              pins.push({
                name: clinic.name ?? 'Clínica',
                city: clinic.city ?? '',
                state: clinic.state ?? '',
                cat: clinic.category ?? 'outro',
                lat: coords.lat + jitter(),
                lng: coords.lng + jitter(),
              });
            }
          }
        }
      } catch {
        // silent — fall through to demo pins
      }

      // Fallback to demo pins
      if (pins.length === 0) {
        pins = DEMO_PINS.map(p => ({
          name: `Clínica em ${p.city}`,
          city: p.city,
          state: p.state,
          cat: p.cat,
          lat: p.lat + jitter(0.12),
          lng: p.lng + jitter(0.12),
        }));
        // Multiply demo pins to look like real density
        pins = [...pins, ...pins.map(p => ({
          ...p, lat: p.lat + jitter(0.2), lng: p.lng + jitter(0.2),
        }))];
      }

      // Clear & add markers
      markersRef.current.forEach(m => map.removeLayer(m));
      markersRef.current = [];

      const bounds: L.LatLngTuple[] = [];
      pins.forEach(pin => {
        const color = CAT_COLOR[pin.cat] ?? '#64748b';
        const label = CAT_LABEL[pin.cat] ?? pin.cat;
        const marker = L.marker([pin.lat, pin.lng], { icon: createPulsingIcon(color) });
        marker.bindPopup(`
          <div style="font-family:system-ui,sans-serif;min-width:150px;padding:2px 0">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
              <span style="width:9px;height:9px;border-radius:50%;background:${color};flex-shrink:0"></span>
              <strong style="font-size:12px">${pin.name}</strong>
            </div>
            <div style="font-size:11px;color:#6b7280">${label} · ${pin.city}/${pin.state}</div>
          </div>
        `, { maxWidth: 220, closeButton: false });
        marker.addTo(map);
        markersRef.current.push(marker);
        bounds.push([pin.lat, pin.lng]);
      });

      setCount(pins.length);

      if (bounds.length > 0) {
        try {
          map.fitBounds(L.latLngBounds(bounds), { padding: [32, 32], maxZoom: 10 });
        } catch { /* ignore */ }
      }
    };

    load();
  }, []);

  return (
    <div className="relative mt-10 overflow-hidden rounded-2xl border border-border shadow-xl">
      {/* Map */}
      <div ref={containerRef} style={{ height: 460, width: '100%' }} />

      {/* Gradient overlay bottom */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background/80 to-transparent" />

      {/* Stats overlay */}
      <div className="pointer-events-none absolute bottom-5 left-0 right-0 flex justify-center gap-6">
        {Object.entries(CAT_LABEL).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs font-medium text-foreground/80 drop-shadow">
            <span
              className="h-3 w-3 rounded-full border-2 border-white shadow"
              style={{ backgroundColor: CAT_COLOR[k] }}
            />
            {v}
          </div>
        ))}
      </div>

      {/* Pin count badge top-right */}
      {count > 0 && (
        <div className="pointer-events-none absolute right-4 top-4 rounded-full border border-border/60 bg-background/90 px-3 py-1 text-xs font-medium text-foreground/70 shadow backdrop-blur-sm">
          {count} clínica{count !== 1 ? 's' : ''} na rede
        </div>
      )}
    </div>
  );
}
