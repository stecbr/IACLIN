## Diagnóstico

Verifiquei o banco e o código do fluxo de Revisão IA. O que está acontecendo:

- Todas as transações importadas aprovadas no banco hoje continuam com `transaction_date = 2019-07-10` (data original do extrato). Nenhuma transação aprovada com 23/06 existe.
- Provável causa: ao editar a data no card e clicar direto no ✓ verde (Aprovar), o app **não usa o valor editado**. Em modo de edição só aparecem "Cancelar" e "Salvar"; se o usuário pular o Salvar e clicar Aprovar fora do modo edição, o `approveTransaction(tx)` recebe o `tx` do estado anterior (antes do refetch) e insere com a data antiga.
- Além disso, se o usuário clica Salvar e logo em seguida Aprovar muito rápido, há uma corrida (refetch em background) e a aprovação pode usar dados desatualizados em cache.

## Plano de correção (somente UI em `src/pages/Financial.tsx`, função `ReviewImportedTransactions`)

### 1. Approve sempre usa dado fresco do banco
Em `approveTransaction`:
- Antes de inserir em `financial_transactions`, fazer `SELECT * FROM imported_transactions WHERE id = tx.id` para pegar o registro atualizado (descrição, valor, data, tipo) e só então montar `buildFinancialRow`.
- Mesmo tratamento dentro do loop `approveAll`.

### 2. Botão "Salvar e Aprovar" no modo edição
No formulário inline (quando `editingId === tx.id`), adicionar três botões:
- **Cancelar**
- **Salvar** (apenas persiste)
- **Salvar e Aprovar** (persiste com `draft` e em seguida insere em `financial_transactions` usando os mesmos valores do draft — sem depender de refetch)

Assim o usuário consegue editar a data para 23/06 e aprovar em um único clique.

### 3. Indicação visual de edições não salvas
Se `editingId === tx.id`, ocultar os botões de Aprovar/Rejeitar de fora do card de edição (já está), mas adicionar um pequeno aviso "Edição não salva" caso o usuário tente sair do modo edição (mantém-se simples: o próprio botão "Salvar e Aprovar" elimina o atrito).

### 4. Manter o auto-switch para "Todos os períodos"
Já implementado — preservar. A diferença agora é que, com a correção do item 1/2, a transação aprovada terá a data correta (23/06) e aparecerá no "Mês Atual" sem precisar trocar filtro.

### 5. Nenhuma mudança de backend
- Sem migrações, sem mudanças em RLS, sem triggers.
- Apenas leitura adicional em `imported_transactions` antes da inserção.

## Arquivos afetados
- `src/pages/Financial.tsx` (apenas o componente `ReviewImportedTransactions`)
