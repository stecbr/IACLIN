## Ajustes no modal "Importar Extrato com IA"

**Arquivo:** `src/pages/Financial.tsx` (componente `ReviewImportedTransactions` dentro do `ImportStatementDialog`)

### Mudanças

1. **Largura do modal**
   - Alterar `DialogContent` de `max-w-md` (≈448px) para `max-w-3xl` (≈768px), para acomodar confortavelmente as 4 colunas (data, valor, tipo) sem espremer.

2. **Layout da linha de campos**
   - Ajustar o grid interno de cada item para dar mais espaço à data e ao valor (ex.: `grid-cols-[140px_1fr_140px]` ou similar), evitando que o input de valor apareça como "6".

3. **Campo Valor em formato R$**
   - Trocar o `<input type="number">` por um input de texto com máscara de moeda BRL:
     - Exibe sempre `R$ 1.234,56`
     - Ao digitar, o usuário só insere dígitos; a formatação é aplicada on-the-fly
     - Ao salvar/aprovar, converte de volta para número (centavos / 100) antes de enviar ao Supabase
   - Aplicar tanto na lista de revisão quanto no modo de edição inline.

### Sem mudanças de backend
Nenhuma alteração de schema, RLS ou edge function. Puramente UI/formatação.
