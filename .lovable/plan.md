## Substituir o texto "Iaclin" pela logo oficial na landing

Hoje o componente `Logo` em `src/pages/Landing.tsx` renderiza um quadradinho azul com "i" + wordmark "Iaclin." em texto. O resto do sistema (sidebar, AppLayout) já usa as imagens oficiais `src/assets/logo-light.png` e `src/assets/logo-dark.png`, trocando conforme o tema.

### Mudança

Em `src/pages/Landing.tsx`:

1. Importar as imagens:
   ```ts
   import logoLight from "@/assets/logo-light.png";
   import logoDark from "@/assets/logo-dark.png";
   import { useTheme } from "next-themes"; // mesmo hook usado no AppSidebar (via resolved)
   ```
   (Se a landing não tiver provider de tema resolvido, uso só `logoLight` — já que a landing é pública e atualmente clara. Confirmo lendo o hook real antes de aplicar.)

2. Reescrever o componente `Logo`:
   - Remover o quadrado com "i" e o `<span>Iaclin.</span>`.
   - Renderizar `<img src={logoLight} alt="Iaclin" className="h-8 object-contain" />` dentro do `<Link to="/">`.
   - Manter o mesmo `Link` e `className` recebido por prop para não quebrar layout (navbar e footer).

3. Verificar se `Logo` é usado em outros pontos do arquivo (ex: rodapé) — se sim, a mesma troca vale para todos, já que é o mesmo componente.

Nenhuma outra alteração: navbar, links, CTAs e demais seções permanecem iguais. Sem novas dependências, sem mudanças de schema, sem edge functions.

### Arquivos

- **Editar** `src/pages/Landing.tsx` (apenas o componente `Logo` + imports).
