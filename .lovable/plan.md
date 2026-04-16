

# Corrigir pinos que não aparecem no mapa

## Causa raiz
O Nominatim (OpenStreetMap) **não encontra** o endereço "Rua 02 Conjunto Jardim Das Flores, Fortaleza, CE" — nem com parâmetros estruturados, nem com busca livre. Testei várias combinações e todas retornam array vazio. Isso significa que o geocoding falha silenciosamente e nenhum pino é criado.

## Solução
Implementar uma **estratégia de fallback em cascata** no `geocode.ts`:

1. **Tentativa 1**: Busca estruturada completa (street + city + state + postalcode) — como está hoje
2. **Tentativa 2**: Busca livre com `q` (concatena tudo numa string) — pega endereços que o modo estruturado não encontra
3. **Tentativa 3**: Apenas cidade + estado — garante que **sempre** aparece um pino, mesmo que na localização aproximada da cidade

Isso garante que mesmo endereços não mapeados pelo OpenStreetMap apareçam no mapa (com precisão de cidade no pior caso).

## Mudanças

| Arquivo | O que muda |
|---|---|
| `src/lib/geocode.ts` | Adicionar fallback em cascata: structured → free-text → city-only |

Apenas 1 arquivo precisa ser alterado. O restante do fluxo (MarketplaceMap, Marketplace, DoctorCard) já está correto.

