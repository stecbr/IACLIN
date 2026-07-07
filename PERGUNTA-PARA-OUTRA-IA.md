# ❓ Pergunta para a Outra IA/Sessão

## Contexto
A feature de Campanhas foi implementada no frontend (wizard de 5 passos, histórico, etc) mas está dando **tela branca** quando clica em "Campanhas" na Secretária IA.

Causa raiz identificada: **As variáveis de ambiente não estão configuradas no Lovable.**

## O Problema
O hook `useApi.ts` tenta ler:
```typescript
const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3333';
const token = import.meta.env.VITE_API_TOKEN || '';
```

Sem essas variáveis configuradas, as requisições à API quebram silenciosamente, deixando a interface em branco.

## A Pergunta

**Como você configura variáveis de ambiente (env vars) no Lovable?**

Específicamente:
1. Existe um arquivo `.env` ou `.env.local` que pode ser editado direto no Lovable?
2. Ou existe um painel de Settings/Environment/Configuration where you can set these?
3. Ou tem outra forma que você usa para passar VITE_API_BASE_URL e VITE_API_TOKEN pro Lovable?

**Preciso saber disso pra dar as instruções certas pra configurar a Campanha.**

---

## Contexto Técnico (pra você entender melhor)

- Backend da IA Atendimento tá rodando em `http://localhost:3333`
- Frontend Lovable precisa chamar a API do backend
- O arquivo `.env` no repo local tem:
  ```
  VITE_API_BASE_URL=http://localhost:3333
  VITE_API_TOKEN=test-token
  ```
- Mas no Lovable, essas variáveis não chegaram (ou não tão sendo lidas)

**Obrigado!**
