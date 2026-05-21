## Substituir o mockup genérico do hero por um screenshot real do dashboard

Hoje o componente `DashboardMockup` em `src/pages/Landing.tsx` (linhas 116–197) desenha um mockup falso em SVG/HTML com KPIs fictícios ("Consultas hoje 24", gráfico inventado, lista "Ana/Carlos/Júlia"). Vamos trocar por uma imagem real do dashboard do Iaclin, mantendo a moldura macOS (traffic lights + URL bar) que já dá o tom premium.

### Passos

1. Salvar a imagem enviada (`user-uploads://image-101.png` — print real do dashboard com "Bom dia, Cassia", KPIs e gráfico) em `src/assets/landing-dashboard.png`.
2. Em `src/pages/Landing.tsx`:
   - Importar `landingDashboard from "@/assets/landing-dashboard.png"`.
   - Reescrever `DashboardMockup`: manter o wrapper com glow (`absolute -inset-6 ... blur-2xl`), o card arredondado com borda e a barra de título (3 bolinhas + "iaclin.app/dashboard"). Abaixo da barra, renderizar `<img src={landingDashboard} alt="Painel do Iaclin" className="w-full rounded-lg" loading="lazy" />` no lugar dos blocos de KPI/gráfico/lista falsos.
   - Remover o código morto dos KPIs, SVG do gráfico e lista de pacientes.
3. Sem mudanças em outros componentes, rotas, schema ou edge functions.

### Observação

Vou usar o screenshot real (image-101). Se preferir, posso depois gerar uma versão "limpa" via `browser--screenshot` da rota `/` logada para ter dados mais polidos — mas o print enviado já funciona bem como prova visual.

### Arquivos

- **Adicionar** `src/assets/landing-dashboard.png`
- **Editar** `src/pages/Landing.tsx` (apenas `DashboardMockup` + import)
