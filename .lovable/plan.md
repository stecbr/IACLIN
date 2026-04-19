

## Nova área "Agendar consulta" dentro do painel do paciente

Fluxo independente do Marketplace, com 4 etapas progressivas em uma única rota: `/paciente/agendar`.

### Etapa 1 — Escolha de especialidade
- Cards grandes com ícones: Clínico Geral, Dentista, Cardiologista, Dermatologista, Pediatra, Ginecologista, etc. (deriva da `category` da clínica + especialidades comuns)
- Barra de busca no topo (filtra cards em tempo real)
- Seção "Mais procurados" acima (atalhos rápidos: Clínico Geral, Renovação de receita, Limpeza dental, Avaliação)
- Animação de entrada suave (Framer Motion stagger)

### Etapa 2 — Escolha de dia
- Calendário (`shadcn/ui Calendar`) com `pointer-events-auto`
- Datas passadas e domingos desabilitados
- Mostra prévia de quantas clínicas/profissionais estão disponíveis na data selecionada

### Etapa 3 — Clínica + profissional + horário
- Lista de clínicas que oferecem a especialidade escolhida (filtra `clinics` pela `category` ou via `clinic_members.role`)
- Cada clínica expande mostrando os profissionais (`clinic_members` + `profiles`)
- Para cada profissional, gera **slots de 30 min** baseados em:
  - `clinics.business_hours` do dia escolhido
  - menos `appointments` já marcados naquele intervalo
- Slots clicáveis em grid (estilo Doctoralia)

### Etapa 4 — Resumo e confirmação
- Card com: especialidade, clínica (nome + endereço), profissional (avatar + nome), data/hora formatada
- Campo opcional "Motivo da consulta" (vai pra `appointments.notes`)
- Botões: **Voltar** (volta etapa) e **Confirmar agendamento**
- Ao confirmar: cria registro em `appointments` com status `pending`, vincula `patient_id` (busca/cria patient via CPF do `patient_account`), dispara notificação pra clínica (trigger já existente), redireciona pra `/paciente/agendas` com toast de sucesso

### Componentes a criar
- `src/pages/patient/PatientBooking.tsx` — página orquestradora com state machine das 4 etapas
- `src/components/patient/booking/SpecialtyStep.tsx`
- `src/components/patient/booking/DateStep.tsx`
- `src/components/patient/booking/ClinicDoctorStep.tsx`
- `src/components/patient/booking/SummaryStep.tsx`
- `src/components/patient/booking/BookingProgress.tsx` — indicador de etapa (1/4)

### Integração no painel
- `PatientHome.tsx`: botão "Agendar nova consulta" passa a navegar pra `/paciente/agendar` (não mais `/marketplace`)
- `PatientSidebar.tsx`: novo item "Agendar" com ícone `CalendarPlus`
- `App.tsx`: nova rota `/paciente/agendar` dentro do `PatientLayout`
- Mantém o Marketplace público intacto (B2C separado do painel logado)

### Banco de dados
- Nenhuma alteração de schema. Usa tabelas existentes: `clinics`, `clinic_members`, `profiles`, `appointments`, `patients`, `patient_accounts`, `procedures`
- Lógica de "garantir patient na clínica" no momento de confirmar: se não existe `patients` com `cpf` do paciente naquela `clinic_id`, insere; senão reutiliza

### UX details
- Transições suaves entre etapas (slide horizontal sutil + fade)
- Mobile-first (bottom nav continua visível)
- Empty states ilustrados ("Nenhum horário disponível neste dia — tente outra data")
- Loading skeletons em cada etapa enquanto busca

