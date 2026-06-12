## Diagnóstico

"Failed to send a request to the Edge Function" = falha antes da função responder. Causas prováveis para `parse-price-table`:

1. **Boot da função pode crashar** por causa do `import * as XLSX from 'npm:xlsx@0.18.5'` no topo do módulo (xlsx tem incompatibilidades conhecidas no edge-runtime Deno). O crash acontece mesmo para PDFs, pois o import é eager.
2. **Payload muito grande** no `supabase.functions.invoke`: o PDF de ~770KB vira ~1MB em base64 dentro de um JSON, o que pode estourar limites do gateway de invoke e retornar erro sem corpo.
3. Não há logs gravados para a função (`supabase--edge_function_logs` retornou vazio), reforçando que a função não chega a executar.

O arquivo `TABELA 0,30.pdf` em si é válido (PDF padrão, 770KB) — não é problema do arquivo.

## Correção

Como o frontend **já faz upload do arquivo** para o bucket `operator-price-files` antes de chamar a função, basta a função baixar do storage em vez de receber o conteúdo via base64.

**1. Refatorar `supabase/functions/parse-price-table/index.ts`:**
- Trocar `import * as XLSX` no topo por **import dinâmico** (`await import('npm:xlsx@0.18.5')`) só quando o arquivo for planilha. PDFs deixam de pagar esse custo e nunca disparam crash do xlsx.
- Aceitar `storage_path` no body em vez de (ou além de) `file_base64`. Baixar o arquivo com client service-role: `admin.storage.from('operator-price-files').download(storage_path)`.
- Manter compatibilidade com `file_base64` como fallback.
- Adicionar `console.error` em pontos chave para os próximos uploads aparecerem nos logs.

**2. Ajustar `src/pages/operadora/OperatorPriceTable.tsx`:**
- Em `handleFileUpload`, enviar `storage_path: path` no body do `invoke` e remover o cálculo de `file_base64` (deixa o upload muito mais leve).
- Mensagem de erro mostra `data?.error || error.message` para o usuário ver a causa real quando a função retornar 4xx/5xx.

**3. Sem mudanças de schema, RLS ou bucket.**

## Detalhes técnicos

```text
Cliente:
  storage.upload(path, file)           → bucket operator-price-files
  functions.invoke('parse-price-table', { body: { table_id, storage_path: path, file_name, mime_type } })

Edge function:
  admin.storage.from('operator-price-files').download(storage_path) → Blob
  bytes = new Uint8Array(await blob.arrayBuffer())
  if (isPdf)   → AI multimodal com file_data base64 inline (igual hoje)
  else if (isSheet) → const XLSX = await import('npm:xlsx@0.18.5'); xlsxToCsv(bytes)
  else        → TextDecoder
```

Out of scope: trocar o modelo, mudar o prompt do parser, paginar PDFs grandes.