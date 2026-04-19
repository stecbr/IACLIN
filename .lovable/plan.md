

## Diagnóstico: "Failed to fetch" ao gerar QR Code

### Causa raiz
O frontend está fazendo `fetch` para `https://gourmet-affairs-telecharger-nations.trycloudflare.com` (configurado em `src/lib/aiBackend.ts` linha 6). Esse endereço **não responde** — confirmado por teste direto: o túnel Cloudflare caiu (ou o servidor Node.js por trás dele não está rodando).

Quando o navegador não consegue sequer estabelecer conexão TCP/TLS, o `fetch()` lança `TypeError: Failed to fetch` antes mesmo de receber um status HTTP — exatamente o que aparece no toast e no session replay ("Backend offline" no card de status confirma o mesmo).

### Por que isso acontece
Túneis `trycloudflare.com` gratuitos são **efêmeros**: caem quando o processo `cloudflared` no seu PC para, quando a máquina dorme, ou quando troca de rede. O túnel anterior (`turtle-employee-switching-bid…`) já tinha caído antes — agora o `gourmet-affairs…` também caiu.

O código do frontend está correto. O QR Code só é gerado quando o backend Node.js + Evolution API responder.

### O que fazer (você, fora do Lovable)

1. **Verificar o backend Node.js local**
   - Confirmar que o processo do servidor (porta 3333) está rodando
   - Confirmar que a Evolution API está rodando e acessível pelo backend
   - Confirmar que o `cloudflared tunnel` está ativo e apontando pra porta certa

2. **Pegar a nova URL do túnel**
   - Quando reiniciar o `cloudflared`, ele imprime uma URL nova tipo `https://xxxx-yyyy-zzzz.trycloudflare.com`
   - Me mande essa URL que eu atualizo o `src/lib/aiBackend.ts` (igual fizemos das outras vezes)

### Solução definitiva (recomendado)
Túneis aleatórios vão continuar caindo. Opções pra estabilizar:

- **Cloudflare Tunnel nomeado** (gratuito, URL fixa tipo `ai.seudominio.com`) — requer domínio na Cloudflare
- **Deploy do backend Node.js** num provedor (Railway, Render, Fly.io) — URL permanente
- **Variável de ambiente `VITE_AI_BACKEND_URL`** no Lovable em vez de hardcode — assim você troca sem precisar de novo deploy do frontend

### Próximo passo sugerido
Me responde uma das opções:
1. "Subi o backend de novo, a nova URL é `https://...`" → eu troco no código
2. "Quero migrar pra URL fixa via variável de ambiente" → eu refatoro pra ler de `VITE_AI_BACKEND_URL` e te explico como configurar
3. "Quero fazer deploy do backend Node.js em produção" → eu te guio na escolha do provedor

