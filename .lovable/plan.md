## Objetivo

Na área do paciente (`/paciente/agendar`), simplificar a etapa "O que você procura?" e permitir filtrar por **cidade** (geolocalização manual) e por **convênio/plano**, para que o paciente encontre profissionais que aceitam seu plano e estão na cidade escolhida — útil quando o paciente é de Fortaleza mas está em Manaus, por exemplo.

## Mudanças (apenas frontend)

### 1. `SpecialtyStep.tsx` — esconder lista alfabética A–U
- Manter: campo de busca + bloco "Mais procurados" + botão "Não encontrei a especialidade desejada".
- **Remover/ocultar** o bloco com seções por letra (A, C, D, E, … U).
- Quando o usuário digitar na busca, continuar mostrando os "Resultados" normalmente.
- A constante `SPECIALTIES` permanece intacta (continua alimentando busca e steps seguintes).

### 2. Novos filtros globais de busca — cidade + convênio
Adicionar uma barra de filtros visível no topo da página `PatientBooking.tsx`, acima do `BookingProgress`, sempre disponível:

```text
[ 📍 Cidade: Manaus ▾ ]   [ 🛡️ Convênio: Unimed — Plano X ▾ ]   [ Limpar ]
```

- **Cidade**: combobox com autocomplete alimentado por `clinics.city` (distinct, ordenado). Default = cidade do `patient_account` se houver, senão vazio (= todas).
- **Convênio**: select com `insurance_plans` (operadora + nome do plano). Default = convênio salvo no `patient_account.insurance_provider`/`insurance_number` (match best-effort), senão "Particular / Todos".
- Estado guardado em `localStorage` (`patient_booking_filters`) para persistir entre visitas.
- Botão **Limpar** zera ambos.

### 3. `ClinicDoctorStep.tsx` — aplicar filtros
- Receber `cityFilter` e `insurancePlanId` via props.
- Após o fetch atual, filtrar:
  - **Cidade**: manter apenas clínicas onde `clinics.city` (case-insensitive, normalizado sem acentos) bate com o filtro.
  - **Convênio**: cruzar com `insurance_plans` da clínica (`clinic_id` + `is_active`); manter apenas clínicas que oferecem aquele plano. "Particular / Todos" não filtra.
- Empty state melhorado: "Nenhum profissional desta especialidade aceita {Convênio} em {Cidade} neste dia. Tente alterar a cidade, o convênio ou a data."

### 4. Nada de mudanças em backend / RLS / migrations
Tudo é apresentação e consulta de leitura. Nenhuma tabela nova, nenhuma policy nova.

## Arquivos a tocar
- `src/components/patient/booking/SpecialtyStep.tsx` — remover seção `grouped.map` (lista A–U).
- `src/pages/patient/PatientBooking.tsx` — barra de filtros + estado + persistência + passar props.
- `src/components/patient/booking/ClinicDoctorStep.tsx` — aceitar props `cityFilter`, `insurancePlanId`, aplicar filtros e ajustar empty state.
- (novo) `src/components/patient/booking/BookingFilters.tsx` — componente isolado com os dois selects.

## Não incluído (fora do escopo desta task)
- Geolocalização automática via GPS do navegador.
- Filtro por bairro / raio em km.
- Edição do convênio do paciente nesta tela (continua em "Configurações").
