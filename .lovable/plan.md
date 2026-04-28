## Diagnóstico

Investiguei o `src/lib/aiBackend.ts` e os logs de rede. O bug **não é** o que o prompt suspeita:

1. ✅ `connectWhatsApp` existe e usa `request()` corretamente (linhas 188-191).
2. ✅ Header `bypass-tunnel-reminder: true` **já está aplicado** em todas as chamadas (linha 168 do `request()`).
3. ❌ A `VITE_AI_BACKEND_URL` **não existe** no `.env` do projeto. Lovable não expõe painel para variáveis `VITE_*` do front — o `.env` é gerenciado automaticamente e contém só as chaves do Supabase. Por isso o código está caindo no fallback hardcoded.

**Causa raiz:** o fallback aponta para `https://baths-whale-hygiene-chapters.trycloudflare.com`, que é o túnel Cloudflare **antigo e morto**. Confirmado nos network logs: a chamada `GET .../appointments?source=ai&sync_status=pending` retorna `Failed to fetch`. Túneis `trycloudflare.com` gratuitos são efêmeros e expiram.

A URL nova (`beef-returning-publisher-plymouth.trycloudflare.com`) que você passou nunca foi gravada em lugar nenhum.

## Mudança

Trocar uma única linha em `src/lib/aiBackend.ts`:

```ts
// antes
const DEFAULT_AI_BACKEND_URL = 'https://baths-whale-hygiene-chapters.trycloudflare.com';

// depois
const DEFAULT_AI_BACKEND_URL = 'https://beef-returning-publisher-plymouth.trycloudflare.com';
```

Isso resolve imediatamente o "Failed to fetch" no botão Conectar WhatsApp e em todos os syncs da Secretária IA.

## Aviso importante (próxima ocorrência)

Túneis `trycloudflare.com` quebram com frequência (horas/dias). Toda vez que o backend reiniciar com URL nova, vou ter que repetir essa troca de fallback e republicar. Soluções permanentes para considerar depois:

- Salvar a URL numa tabela de config (ex: `clinic_settings.ai_backend_url`) e o front lê de lá → você atualiza pelo painel sem deploy.
- Mover as chamadas para uma edge function do Lovable Cloud, que guarda a URL como secret editável.
- Subir o backend num domínio estável (Cloudflare Tunnel autenticado, Fly.io, Render, Railway).

Posso plugar qualquer uma dessas depois — basta pedir.

## Arquivos

- `src/lib/aiBackend.ts` — trocar `DEFAULT_AI_BACKEND_URL`.
