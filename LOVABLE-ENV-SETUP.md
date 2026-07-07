# 🔧 Como Configurar Variáveis de Ambiente no Lovable

## Problema
A interface de Campanhas está dando tela branca porque as variáveis de ambiente não estão configuradas.

## Solução

### Opção 1: Arquivo .env no Lovable (Recomendado)

1. **No Lovable, crie um arquivo** `.env` na raiz do projeto
2. **Coloque esse conteúdo:**

```env
VITE_API_BASE_URL=http://localhost:3333
VITE_API_TOKEN=test-token
```

3. **Salve o arquivo**
4. **Recarregue a página** no Lovable (Cmd+R)

### Opção 2: Configurar via UI do Lovable

Se o Lovable tiver um painel de settings:

1. **Clique em Settings/Configurações**
2. **Procure por "Environment", "Env Variables", ou ".env"**
3. **Adicione as variáveis acima**
4. **Recarregue a página**

### Opção 3: Editar vite.config.ts

Se nada acima funcionar, abra `vite.config.ts` e procure pela seção de env vars. Você pode ter que reconfigurar lá.

## O Que Cada Variável Faz

- **VITE_API_BASE_URL**: URL do backend onde a API de Campanhas está rodando
  - Desenvolvimento local: `http://localhost:3333`
  - Produção: seu domínio real

- **VITE_API_TOKEN**: Token de autenticação para a API
  - Desenvolvimento: `test-token`
  - Produção: token real da API

## Verificar Se Funcionou

1. Abra DevTools (F12)
2. Vá em **Console**
3. Digite: `console.log(import.meta.env.VITE_API_BASE_URL)`
4. Se aparecer `http://localhost:3333`, está OK!
5. Se aparecer `undefined`, as variáveis não foram carregadas

## Se Ainda Não Funcionar

Mande o erro exato que aparece no Console do DevTools (F12).

---

**Dica**: O `.env` arquivo já existe localmente. Lovable precisa sincronizar via git ou você configura manualmente lá.
