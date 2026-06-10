Adicionar botão de visualizar (ícone olho) nos PDFs da aba **Imagens** (componente `PatientDocuments.tsx`), seguindo o mesmo padrão já existente na aba **Arquivos** (`PatientFiles.tsx`).

## O que muda
- Em `src/components/patients/PatientDocuments.tsx`, na lista de Documentos (PDFs), adicionar um botão com ícone `Eye` antes dos botões de download e excluir.
- Ao clicar, chama `openPreview(doc.file_url)` (função já existente que gera signed URL e abre em nova aba).
- Sem alterações de schema, lógica de upload ou backend.