## Problema
No carrossel atual os cards estão com `w-[220px]` e `gap-4`, fazendo títulos longos ("Atendimentos Concluídos Hoje", "Faturado no Mês") quebrarem em 2-3 linhas e empurrarem o ícone para o canto, deixando tudo apertado e pouco legível.

## Ajuste em `src/components/dashboard/SpecialtyHomeShell.tsx`

1. **Aumentar largura dos cards**: trocar `w-[220px]` por `w-[260px] md:w-[280px]` para acomodar títulos longos em uma única linha (ou no máximo duas, sem espremer o valor).
2. **Mais respiro entre cards**: aumentar `gap-4` para `gap-5` e adicionar `pr-4` no fim do scroller para o último card não colar.
3. **Layout interno do header do card**:
   - Garantir `gap-3` entre título e ícone.
   - Adicionar `leading-tight` no `CardTitle` e remover quebras forçadas — com a nova largura títulos cabem.
   - Manter o ícone fixo (`shrink-0`) para não comprimir.
4. **Padding do valor**: aumentar margem superior do número (`mt-1` → `mt-2`) e do `desc` para hierarquia mais clara.
5. **Setas**: reposicionar levemente para fora (`-left-2` / `-right-2`) já que agora os cards ocupam mais espaço, e manter visibilidade só em hover no desktop.

Nada além disso muda — API `KpiSpec`, drag, snap e responsividade continuam iguais.
