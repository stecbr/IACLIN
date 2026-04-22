

# Plano: Validar fluxo de agendamento Flavio → Joel

## Diagnóstico

Olhei o estado atual no banco e o código do fluxo `/paciente/agendar`:

- **Joel** (cardiologia, clínica "Lucas Ferreira Santos Gomes") tem **disponibilidade só hoje, 22/04, das 19:00 às 23:00**. Nenhum outro dia cadastrado.
- **Flavio Batista** (paciente, CPF 60756355303) **não tem nenhum registro em `patients`** ainda — então o fluxo precisa criar um na hora do agendamento.
- O botão "Confirmar agendamento" em `SummaryStep.tsx` chama `handleConfirm` em `PatientBooking.tsx` que **já faz tudo certo**: procura paciente por CPF na clínica, cria se não existir, e insere o agendamento.

**O botão já funciona.** Não precisa de gambiarra "uma vez só". O que provavelmente travou na sua tentativa foi um destes:

1. Você selecionou uma data que **não é hoje** → na tela 3 não aparece o Joel (ele só tem agenda dia 22/04).
2. Selecionou hoje mas um horário **antes das 19:00** → todos os slots aparecem disponíveis a partir das 19h só.
3. O slot que você clicou **já passou** (se tentou agora, antes das 19h, o array `slots` ainda mostra de 19h pra frente, então tudo bem).

## O que vou ajustar pra destravar o teste

### 1. Garantir disponibilidade do Joel pra hoje + amanhã + depois
Vou rodar uma migration que **adiciona disponibilidade do Joel pros próximos 7 dias** (08:00–18:00, segunda a sexta), pra você poder testar em qualquer horário sem ficar preso ao 19–23h de hoje.

### 2. Melhorar o feedback de erro no `handleConfirm`
Hoje, se algo falha em silêncio (ex: RLS bloqueando o INSERT em `patients` por algum motivo), o toast só mostra `err.message` que pode vir vazio. Vou:
- Logar o erro completo no console com contexto (`{ step: 'create_patient', error }`).
- Mostrar toast com mensagem mais clara: "Falha ao criar paciente: {detalhe}" ou "Falha ao criar agendamento: {detalhe}".

### 3. Pré-popular o `patient_account` do Flavio com nome/CPF/phone (se faltar algo)
O Flavio já tem `patient_account` completo (Flavio Batista, CPF 60756355303, telefone). O fluxo `PatientBooking.tsx` lê de `usePatientData().account` e usa esses dados pra criar o paciente. Tá ok.

### 4. Visualização na área do Joel
Depois que o agendamento for criado, ele aparece automaticamente:
- **Agenda do Joel** (`/agenda`) → como dentist, ele vê só os próprios; aparece o card "Flavio Batista — cardiologia — HH:MM".
- **Notificação**: o trigger `notify_new_appointment` já cria notificação pro `dentist_id` (Joel).
- **Painel inicial** (`/medico`) → mostra próximas consultas.

## O que NÃO vou fazer

- **Não vou criar um botão "uma vez só"**. O fluxo normal já faz exatamente isso. Adicionar um bypass criaria dívida técnica e poderia mascarar o bug real.
- **Não vou mexer em RLS** — as policies já permitem o paciente criar registros na própria clínica via `clinic_id` e o trigger `link_patients_by_cpf` cuida do vínculo.
- **Não vou simular o agendamento por SQL direto**. Quero que você valide o fluxo real do Flavio clicando, porque é isso que o usuário final vai fazer.

## Arquivos tocados

**Editados:**
- `src/pages/PatientBooking.tsx` — melhorar logs e mensagens de erro do `handleConfirm`.

**Migration:**
- INSERT em `professional_availability` com 7 dias de disponibilidade do Joel (08:00–18:00, dias úteis), evitando duplicatas com `ON CONFLICT DO NOTHING` (ou checando antes).

## Como testar depois que eu implementar

1. Logar como **flavio@gmail.com**.
2. Ir em `/paciente/agendar`.
3. Selecionar **Cardiologia**.
4. Escolher qualquer dia útil dos próximos 7.
5. Expandir clínica "Lucas Ferreira Santos Gomes" → escolher um horário do Joel.
6. Confirmar.
7. Logar como **joel** → ver na agenda dele e na sininha de notificação.

