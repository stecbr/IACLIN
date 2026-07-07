# 📝 Prompt para Copiar no Chat do Lovable

**Cole isso no chat do Lovable e execute:**

---

Crie um arquivo `.env` na raiz do projeto com esse conteúdo:

```env
VITE_API_BASE_URL=http://localhost:3333
VITE_API_TOKEN=test-token
```

Depois recarregue a página. A interface de Campanhas deve funcionar agora.

Se a interface de Campanhas ainda der tela branca, abra o DevTools (F12), vá na aba Console, e me mande o erro que aparecer.

---

**Ou em um prompt mais simples:**

Crie o arquivo `.env` com:
- `VITE_API_BASE_URL=http://localhost:3333`
- `VITE_API_TOKEN=test-token`

Recarregue a página. Testa campanhas.

---

Se o Lovable não deixar criar arquivo `.env`, tente:

Edite o arquivo `.env` que já existe e adicione essas duas linhas no final se não tiverem lá:
- `VITE_API_BASE_URL=http://localhost:3333`
- `VITE_API_TOKEN=test-token`

Recarregue e testa.

---

Se continuar com tela branca, abra DevTools (F12) > Console e copia o erro pra mim.
