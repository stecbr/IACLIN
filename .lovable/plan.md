## Problema

No cabeçalho do prontuário do paciente há 6 botões lado a lado (Iniciar atendimento, Exportar prontuário, Compartilhar, WhatsApp, Editar, Personalizar). Em telas médias eles transbordam horizontalmente, forçando o usuário a rolar para a direita.

## Solução

Manter apenas **Iniciar atendimento** como botão primário sempre visível, e agrupar os demais em um único botão **"Ações"** com ícone de três pontos (`MoreHorizontal`) que abre um `DropdownMenu` com a lista vertical das ações.

## Mudanças

Arquivo único: `src/pages/PatientDetail.tsx` (header de ações do paciente).

1. Importar `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator` de `@/components/ui/dropdown-menu` e o ícone `MoreHorizontal`.
2. No header, manter o botão **Iniciar atendimento** intacto (primário, azul).
3. Substituir os botões soltos (Exportar prontuário, Compartilhar, WhatsApp, Editar, Personalizar, Nova cobrança se existir aqui) por um único `<Button variant="outline">` com label **"Ações"** + ícone `MoreHorizontal`, que abre um `DropdownMenu`.
4. Cada item do dropdown reusa o `onClick` / handler atual do botão correspondente e mantém o ícone à esquerda (Download, Share2, MessageCircle, Pencil, Palette…). Itens que abrem diálogos (Compartilhar, Editar, Personalizar) continuam usando seus dialogs/menus atuais — embrulhar `DropdownMenuItem` com `onSelect={(e) => e.preventDefault()}` quando o item já é um trigger de outro componente, para evitar fechamento prematuro, ou colocar o trigger original dentro do item.
5. Para WhatsApp, manter o destaque visual (texto verde) dentro do item do dropdown.
6. Responsivo: no mobile o comportamento fica naturalmente mais limpo (2 botões apenas). Em desktop, o header deixa de transbordar.

## Fora do escopo

- Nenhuma mudança de lógica de negócio, permissões ou dados.
- Nenhuma alteração nas tabs abaixo do header.
- Nenhuma alteração em outros headers (lista de pacientes, etc.).
