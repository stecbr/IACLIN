## O que vou ajustar no "Importar Extrato com IA"

### 1. Arrastar e soltar arquivo
No modal de upload (`ImportStatementDialog` em `src/pages/Financial.tsx`), a zona pontilhada hoje só aceita clique. Vou adicionar suporte a drag & drop (PNG, JPG, PDF) com feedback visual quando o arquivo é arrastado por cima. Clicar continua funcionando.

### 2. Editar transações antes/depois da revisão da IA
A IA pode errar valor, data, descrição ou tipo (receita/despesa). Vou tornar cada linha editável:

- **Na tela de revisão pós-IA** (antes de enviar para a fila de revisão): cada item vira um mini-formulário com descrição, valor, data e tipo editáveis.
- **Na aba "Revisão IA"** (lista `ReviewImportedTransactions`): botão de lápis abre edição inline dos mesmos campos. Salvar atualiza a linha em `imported_transactions` antes da aprovação.

### 3. Bug: aprovei uma transação e ela sumiu / saldo não mudou

Você está em **Financeiro · lucas ferreira** (contexto da clínica), mas, ao aprovar uma transação importada, o código atual insere em `financial_transactions` **sem `clinic_id`**, então ela cai no contexto **Pessoal**, e não aparece no painel da clínica nem soma/subtrai do saldo dela.

Correções no `approveTransaction` e `approveAll`:

- Incluir `clinic_id: currentClinicId` para a transação aparecer no contexto correto.
- Incluir `approval_status: 'approved'` + `approval_decided_by` + `approval_decided_at` para pular a fila de aprovação (senão ainda sumiria do dashboard até alguém aprovar de novo).
- Invalidar todas as queries do financeiro (`financial-transactions`, `financial-chart-6m`, `imported-transactions`, `pending-approvals`) para a UI atualizar imediatamente.

Resultado: ao aprovar a despesa de R$ 6,00, ela vai aparecer na aba **Transações** da clínica, o card **Despesas** vai para R$ 6,00 e o **Saldo** cai para R$ 14,00.

### Arquivos
- `src/pages/Financial.tsx` (único arquivo afetado — drag&drop, edição inline e fix do `clinic_id`/`approval_status` na aprovação).
