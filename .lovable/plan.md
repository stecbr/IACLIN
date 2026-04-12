# IACLIN — Dental Clinic Management SaaS MVP

## Design System

- **Style**: Clean, minimal, Apple/iOS-inspired with 21st.dev componentes aesthetic — generous white space, subtle shadows, rounded corners, smooth transitions, SF-like typography
- **Color palette**: Neutral whites/grays with a calm blue accent, soft pastels for procedure categories
- **Layout**: Collapsible sidebar navigation + clean content area optimized for fast secretary workflows

## Authentication & Roles

- Email/password auth via Lovable Cloud (Supabase)
- Role system with `user_roles` table: **admin** (clinic owner), **dentist**, **secretary**
- Role-based navigation: admin sees everything, secretary sees agenda/patients/financial, dentist sees agenda/patients/odontogram
- Login page with clinic branding

## Module 1: Sidebar & Dashboard

- Collapsible sidebar with icons: Dashboard, Agenda, Patients, Odontogram, Financial, Settings
- Dashboard with KPI cards: today's appointments, pending payments, monthly revenue, no-show rate
- Quick actions: new appointment, new patient, record payment

## Module 2: Smart Calendar/Agenda

- Day/week/month views using a calendar grid
- Drag-and-drop appointment creation and rescheduling
- Color-coded by procedure type (cleaning=green, extraction=red, etc.)
- Time slot blocking for lunch/breaks
- Appointment form: patient select, dentist select, procedure, duration, notes, status (scheduled/confirmed/completed/no-show)
- Filter by dentist

## Module 3: Patient Management

- Patient list with search, filters (active/inactive, insurance)
- Patient registration form: name, CPF, phone, email, address, date of birth, insurance info, photo
- Patient detail page with tabs: Info, Appointments History, Treatments, Financial, Documents
- Document/photo upload capability (X-rays, photos)

## Module 4: Odontogram (Dental Chart)

- Interactive SVG dental chart (adult 32 teeth, deciduous 20 teeth)
- Click tooth → select procedure/condition from categorized list
- Color-coded tooth status: healthy, cavity, restoration, extraction, crown, etc.
- Treatment plan builder: group procedures, estimate costs, track progress
- Clinical notes per visit with timestamps

## Module 5: Financial Management

- Accounts receivable: patient payments, installments, payment methods (cash, card, PIX, insurance)
- Accounts payable: clinic expenses, supplier payments
- Cash flow dashboard with daily/weekly/monthly views
- Dentist commission calculator (percentage or fixed per procedure)
- Simple DRE (income statement) report
- Payment status tracking (pending, paid, overdue)

## Database Tables

- `profiles` (linked to auth.users)
- `user_roles` (admin/dentist/secretary)
- `clinics`
- `patients`
- `appointments`
- `procedures` (catalog)
- `odontogram_entries` (tooth records per patient)
- `treatment_plans`
- `treatment_plan_items`
- `financial_transactions`
- `documents` (file references)

## Implementation Order

1. Auth + roles + sidebar layout + dashboard shell
2. Patient management (CRUD + detail page)
3. Smart calendar/agenda with appointment booking
4. Odontogram with interactive dental chart
5. Financial management module