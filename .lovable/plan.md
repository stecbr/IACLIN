

# Plano: Agenda global com filtro por médico (modo Clínica) + remover Disponibilidade do menu da clínica

## Contexto

Hoje, na Agenda (`src/pages/Agenda.tsx`):
- **Médico (dentist)**: vê só os próprios agendamentos. ✅ Correto.
- **Admin/Secretária**: vê todos os agendamentos da clínica, mas **sem nenhum filtro visual** — fica tudo amontoado, impossível separar por profissional.

E no menu lateral, **Disponibilidade** aparece para `admin` e `dentist`. Essa tela é pessoal do médico (cada um marca os próprios turnos), então não faz sentido pra clínica.

## O que muda

### 1. Agenda — filtro por médico (apenas para admin/secretary)

Adicionar um **seletor de médico** no topo da tela de Agenda, ao lado dos botões de navegação Hoje/anterior/próximo:

```
[<] [Hoje] [>]  Semana de 21 a 27 de abril       [Médico: Todos ▾]   [Dia | Semana | Mês]
```

Comportamento:
- Lista carregada de `clinic_members` da clínica atual (juntando com `profiles.full_name`), só usuários com role `admin` ou `dentist` (quem atende).
- Opções: **"Todos os médicos"** (default) + um item por profissional, com avatar/iniciais.
- Estado persistido em `localStorage` (`iaclin.agendaDoctorFilter`) para a secretária não ter que reescolher toda vez.
- Quando filtra por um médico, a query da agenda passa a aplicar `eq('dentist_id', selectedDoctorId)` — mesma lógica que já existe para o role `dentist`, só que controlada pela secretária/admin.
- **Cada agendamento na grade mostra um pequeno avatar/inicial colorida do médico** (canto superior direito do card) quando está em "Todos" — assim, mesmo na visão geral, dá pra bater o olho e saber de quem é a consulta.
- O seletor **não aparece** quando `effectiveRole === 'dentist'` (médico continua vendo só o próprio).

### 2. Coluna por médico no modo Semana (opcional, dentro do mesmo seletor)

Adicionar uma terceira opção no seletor: **"Comparar lado a lado"** — só ativa no modo **Semana** e **Dia**. Quando ligada, em vez de mesclar todos os agendamentos, divide cada coluna de dia em sub-colunas por médico (estilo Google Calendar com múltiplos calendários). Visual:

```
        | Seg 21                  | Ter 22                  |
        | Dr. A | Dr. B | Dr. C   | Dr. A | Dr. B | Dr. C   |
  09:00 | apt   |       | apt     |       | apt   |         |
  10:00 |       | apt   |         | apt   |       | apt     |
```

Se houver mais de 4 médicos ativos, cai automaticamente pra modo "Todos mesclado" pra não quebrar layout, e mostra aviso discreto: *"Comparação lado a lado disponível para até 4 médicos."*

### 3. Remover "Disponibilidade" do menu para admin e secretary

No `AppSidebar.tsx`:
```ts
{ title: 'Disponibilidade', url: '/disponibilidade', icon: CalendarClock, allowedRoles: ['dentist'] }
```
(antes: `['admin', 'dentist']`)

E em `useRoleAccess.ts` — `routePermissions`:
```ts
{ path: '/disponibilidade', allowedRoles: ['dentist'] }
```

Assim a rota fica acessível só para o médico. Se um admin tentar acessar `/disponibilidade` direto pela URL, é redirecionado pra `/`.

## Visual do seletor de médico

```
┌──────────────────────────────────┐
│ 👥 Médico: Todos             ▾   │
└──────────────────────────────────┘
```

Aberto:
```
┌──────────────────────────────────────┐
│  ✓ 👥 Todos os médicos               │
│  ─────────────────────────────────   │
│    🟦 FS  Dr. Felipe Siqueira        │
│    🟪 GF  Gabriela Ferreira          │
│    🟧 LP  Luan Pereira               │
│  ─────────────────────────────────   │
│    ⊞  Comparar lado a lado           │
└──────────────────────────────────────┘
```

Cor do dot ao lado das iniciais é gerada por hash do `user_id` (estável) — mesma cor usada no avatar do card de agendamento.

## Arquivos tocados

- **Editado**: `src/pages/Agenda.tsx` — adicionar `DoctorFilter` no header da tela; estender `useQuery` pra aplicar `eq('dentist_id', filterId)` quando admin/secretary escolhe médico; renderizar avatar do médico no card quando `filterId === null`; implementar layout de sub-colunas por médico no modo "Comparar".
- **Novo**: `src/components/agenda/AgendaDoctorFilter.tsx` — componente do seletor (dropdown shadcn), busca médicos via `clinic_members + profiles`, persiste no localStorage.
- **Novo**: `src/lib/avatarColor.ts` — helper `getAvatarColor(userId: string)` que devolve uma cor estável de uma paleta fixa (8 cores).
- **Editado**: `src/components/AppSidebar.tsx` — `Disponibilidade` passa a ter `allowedRoles: ['dentist']`.
- **Editado**: `src/hooks/useRoleAccess.ts` — `/disponibilidade` passa a ter `allowedRoles: ['dentist']`.

## O que NÃO muda

- Banco, RLS, edge functions: zero mudanças.
- Visão do médico: continua exatamente igual (vê só a própria agenda, sem seletor).
- Visão do paciente: inalterada.
- Página `/disponibilidade` em si: continua existindo, só sai do menu do admin.
- Dashboard, Financeiro, Pacientes, etc: inalterados.

## Confirmação

Vou seguir com tudo isso de uma vez (filtro + remover do menu + comparação lado a lado opcional). Se preferir começar **só pelo filtro por médico** e deixar a "comparação lado a lado" pra uma próxima rodada, é só falar antes de eu implementar.

