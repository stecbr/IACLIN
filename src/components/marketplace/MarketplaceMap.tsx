import { useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2 } from "lucide-react";
import "leaflet/dist/leaflet.css";

const FORTALEZA_CENTER: [number, number] = [-3.7172, -38.5433];

interface MarketplaceMapProps {
  className?: string;
}

export function MarketplaceMap({ className }: MarketplaceMapProps) {
  const [expanded, setExpanded] = useState(false);

  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <span className="text-sm font-medium">Mapa</span>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(false)}>
            <Minimize2 className="mr-1 h-4 w-4" />
            Reduzir
          </Button>
        </div>
        <div className="flex-1">
          <MapContainer
            center={FORTALEZA_CENTER}
            zoom={13}
            className="h-full w-full"
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </MapContainer>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="relative h-full min-h-[400px] overflow-hidden rounded-lg border">
        <MapContainer
          center={FORTALEZA_CENTER}
          zoom={12}
          className="h-full w-full"
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </MapContainer>
        <Button
          size="sm"
          variant="secondary"
          className="absolute bottom-3 right-3 z-[1000] shadow-md"
          onClick={() => setExpanded(true)}
        >
          <Maximize2 className="mr-1 h-4 w-4" />
          Ampliar mapa
        </Button>
      </div>
    </div>
  );
}
