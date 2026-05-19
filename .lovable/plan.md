## Tornar o card "Sessões de Hoje" clicável com lista de pacientes

No dashboard do dentista (`src/pages/dentist/DentistHome.tsx`), o card KPI "Sessões de Hoje" hoje é estático. Vou torná-lo interativo:

### Comportamento
- Clicar no card "Sessões de Hoje" abre um **Dialog (modal)** listando os pacientes das sessões do dia (todos os `todayApts`, com destaque visual para os concluídos).
- Cada linha mostra: horário, nome do paciente, procedimento e status.
- Clicar em qualquer linha (ou no nome do paciente) **navega para `/patients/:patient_id`** (prontuário), fechando o modal.

### Implementação
1. Adicionar estado `sessionsOpen` (boolean) no `DentistHome`.
2. Envolver o card "Sessões de Hoje" num `<button>`/`<div role="button">` com `onClick={() => setSessionsOpen(true)}` + `cursor-pointer` e foco acessível.
3. Adicionar um `<Dialog>` (shadcn) com:
   - Título "Sessões de hoje"
   - Lista dos `todayApts` (reutilizando o mesmo visual da seção "Sua Agenda de Hoje", só que clicável na linha inteira).
   - Cada item: `onClick={() => { navigate(`/patients/${apt.patient_id}`); setSessionsOpen(false); }}`
   - Empty state quando não houver sessões.
4. Usar `useNavigate` do react-router para roteamento.
5. Animação fade-in/out (padrão dos modais do projeto).

Sem alterações de schema, queries ou business logic — apenas UI/presentation.
