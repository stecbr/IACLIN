## Objetivo
1. Bot�o **Voltar** no prontu�rio do paciente respeitar a origem: se veio de `/prontuarios`, volta para l� (preservando a busca). Sen�o, mant�m `/patients`.
2. Adicionar **personaliza��o pessoal por m�dico** nos cards de paciente: cor do card, etiqueta curta e favorito (pin). Vis�vel s� para o m�dico logado.

## 1. Voltar contextual

### `src/pages/OpenChart.tsx`
- Ao navegar para `/patients/:id`, passar `state: { from: '/prontuarios', search }` no `<Link>` (trocar por `useNavigate` ou usar `Link` com `state`).
- Persistir o termo de busca em `sessionStorage` (`open-chart.search`) e re-hidratar no `useState` inicial, para que ao voltar a busca continue.

### `src/pages/PatientDetail.tsx`
- Ler `location.state?.from`. Se for `/prontuarios`, o link "Voltar" aponta para `/prontuarios` com label �Voltar aos prontu�rios�. Caso contr�rio, mant�m `/patients`.

## 2. Personaliza��o pessoal do paciente (por m�dico)

### Migration nova
Criar tabela `patient_personalizations` (pessoal, escopo por usu�rio):

```sql
create table public.patient_personalizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  color text,           -- hex (#RRGGBB) ou null
  tag text,             -- etiqueta curta, max ~24 chars
  is_favorite boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, patient_id)
);

alter table public.patient_personalizations enable row level security;

-- Cada usu�rio s� v� / mexe nos pr�prios registros
create policy "own select" on public.patient_personalizations
  for select to authenticated using (user_id = auth.uid());
create policy "own insert" on public.patient_personalizations
  for insert to authenticated with check (user_id = auth.uid());
create policy "own update" on public.patient_personalizations
  for update to authenticated using (user_id = auth.uid());
create policy "own delete" on public.patient_personalizations
  for delete to authenticated using (user_id = auth.uid());

create index on public.patient_personalizations (user_id, patient_id);
create index on public.patient_personalizations (user_id, is_favorite) where is_favorite;
```

Trigger leve para `updated_at` (opcional, sen�o setado no upsert client-side).

### Novo hook: `src/hooks/usePatientPersonalization.ts`
- `usePatientPersonalizations(patientIds: string[])` � retorna `Map<patient_id, { color, tag, is_favorite }>` para o usu�rio atual.
- `usePatientPersonalization(patientId)` � single + mutate (upsert por `(user_id, patient_id)`).
- Invalida queries `['patient-personalizations']` ap�s mutate.

### Novo componente: `src/components/patients/PatientPersonalizeMenu.tsx`
Popover acionado por um bot�o "Personalizar" com:
- Paleta de 6 cores predefinidas (tokens HSL) + "Sem cor".
- Input curto para tag (`maxLength={24}`).
- Toggle "Favorito" (estrela).
- Bot�o "Limpar personaliza��o".

### `src/pages/OpenChart.tsx`
- Buscar personaliza��es do usu�rio (`usePatientPersonalizations(allIds)`).
- Cada card aplica:
  - Borda lateral colorida (`border-l-4`) com a cor escolhida.
  - Badge da tag (se houver).
  - �cone estrela preenchido se favorito.
- Ordena��o: favoritos primeiro, depois alfab�tico.
- Cada card ganha um bot�o discreto �  (3 dots) que abre `PatientPersonalizeMenu` (stopPropagation no `Link`).

### `src/pages/PatientDetail.tsx`
- No header do paciente (ao lado do nome) mostrar tag + favorito.
- Adicionar bot�o **Personalizar** que abre o mesmo `PatientPersonalizeMenu`.

## Fora de escopo
- Compartilhar personaliza��o entre m�dicos da cl�nica.
- Notas longas pessoais (n�o pedido).
- Mudan�as no `PatientPickerDialog` legado.
- Alterar cor em outros lugares (agenda, financeiro) � s� cards de prontu�rio e header do paciente.
