# Sincronizar configuração da IA com o backend externo

## Contexto confirmado

Na tela **Treinamento da IA** (`src/pages/SecretariaIA.tsx`), a mutation `saveConfig` já faz upsert em `ai_secretary_config` no Supabase com:
- `custom_prompt` (text) — string final do prompt (variável `builtPrompt`)
- `enabled` (boolean) — corresponde ao toggle "IA Ativa" / "IA Pausada"

São exatamente os campos que o backend externo espera. Vamos reaproveitar 1:1.

## Mudanças

### 1. `src/lib/aiBackend.ts`
Adicionar um método tipado dedicado seguindo o padrão dos demais (sem expor `request` genérico):

```ts
updateAiConfig: (clinicId: string, payload: { custom_prompt: string; enabled: boolean }) =>
  request<{ ok: boolean }>(`/api/data/ai_secretary_config/config-${clinicId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
```

### 2. `src/pages/SecretariaIA.tsx`
No `onSuccess` da mutation `saveConfig` (linha ~311), adicionar a chamada **fire-and-forget** logo depois da atualização de estado local, usando os mesmos valores que acabaram de ir pro Supabase (`vars.custom_prompt`, `vars.enabled`):

```ts
onSuccess: (_data, vars) => {
  // ... lógica existente (toast, setSavedPrompt, setPrompt) ...

  // Sincroniza com backend externo da Secretária IA — não bloqueia UI
  if (currentClinicId && isAiBackendConfigured()) {
    aiBackend
      .updateAiConfig(currentClinicId, {
        custom_prompt: vars.custom_prompt,
        enabled: vars.enabled,
      })
      .catch(() => {});
  }
},
```

## Garantias

- **Não bloqueia UI**: chamada assíncrona, erro silenciado com `.catch(() => {})`.
- **Não mostra erro ao usuário**: nenhum toast adicional.
- **Sem inventar campos**: usa exatamente `custom_prompt` e `enabled`, idênticos ao schema do Supabase e ao state da tela.
- **Guarda de configuração**: só dispara se o backend IA estiver configurado (`isAiBackendConfigured()`), evitando exceção quando `VITE_AI_BACKEND_URL` não está setada.
- **Sem alterar fluxo do Supabase**: a persistência principal continua sendo o upsert atual; o PATCH é apenas espelhamento.

## Arquivos editados
- `src/lib/aiBackend.ts` (novo método `updateAiConfig`)
- `src/pages/SecretariaIA.tsx` (chamada fire-and-forget no `onSuccess`)
