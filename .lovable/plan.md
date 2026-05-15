## Diagnóstico

Os pontos de acesso ao prontuário foram implementados na entrega anterior e estão presentes no código:

- `AppSidebar.tsx` — item "Abrir prontuário" + `PatientPickerDialog`
- `CommandPalette.tsx` — grupo "Abrir prontuário"
- `agenda/AppointmentDetailDialog.tsx` — botão renomeado com ícone `FolderHeart`
- `waiting-room/WaitingRoomCard.tsx` — botão "Prontuário"
- `patients-of-day/DayAppointmentRow.tsx` — botão "Prontuário"
- `pages/Patients.tsx` — coluna de ação com `FolderHeart`
- `pages/dentist/DentistHome.tsx` — botão "Prontuário" no card
- `pages/Attendance.tsx` — link "Ver prontuário completo"

**Por que você não vê nenhum:** a sessão atual está parada no diálogo "Como você vai começar?" (escolher consultório próprio ou entrar com código de clínica). Enquanto isso não for resolvido, o sidebar e as páginas internas nem são renderizados.

**Bug real encontrado:** em `AppSidebar.tsx` o item "Abrir prontuário" está dentro do bloco `{currentClinicId && (...)}` (a partir da linha 339). Logo, **um dentista em modo pessoal nunca verá esse atalho no sidebar**, mesmo depois de escolher "Atender no meu próprio consultório".

## O que será ajustado

### 1. Mover o item "Abrir prontuário" para fora do bloco `currentClinicId`
- Em `src/components/AppSidebar.tsx`, extrair o `SidebarMenuItem` "Abrir prontuário" (linhas ~358–369) e renderizá-lo também quando `isPersonalMode` for verdadeiro.
- O `PatientPickerDialog` já trata modo pessoal (filtra `clinic_id IS NULL` e `dentist_id = user.id`), então funciona sem mais mudanças.

### 2. Garantir item visível em todos os papéis relevantes
- Manter visibilidade para `admin`, `dentist`, `secretary`, e adicionar para dentista em modo pessoal.

### 3. Verificação visual após o ajuste
- Capturar screenshot do sidebar (modo pessoal e modo clínica) confirmando "Abrir prontuário" presente.
- Conferir agenda, sala de espera, pacientes do dia, lista de pacientes, atendimento e Home do Dentista — todos os botões já estão no código, então só preciso confirmar que renderizam após a sessão ter clínica/modo pessoal.

## Fora de escopo

- Sem mudanças de backend, RLS ou lógica.
- Sem novos componentes — apenas reposicionar um item já existente.
- Não vou alterar o fluxo de "Como você vai começar?" — você precisa escolher uma das duas opções para ver o restante do app.

## Como validar do seu lado

1. Na tela atual, clique em **"Atender no meu próprio consultório"** (ou entre com código de clínica).
2. Após isso, o sidebar mostrará: Agenda, Pacientes, Pacientes do Dia, Sala de Espera, **Abrir prontuário** (novo, com ícone de coração/pasta), etc.
3. Em qualquer card de paciente (agenda, sala de espera, pacientes do dia, lista) você verá o atalho "Prontuário".
