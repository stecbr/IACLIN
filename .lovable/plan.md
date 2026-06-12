## Correção da tela branca em `/operadora/tabela-valores`

**Causa:** `<SelectItem value="">` no filtro de categorias. Radix UI proíbe valores vazios e lança erro que derruba a árvore React → tela em branco.

**Alterações em `src/pages/operadora/OperatorPriceTable.tsx`:**

1. Inicializar `filterCategory` com `"__all__"` em vez de `""`.
2. Trocar `<SelectItem value="">Todas as categorias</SelectItem>` por `<SelectItem value="__all__">Todas as categorias</SelectItem>`.
3. Ajustar a lógica de `filteredItems` para tratar `"__all__"` como "sem filtro" (só filtra quando `filterCategory !== "__all__"`).
4. Atualizar o botão de limpar filtros para `setFilterCategory("__all__")`.
5. Atualizar a condição que detecta "há filtros ativos" para `search || filterCategory !== "__all__"`.

**Escopo:** apenas presentacional, 1 arquivo. Sem alterações de schema ou backend.