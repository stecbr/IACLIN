

# IACLIN — UI/UX Professional Overhaul

## Current Problems
- **Sidebar** is generic — no visual hierarchy, no section grouping, no clinic context (plan type, notifications)
- **Dashboard** is static placeholders (all "0") with no real data, no charts, no "next appointments" preview — feels like a template, not a product
- **Header** is nearly empty — just a sidebar trigger, wasting prime real estate
- **Pages** all look the same — same `space-y-6` layout, no visual differentiation between modules
- **Auth page** is bare minimum — no branding, no illustration, no trust signals
- **Empty states** are all identical dashed boxes — missed opportunity for onboarding guidance
- **No animations/transitions** — feels static and lifeless
- **Color system** underutilized — everything is gray/blue, no warmth or personality

## Design Philosophy
Inspired by **Linear**, **Notion**, **Cal.com** — clean but alive. Key principles:
- Subtle micro-animations (fade-in on mount, hover lifts)
- Meaningful empty states with CTAs
- Data-rich dashboard with real queries
- Contextual header with breadcrumbs + page actions
- Sidebar with grouped sections + notification badges

---

## Changes

### 1. Enhanced Sidebar
- **Group nav items** into sections: "Principal" (Dashboard, Agenda) and "Clínica" (Pacientes, Odontograma, Financeiro) with `SidebarGroupLabel`
- Add **notification badge** on Agenda (today's appointment count) from real data
- Add **clinic name** below IACLIN logo (from profiles/clinics table)
- Subtle **active indicator** — left accent bar (3px primary border) instead of just background change
- **Settings** separated at bottom, above user profile
- Smooth **collapse transition** with opacity fade on text

### 2. Contextual Header Bar
- **Breadcrumb navigation** showing current location (e.g., "Pacientes / João Silva")
- **Page-specific actions** on the right (e.g., "Nova Consulta" button when on Agenda)
- **Search command palette** trigger (Cmd+K style) — search patients, navigate pages
- **Notification bell** icon with count badge

### 3. Live Dashboard with Real Data
- **KPI cards connected to real Supabase queries**: count today's appointments, active patients, monthly revenue sum, no-show rate calculation
- **"Próximas Consultas" section** — list of next 5 upcoming appointments with patient name, time, procedure, status chip
- **"Pagamentos Pendentes" section** — upcoming/overdue receivables
- **Mini weekly chart** (simple bar chart using divs, no library) showing appointment volume per day
- **Fade-in animation** on cards using CSS `@keyframes`

### 4. Improved Auth Page
- **Split layout**: left side with branding (logo, tagline, feature bullets), right side with form
- **Gradient accent** on left panel
- **Better form spacing** and input styling with focus rings
- Add **"Esqueci minha senha"** link (even if not functional yet)

### 5. Page-Level Polish
- **Patients list**: Table view option (toggle between cards/table), row hover highlight, patient photo placeholder with gradient avatars
- **Agenda**: Smoother time grid, current-time indicator (red line), better appointment cards with rounded badges
- **Odontogram**: Better tooth SVG with anatomical shapes (5-surface per tooth), hover tooltips, selected state glow
- **All pages**: Consistent page header component with title + description + action button pattern

### 6. Shared Components & Animations
- Create `PageHeader` component (title, subtitle, action slot, breadcrumb)
- Create `EmptyState` component with icon, message, CTA, and illustration variant per module
- Add CSS keyframes: `fade-in`, `slide-up`, `scale-in` for page transitions
- Add `animate-in` utility class applied to main content areas

### 7. Design Tokens Refresh
- Slightly warmer background (`--background: 220 20% 99%` → `0 0% 98%`)
- Card shadows: `shadow-sm` → custom subtle shadow (`0 1px 3px rgba(0,0,0,0.04)`)
- Border radius increase: `0.75rem` → `0.875rem` for more iOS feel
- Add `--chart-1` through `--chart-5` CSS variables for data visualization

---

## Files to Create/Modify
- `src/components/PageHeader.tsx` — new shared component
- `src/components/EmptyState.tsx` — new shared component  
- `src/components/CommandPalette.tsx` — new Cmd+K search
- `src/components/AppSidebar.tsx` — grouped nav, badges, active indicator
- `src/components/AppLayout.tsx` — breadcrumbs, contextual header
- `src/pages/Index.tsx` — live KPIs, upcoming appointments, pending payments, mini chart
- `src/pages/Auth.tsx` — split layout with branding
- `src/pages/Patients.tsx` — table/card toggle, better empty state
- `src/pages/Agenda.tsx` — current-time line, improved cards
- `src/pages/Odontogram.tsx` — better tooth shapes, tooltips
- `src/index.css` — animation keyframes, token refresh

## Implementation Order
1. Design tokens + animations + shared components (PageHeader, EmptyState)
2. Sidebar + Header overhaul
3. Dashboard with real data queries
4. Auth page redesign
5. Page-level polish (Patients, Agenda, Odontogram)

