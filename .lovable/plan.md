

# Diagnóstico — Secretária IA · Etapa 1 (Conexão WhatsApp)

Análise estática feita em `src/pages/SecretariaIA.tsx` e `src/lib/aiBackend.ts`. **Nada será alterado** — apenas respostas objetivas + correções recomendadas.

## Respostas ponto a ponto

**1. Função executada no clique de "Escanear QR Code"**
`onClick={() => connectMutation.mutate()}` (linha 383). Dispara a mutation `connectMutation` definida na linha 230.

**2. Método do `aiBackend` chamado**
`aiBackend.connectWhatsApp(currentClinicId!)` (linha 231).

**3. Endpoint exato chamado**
`POST {BASE_URL}/api/clinics/${clinicId}/whatsapp/connect`
(definido em `src/lib/aiBackend.ts`, função `connectWhatsApp`).

**4. Base URL final usada nessa tela**
`https://pens-vegetation-project-amd.trycloudflare.com` — confirmado pelos network logs (`GET …/whatsapp/status`).

**5. Hardcoded, env ou fallback?**
Tem **fallback hardcoded**. Em `aiBackend.ts`:
```ts
const DEFAULT_AI_BACKEND_URL = 'https://pens-vegetation-project-amd.trycloudflare.com';
const RAW_URL = (import.meta.env.VITE_AI_BACKEND_URL ?? '').trim() || DEFAULT_AI_BACKEND_URL;
```
Se `VITE_AI_BACKEND_URL` não estiver definida, cai no túnel Cloudflare antigo.

**6. Existe URL antiga de túnel ainda em uso só na Secretária IA?**
Sim. O `DEFAULT_AI_BACKEND_URL` (`pens-vegetation-project-amd.trycloudflare.com`) é um túnel `trycloudflare.com` — esses túneis são efêmeros e **muito provavelmente estão expirados**, o que casa exatamente com os `Failed to fetch` em loop nos logs. Esse fallback só é referenciado em `aiBackend.ts`, que só é importado pela Secretária IA (`SecretariaIA.tsx` e `LiveMessagesPanel.tsx` indiretamente).

**7. A tela trata `connected:true, qr_code:null` como sucesso ou erro?**
Trata como **sucesso parcial bugado**. O `onSuccess` faz `setQrCode(data.qr_code)` (= `null`) e abre o modal mesmo assim — não há checagem de `data.connected`.

**8. Comportamento atual quando `connected:true, qr_code:null`**
- Abre o modal de QR Code **vazio** (qr=null → imagem quebrada/em branco).
- Inicia polling a cada 5s no `getWhatsAppStatus`.
- No primeiro tick, como `s.connected === true`, o polling para, fecha o modal e mostra toast `WhatsApp conectado!`.
- Resultado prático: **flash do modal vazio → fecha sozinho → conectado**. Não trava, mas é UX ruim.

**9. Quando o "Failed to fetch" ocorre**
**Antes da resposta chegar** — é erro de rede (TLS/DNS do túnel `trycloudflare.com` indisponível). O navegador nem completa o request (sem status, sem corpo). Confirmado pelos logs: todos os GET `/whatsapp/status` aparecem com `Error: Failed to fetch`, sem código HTTP.

**10. `currentClinicId` está definido no clique?**
Sim. Vem de `useAuth()` e é `70c7cf93-42fa-4a0e-980a-d75b89c31c68` (visível na URL do request). O botão também tem `disabled={!currentClinicId}`.

**11. `isAiBackendConfigured()` retorna true?**
Sim. Como há fallback hardcoded, `BASE_URL` nunca é `null` → retorna `true`. Por isso `backendConfigured` é `true` e a `statusQuery` roda em loop a cada 15s mesmo com o túnel morto.

**12. Fetch direto, `aiBackend` ou wrapper própria?**
Usa **`aiBackend`** (wrapper em `src/lib/aiBackend.ts`), que internamente usa `fetch`. Nenhum `fetch` cru na página.

**13. Existe trecho que assume que sempre haverá `qr_code` quando `connect` é chamado?**
Sim.

**14. Onde está esse trecho**
`connectMutation.onSuccess` (linhas 232-249):
```ts
onSuccess: (data) => {
  setQrCode(data.qr_code);   // assume string, mas pode ser null
  setQrModalOpen(true);      // abre modal mesmo se já conectado
  ...
}
```
Não há `if (data.connected) { … } else { … }`. Também o tipo `WhatsAppConnectResponse` em `aiBackend.ts` declara `qr_code: string` (não admite `null`), o que mascara o caso real do backend.

**15. O que precisa mudar (sem aplicar agora)**

A. **`src/lib/aiBackend.ts`**
- Atualizar tipo:
  ```ts
  interface WhatsAppConnectResponse {
    qr_code: string | null;
    connected?: boolean;
    status?: string;
    instance_name?: string | null;
  }
  ```
- Remover/atualizar o `DEFAULT_AI_BACKEND_URL` — o túnel Cloudflare está caído. Deixar `BASE_URL = null` quando `VITE_AI_BACKEND_URL` não estiver definido (faz `isAiBackendConfigured()` voltar a funcionar como guarda real) **ou** apontar para a URL nova/estável do backend.

B. **`src/pages/SecretariaIA.tsx` — `connectMutation.onSuccess` (linhas 232-249)**
- Tratar 3 casos:
  1. `data.connected === true` → `qc.invalidateQueries(['ai-whatsapp-status', clinicId])`, **não** abrir modal, toast `WhatsApp já conectado` e (opcionalmente) avançar `setStep(2)`.
  2. `data.qr_code` presente → comportamento atual (abrir modal + polling).
  3. nenhum dos dois → `toast.error('Resposta inesperada do backend')`.

C. **Polling de status (linhas 208-214)**
- Considerar `retry: 0` e desligar `refetchInterval` quando `statusQuery.isError` por N tentativas, para parar o loop infinito de `Failed to fetch` que está poluindo os logs do navegador.

D. Apontar `VITE_AI_BACKEND_URL` no `.env` para a URL ativa do backend Node — o problema raiz não é UI, é o fallback estar batendo num túnel Cloudflare expirado.

**Resumo**: a tela não está quebrada por lógica de UI — está apontando para uma base URL morta (túnel `trycloudflare.com` antigo via fallback hardcoded), e além disso assume `qr_code` sempre presente, o que vai dar UX ruim (modal vazio piscando) assim que o backend voltar e responder `connected:true, qr_code:null`.

