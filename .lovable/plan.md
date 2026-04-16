

# Buscar nesta área + Mostrar no mapa

## Visão geral
Duas funcionalidades interativas para conectar a lista de profissionais ao mapa:

1. **"Buscar nesta área"** — botão flutuante no mapa que filtra os cards da lista mostrando apenas clínicas visíveis na área atual do mapa
2. **"Mostrar no mapa"** — botão em cada DoctorCard que centraliza o mapa na localização daquela clínica com zoom e destaque no pino

## Pré-requisito: corrigir geocoding e cor dos pinos
Antes de implementar as novas features, aplicar os ajustes pendentes:
- Geocoding com parâmetros estruturados (`street`, `city`, `postalcode`) no Nominatim
- Cor dos pinos de verde para azul (`#2563EB`, cor primary da plataforma)
- Geocodificação paralela com `Promise.allSettled` para evitar cancelamento

## Mudanças por arquivo

### 1. `src/lib/geocode.ts`
- Usar parâmetros estruturados no Nominatim (`street`, `city`, `state`, `postalcode`, `country=Brazil`)
- Reduzir rate limit de 1100ms para 200ms

### 2. `src/components/marketplace/MarketplaceMap.tsx`
- **Cor do pino**: trocar verde por azul `#2563EB`
- **Geocoding paralelo**: `Promise.allSettled` em vez de loop sequencial
- **Cache de coordenadas**: armazenar coords geocodificadas em um `Map<clinicId, LatLng>` via ref, expor via callback
- **Botão "Buscar nesta área"**: aparece sobre o mapa quando o usuário arrasta/zoom. Ao clicar, chama um callback `onBoundsSearch(bounds)` passando os limites visíveis do mapa
- **Método `focusClinic(clinicId)`**: expor via `useImperativeHandle` (ou callback prop) para que o DoctorCard possa centralizar o mapa numa clínica específica com zoom 16 e popup aberto
- Adicionar prop `onBoundsSearch?: (bounds: {north, south, east, west}) => void`
- Adicionar prop `onCoordsReady?: (coords: Map<string, {lat, lng}>) => void` para compartilhar coordenadas geocodificadas

### 3. `src/components/marketplace/DoctorCard.tsx`
- Adicionar prop `onShowOnMap?: (clinicId: string) => void`
- Renderizar botão "Mostrar no mapa" (ícone MapPin) ao lado das informações de localização
- Ao clicar, chama `onShowOnMap(doctor.clinicId)`

### 4. `src/pages/Marketplace.tsx`
- Manter ref para o mapa (`mapRef`) e um state com as coordenadas geocodificadas (`clinicCoords`)
- Implementar `handleBoundsSearch`: filtra `doctors` mantendo apenas os que têm coordenadas dentro dos bounds do mapa visível
- Implementar `handleShowOnMap(clinicId)`: chama `mapRef.current.focusClinic(clinicId)`
- Passar `onShowOnMap` para cada `DoctorCard`
- Adicionar botão "Limpar filtro do mapa" quando o filtro de bounds estiver ativo

## Fluxo do usuário

```text
1. Usuário abre /marketplace → vê lista + mapa com pinos azuis
2. Arrasta o mapa → botão "Buscar nesta área" aparece
3. Clica → lista filtra mostrando só clínicas visíveis no mapa
4. No card, clica "Mostrar no mapa" → mapa centraliza naquela clínica com zoom
```

## Resumo

| Arquivo | Mudança |
|---|---|
| `src/lib/geocode.ts` | Parâmetros estruturados, rate limit menor |
| `MarketplaceMap.tsx` | Pinos azuis, geocoding paralelo, botão "Buscar nesta área", método focusClinic |
| `DoctorCard.tsx` | Botão "Mostrar no mapa" |
| `Marketplace.tsx` | Orquestração: bounds filter, focusClinic, coordenadas compartilhadas |

