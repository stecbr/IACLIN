

## Update SpecialtyStep with full alphabetical list + help modal

### Changes to `src/components/patient/booking/SpecialtyStep.tsx`

**1. Replace `SPECIALTIES` constant** with the full list (~70 items) from the user, each with an appropriate Lucide icon and starting letter for grouping. Categories kept (`medico`, `odonto`, `estetica`).

**2. Keep popular shortcuts** (Clínico Geral, Dentista, Limpeza Dental, Renovação de Receita, Avaliação) — remove the 🔥 emoji from the heading; keep just "Mais procurados".

**3. Keep existing card structure** (current grid + hover lift + icon tile) exactly as-is.

**4. Group rendering**: When no search query, after "Mais procurados" section, render specialties grouped by first letter:
   - Compute `useMemo` that groups `SPECIALTIES` by `name[0].toUpperCase()` and sorts alphabetically.
   - Render each letter as a section: small uppercase header "Letra A" / "Letra B" etc. (matches user's wording), then the same card grid below.
   - When searching, keep current flat filtered grid.

**5. Help button + modal** at the bottom of the list:
   - Button (full width, outlined, with `HelpCircle` icon): "Não encontrei a especialidade desejada".
   - Opens a `Dialog` (`@/components/ui/dialog`) — already in the project and respects the global fade-only animation rule.
   - Modal content:
     - Centered circular icon tile with `HelpCircle` (?) in primary color.
     - Title: "Não encontrou a especialidade?"
     - Body: "Verifique com a sua rede de atendimento. Fale com o atendimento."
     - Button: "Falar com atendimento" (layout only, no handler yet — `onClick` is a no-op placeholder).

### Icon mapping plan (Lucide)
Reuse existing icons where possible; map new ones sensibly:
- Acupuntura → `Sparkle`, Alergologia → `Wind`, Anestesiologia → `Syringe`, Angiologia → `Activity`, Avaliação Bariátrica → `Scale`, Avaliação Risco Cirúrgico → `ClipboardCheck`
- Cardiologia → `Heart`, Cirurgias → `Scissors` (variants), Clínico Geral → `Stethoscope`
- Dermatologia → `Hand`, Dor de Cabeça → `Brain`, Dor Costas → `PersonStanding`, Refluxo → `Flame`
- Endocrinologia → `Droplet`, Enfermagem → `HeartHandshake`
- Fisioterapia → `Dumbbell`, Fonoaudiologia → `Mic`
- Gastroenterologia → `Soup`, Genética → `Dna`
- Hematologia → `Droplets`, Homeopatia → `Leaf`
- Infectologia → `Bug`
- Mastologia → `Ribbon` (fallback `Heart`)
- Nefrologia → `Droplet`, Neurocirurgia/Neurologia → `Brain`, Nutrição/Nutrologia → `Apple`
- Oftalmologia → `Eye`, Oncologia → `Ribbon`/`Activity`, Ortopedia → `Bone`, Otorrino → `Ear`
- Pneumologia → `Wind`, Proctologia → `Stethoscope`, Psicologia/Psiquiatria/Psico* → `Brain`
- Renovação Receitas → `Pill`, Reumatologia → `Bone`
- Terapia Ocupacional → `HandHeart` (fallback `Hand`), Triagem Fono → `Mic`
- Urologia → `Droplet`
- Dentista → `Smile`, Limpeza Dental → `Sparkles`, Estética → `Sparkles`

Will verify each icon name exists in `lucide-react` before writing (fall back to `Stethoscope` if a name is missing).

### What stays the same
- Card visual treatment (icon tile + name + category subtitle).
- Search behavior, popular shortcuts logic, animations.
- Parent flow in `PatientBooking.tsx` — no changes needed.

### Out of scope
- "Falar com atendimento" action wiring (button is layout-only per user request).
- New routes, DB or schema changes.

