## Objetivo

1. Na página da operadora (`/operadora/tabela-valores` → aba "Arquivos importados"): adicionar botão de **olho** ao lado do download para visualizar o PDF/arquivo dentro da plataforma, sem precisar baixar.
2. No painel da clínica (`/clinica/convenios` — "Convênios e Tabelas de Valores"): permitir que dentista/dono/secretária visualize (read-only) os PDFs originais da tabela da operadora credenciada — somente leitura, sem editar.

## 1. Visualizador inline de PDF/arquivo (componente reutilizável)

Novo componente `src/components/operadora/PriceFileViewerDialog.tsx`:
- Dialog (fade-only) full-width com header `nome do arquivo + tamanho + data` e ações (Baixar / Fechar).
- Body: `<iframe src={signedUrl} />` ocupando ~80vh.
- PDF → renderiza nativo no iframe. XLSX/CSV → mostra aviso "Pré-visualização não disponível para este formato" + botão Baixar (browsers não renderizam planilhas inline).
- Gera URL assinada via `supabase.storage.from('operator-price-files').createSignedUrl(path, 600)` ao abrir.

## 2. Botão olho na página da operadora

Em `OperatorPriceTable.tsx`, na lista `files.map(...)`:
- Adicionar `<button>` com ícone `Eye` (lucide) **antes** do botão Download.
- onClick abre `PriceFileViewerDialog` com o registro.

## 3. Acesso da clínica aos arquivos

### 3.1 Backend: RLS no Storage
Nova política SELECT em `storage.objects` (bucket `operator-price-files`) permitindo membros de clínica com credenciamento aprovado:

```sql
CREATE POLICY "Credentialed clinic members read price files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'operator-price-files'
  AND EXISTS (
    SELECT 1 FROM operator_credentialings oc
    JOIN clinic_members cm ON cm.clinic_id = oc.clinic_id
    WHERE cm.user_id = auth.uid()
      AND oc.status = 'approved'
      AND oc.operator_id::text = split_part(objects.name, '/', 2)
  )
);
```

### 3.2 Backend: RLS na tabela `operator_price_files`
Adicionar policy SELECT idêntica em escopo (clínica credenciada com a operadora dona da tabela). Hoje só operadora lê — clínica não enxerga as linhas.

### 3.3 Frontend
Em `src/pages/clinica/ClinicaConvenios.tsx` (já lista tabelas por operadora):
- Buscar `operator_price_files` da tabela selecionada (`table_id`).
- Renderizar seção "Arquivos da tabela (somente leitura)" abaixo do seletor de tabela: lista de arquivos com nome, tamanho, data, **botão olho** (abre `PriceFileViewerDialog`) e **botão download**. Sem upload, sem delete.

## Fora de escopo

- Editar arquivos pela clínica.
- Visualizador customizado de planilhas (XLSX/CSV) — só aviso + download.
- Notificações de novo arquivo enviado pela operadora.
