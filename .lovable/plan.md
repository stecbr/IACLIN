## Problema

A logo está sendo enviada corretamente para o storage, mas a imagem **não atualiza visualmente** mesmo após várias trocas. Causa: o caminho do arquivo é sempre `{clinic.id}/logo.{ext}` (com `upsert: true`), então a URL pública retornada é **idêntica** entre uploads. Como o navegador cacheia a imagem por essa URL, ele continua exibindo a versão antiga.

## Solução

Forçar invalidação de cache adicionando um parâmetro de versão (`?v=timestamp`) à URL salva no banco a cada upload, e garantindo refresh em todos os locais que consomem a logo.

## Mudanças

**`src/pages/SettingsPage.tsx` — `handleLogoUpload`**
- Após `getPublicUrl`, anexar `?v=${Date.now()}` na URL antes de salvar em `clinics.logo_url`.
- Após o update, invalidar também `['clinic-branding']` (hoje só invalida `['clinic-settings']`), para que sidebar/header atualizem na hora.

**`src/components/AppSidebar.tsx` e `src/components/AppLayout.tsx`**
- Sem mudanças de lógica; já leem de `useClinicBranding`. Vão receber a nova URL via invalidação acima.

**Opcional (robustez)**
- Em `useClinicBranding`, adicionar `key={logoUrl}` no consumo do `<img>` se houver problema de re-render — mas com a URL versionada isso não deve ser necessário.

## Resultado

Cada upload de logo gera uma URL única (mesmo arquivo físico, query string nova), o navegador busca a imagem nova, e sidebar/header mobile/configurações refletem a alteração imediatamente — sem precisar recarregar a página nem limpar cache.

Fora do escopo: PDFs, página pública e marketplace (lerão a URL versionada naturalmente na próxima query).