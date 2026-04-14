

# Marketplace de Agendamento — Plano Final

## 1. Migration SQL (apenas RLS para acesso público)

Adicionar políticas SELECT para `anon` nas tabelas necessárias para a página de busca:

```sql
-- profiles: nome e foto dos profissionais
CREATE POLICY "Anon can view profiles" ON public.profiles FOR SELECT TO anon USING (true);

-- clinics: nome, endereço, cidade, business_hours
CREATE POLICY "Anon can view clinics" ON public.clinics FOR SELECT TO anon USING (true);

-- clinic_members: vincular profissional à clínica
CREATE POLICY "Anon can view clinic members" ON public.clinic_members FOR SELECT TO anon USING (true);

-- appointments: calcular slots ocupados
CREATE POLICY "Anon can view appointments" ON public.appointments FOR SELECT TO anon USING (true);

-- insurance_plans: listar convênios na confirmação
CREATE POLICY "Anon can view insurance plans" ON public.insurance_plans FOR SELECT TO anon USING (true);

-- procedures: nome do procedimento no card
CREATE POLICY "Anon can view procedures" ON public.procedures FOR SELECT TO anon USING (true);
```

Nenhuma coluna sensível é exposta (profiles tem apenas full_name, avatar_url, phone; clinics não tem dados críticos).

## 2. Instalar dependência

- `react-leaflet` + `leaflet` para o mapa

## 3. Arquivos a criar

| Arquivo | Descrição |
|---|---|
| `src/pages/Marketplace.tsx` | Página pública de busca: header, filtros, split lista+mapa |
| `src/pages/MarketplaceBooking.tsx` | Confirmação de agendamento (requer auth) |
| `src/components/marketplace/MarketplaceHeader.tsx` | Logo, barra de pesquisa, filtros visuais |
| `src/components/marketplace/MarketplaceFilters.tsx` | Chips de especialidade (vazio com "Em breve") + filtro por cidade funcional |
| `src/components/marketplace/DoctorCard.tsx` | Card: foto, nome, clínica, cidade + grid de horários reais |
| `src/components/marketplace/MarketplaceMap.tsx` | Leaflet centrado em Fortaleza, sem pinos, botão ampliar |
| `src/components/marketplace/BookingConfirmation.tsx` | Resumo, convênio, tipo visita, primeira consulta |

## 4. Modificar `src/App.tsx`

- Rota pública `/marketplace` → `<Marketplace />` (sem ProtectedRoute)
- Rota `/marketplace/agendar` → `<MarketplaceBooking />` (sem ProtectedRoute, mas componente faz redirect interno se não logado)

## 5. Lógica de dados

**Lista de profissionais:**
- Query `clinic_members` (role = dentist) → JOIN `profiles` (nome, foto) + `clinics` (nome, cidade, estado, phone, business_hours)
- Filtro por nome (pesquisa) e cidade

**Grid de horários:**
- Para cada profissional, buscar `appointments` dos próximos 4 dias com status != cancelled
- Calcular slots de 30min baseados em `business_hours` da clínica menos appointments ocupados
- Slots clicáveis navegam para `/marketplace/agendar?dentistId=X&clinicId=Y&date=Z&time=W`

**Confirmação:**
- Buscar `insurance_plans` da clínica do dentista
- Checkbox "Sem convênio (particular)"
- Se não logado → redirect `/auth`
- Botão "Continuar" → INSERT em `appointments`

## 6. Responsividade

- Mobile: mapa oculto, botão "Ver mapa" abre overlay fullscreen
- Desktop: split 60% lista / 40% mapa

## 7. Sem dados mockados

- Cards sem especialidade, CRM, preço, avaliações
- Mapa sem pinos
- Filtros de especialidade vazios
- Tudo alimentado exclusivamente pelo banco existente

