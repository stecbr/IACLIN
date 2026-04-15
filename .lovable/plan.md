

# Refinamentos Visuais do Marketplace

## 1. Logo Oficial no Header
Substituir o texto "IACLIN" no `MarketplaceHeader` pelas imagens oficiais `logo-light.png` / `logo-dark.png` de `src/assets/`, usando o hook `useTheme` para alternar entre elas (mesmo padrão do `AppLayout`).

## 2. Mapa Interativo com Pinos via Geocoding (Nominatim)

**Problema anterior**: `react-leaflet` causava erro `render2 is not a function` com React 18, forçando uso de iframe.

**Nova abordagem**: Usar Leaflet diretamente (API imperativa `L.map()`, `L.marker()`) dentro de um `useEffect` com ref do div, evitando completamente os componentes React do `react-leaflet`. Isso contorna o bug de Context.Consumer.

**Geocoding**: Criar função utilitária `geocodeAddress(address, city, state)` que chama `https://nominatim.openstreetmap.org/search?format=json&q=...` e retorna `{lat, lng}`. Cache em memória para evitar chamadas repetidas. Respeitar rate-limit do Nominatim (1 req/s) com delay sequencial.

**Pinos verdes**: Usar `L.divIcon` com HTML inline (círculo verde `bg-primary` com borda branca) para criar marcadores customizados no estilo médico.

**Dados necessários**: Buscar `address`, `city`, `state` das clínicas (já disponíveis na query de `clinics` — só precisa incluir `address` no select).

**Componente MarketplaceMap**: Receberá prop `clinics` com dados de endereço. No mount, faz geocoding de cada clínica, renderiza markers. Popup ao clicar no pin mostra nome da clínica.

## 3. UX do Mapa Fullscreen

- Manter botão "Reduzir" existente, mas adicionar ícone `X` flutuante no canto superior direito
- No modo expandido, mostrar sidebar esquerda com lista compacta de médicos (com scroll via `ScrollArea`)
- A `MarketplaceMap` receberá props `doctors` e `expanded` + `onClose`

## Arquivos Modificados

| Arquivo | Mudanças |
|---|---|
| `src/components/marketplace/MarketplaceHeader.tsx` | Importar logos e useTheme, substituir texto por `<img>` |
| `src/components/marketplace/MarketplaceMap.tsx` | Reescrever com Leaflet imperativo, geocoding Nominatim, pinos verdes, fullscreen com sidebar scrollável |
| `src/pages/Marketplace.tsx` | Passar dados de clínicas (com address) e doctors para o mapa; incluir `address` no select de clinics |
| `src/components/marketplace/DoctorCard.tsx` | Adicionar `clinicAddress` ao tipo `DoctorData` |
| `src/lib/geocode.ts` | Nova função utilitária de geocoding com cache |

## Dependência
- `leaflet` já está instalado (veio junto com `react-leaflet`). Usaremos apenas `leaflet` diretamente, sem `react-leaflet`.

## Detalhes Técnicos

**Leaflet imperativo** (evita o bug de React 18):
```typescript
const mapRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  const map = L.map(mapRef.current).setView([-3.7172, -38.5433], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  // Add markers after geocoding...
  return () => map.remove();
}, []);
```

**Geocoding com Nominatim**:
```typescript
const cache = new Map<string, {lat: number, lng: number}>();
export async function geocodeAddress(address: string, city: string, state: string) {
  const query = [address, city, state].filter(Boolean).join(', ');
  if (cache.has(query)) return cache.get(query)!;
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
  const data = await res.json();
  if (data[0]) { cache.set(query, {lat: +data[0].lat, lng: +data[0].lon}); return cache.get(query)!; }
  return null;
}
```

**Pino verde customizado**:
```typescript
L.divIcon({
  className: '',
  html: '<div style="width:28px;height:28px;background:#16a34a;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})
```

