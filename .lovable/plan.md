## Problema

Ao salvar uma nova transação aparece:
`new row for relation "financial_transactions" violates check constraint "financial_transactions_type_check"`

**Causa:** o CHECK do banco na coluna `type` aceita apenas `'receivable' | 'payable'`, mas todo o app (formulário, importação de extrato, trigger de notificação `notify_new_transaction`) usa `'income' | 'expense'`. A constraint é o ponto fora da curva.

A tabela `financial_transactions` está vazia, então é seguro alinhar a constraint ao código.

## Correção

Migration única ajustando a CHECK constraint para os valores que o app realmente usa:

```sql
ALTER TABLE public.financial_transactions
  DROP CONSTRAINT financial_transactions_type_check;

ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_type_check
  CHECK (type IN ('income', 'expense'));
```

Sem mudanças de código no frontend — `Financial.tsx`, importação de extrato e o trigger continuam funcionando como já estão escritos.

## Fora do escopo

- Não vou mexer em `status` nem `payment_method` (valores atuais do form batem com as constraints existentes).
- Não vou alterar o trigger `notify_new_transaction`.