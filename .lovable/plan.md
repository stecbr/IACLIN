## Ajuste no Modal de Novo Paciente — Fluxo CPF-first

Reestruturar `PatientFormDialog` (modo "Novo Paciente") em **etapas progressivas**, começando pelo CPF e revelando o restante apenas após a verificação. Edição de paciente existente permanece inalterada.

### Fluxo de telas (modo "Novo")

```
┌─ Passo 1: CPF ────────────────────────────────┐
│ [CPF do paciente] ___.___.___-__              │
│ [ ] Paciente estrangeiro (sem CPF)            │
│                          [Continuar]          │
└───────────────────────────────────────────────┘
            │
   ┌────────┴────────┐
   ▼ existe          ▼ não existe / estrangeiro
┌──────────────────────────┐  ┌─────────────────────────────┐
│ Passo 2A — Já cadastrado │  │ Passo 2B — Convidar / criar │
│ "Este paciente já possui │  │ Nome completo *             │
│  conta no iClin."        │  │ E-mail *                    │
│ [Solicitar Vinculação]   │  │ Telefone                    │
│ [Voltar]                 │  │ [Enviar convite por e-mail] │
│ Estado pós-envio:        │  │ ── ou ──                    │
│ "Solicitação enviada.    │  │ [Cadastrar sem convite ▾]   │
│  Aguarde aprovação."     │  │   (abre formulário completo)│
└──────────────────────────┘  └─────────────────────────────┘
```

### Comportamento detalhado

**Passo 1 — CPF**
- Único campo visível inicialmente é o CPF (com máscara) + toggle "Paciente estrangeiro".
- Botão **Continuar** desabilitado até CPF válido (`isValidCPF`) ou toggle estrangeiro ligado.
- Ao clicar Continuar: chama `request-patient-link` com `mode: 'check'`. Loading inline.
- Se estrangeiro → vai direto ao Passo 2B (sem checagem, CPF vazio).

**Passo 2A — CPF já existe**
- Mensagem clara (Alert com ícone `UserCheck`): "Este paciente já possui conta no iClin. Para acessá-lo, envie uma solicitação de vinculação. O paciente receberá um e-mail e uma notificação na plataforma e deverá aprovar."
- Botão **Solicitar Vinculação** → chama `request-patient-link` com `mode: 'create'`.
- Após sucesso: estado "enviado" com mensagem "Solicitação enviada. O paciente tem 24h para aceitar." + botão Fechar.
- Trata `already_linked` e `already_pending` (já existem no edge function).
- Botão **Voltar** retorna ao Passo 1.

**Passo 2B — CPF novo (ou estrangeiro)**
- Exibe apenas: Nome completo, E-mail, Telefone (compactos).
- Ação primária: **Enviar convite por e-mail** → chama `invite-new-patient`. Após sucesso, fecha o modal com toast "Convite enviado".
- Ação secundária (link discreto): **"Cadastrar manualmente sem convite"** → expande para o formulário completo atual (todos os campos restantes: endereço, responsável, convênio, etc.) e mostra o botão **Salvar** original que cria a linha em `patients` localmente.
- Botão **Voltar** retorna ao Passo 1.

### Mudanças no código

- **`src/components/patients/PatientFormDialog.tsx`** (modo novo apenas):
  - Adicionar estado `step: 'cpf' | 'exists' | 'new'` e `linkRequestSent: boolean`.
  - Remover a checagem debounced atual e o botão "Solicitar Vinculação" que aparece junto com o formulário; mover essa lógica para os passos.
  - Renderização condicional: ocultar foto + todas as `SectionHeader` até `step === 'new'` com modo "manual" ativado. Em `step === 'new'` modo "convite", mostrar apenas mini-form (3 campos).
  - Resetar `step` para `'cpf'` ao abrir.
  - Em modo edição (`isEdit`), pular passos: formulário completo direto, igual ao atual.

- **Backend**: nenhuma alteração de schema. Funções `request-patient-link`, `respond-patient-link` e `invite-new-patient` já existem e cobrem o fluxo. Apenas o frontend muda.

### Fora do escopo
- Entrega real do e-mail de convite (`invite-new-patient` hoje loga o link; integração de transactional email permanece como passo posterior).
- Mudanças em `AppointmentFormDialog` / `BudgetFormDialog` (esses já chamam `PatientFormDialog`, herdam o novo fluxo automaticamente).
