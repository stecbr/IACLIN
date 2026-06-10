## Problema

O bucket `patient-files` é **privado** (regra de segurança do projeto), mas os componentes `PatientDocuments.tsx` (aba "Imagens") e `PatientFiles.tsx` (aba "Arquivos") salvam o `publicUrl` no banco e usam essa URL nas tags `<img>`, links de download e iframe de PDF. Como o bucket é privado, essas URLs retornam erro e a miniatura aparece quebrada (ícone visto no print).

## Solução

Trocar `getPublicUrl` por **signed URLs** em ambas as abas, gerando URLs temporárias por demanda a partir do `storage_path` do arquivo.

### 1. Padronizar como armazenar o caminho
- Continuar fazendo `upload(path, file)` exatamente como hoje.
- Em vez de salvar `publicUrl` em `documents.file_url`, salvar o **caminho interno do storage** (ex.: `eff75ba6.../1733...-abc.pdf`). Esse caminho é o que `createSignedUrl` precisa.
- Compatibilidade: para registros antigos que têm URL pública completa, extrair o caminho de dentro de `/patient-files/...` no momento de assinar (já existe lógica parecida no delete).

### 2. Hook utilitário `useSignedFileUrl`
- Pequeno helper (`src/lib/storageSignedUrl.ts`) com:
  - `extractPath(fileUrl)` — devolve o caminho dentro do bucket, tanto para registros novos (já é o path) quanto antigos (URL pública contendo `/patient-files/`).
  - `getSignedUrl(path, expiresIn = 3600)` — chama `supabase.storage.from('patient-files').createSignedUrl`.
- Componente auxiliar `<SignedImage src={fileUrl} ... />` que resolve a signed URL com `useQuery` (cache por 50 min) e mostra fallback de "imagem quebrada" se falhar — substitui o `<img src={file.file_url}>` direto.

### 3. Ajustar `PatientFiles.tsx` (aba Arquivos)
- No upload: gravar `file_url = path` (não mais publicUrl).
- Render de imagens: usar `<SignedImage>` em vez de `<img src={file.file_url}>`.
- Lightbox de imagem: assinar a URL ao abrir.
- Botão "Download" e iframe de PDF: gerar signed URL on-click/on-open (com `download: filename` no `createSignedUrl` para forçar nome de download).
- Delete: continuar funcionando — ajustar `extractPath` para aceitar tanto path puro quanto URL antiga.

### 4. Ajustar `PatientDocuments.tsx` (aba Imagens)
- Mesmas mudanças: salvar path em vez de publicUrl, usar `<SignedImage>` no grid, signed URL no lightbox e no link de download.

### 5. Sem mudanças de schema
- A coluna `documents.file_url` passa a guardar o storage path; nenhum DDL necessário. Registros antigos continuam funcionando via fallback.

## Resultado esperado
- As miniaturas das imagens aparecem corretamente nas duas abas.
- PDFs abrem no preview e baixam com o nome correto.
- Mantém o bucket privado (sem regredir a segurança).