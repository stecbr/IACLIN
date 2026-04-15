

# Ajustes Completos do Marketplace

## 1. Botão "Acesse a plataforma"
**Arquivo:** `src/components/marketplace/MarketplaceHeader.tsx`
- Substituir os dois botões "Entrar" e "Cadastrar" por um único botão **"Acesse a plataforma"** que leva para `/auth`.

## 2. Migration SQL — RLS para usuários logados
**Problema:** `clinic_members` tem policy `authenticated` que filtra apenas clínicas do próprio usuário. `appointments` idem. Quando logado, o marketplace mostra apenas os profissionais da própria clínica.

**Solução:** Adicionar policies SELECT abertas para `authenticated`:

```sql
CREATE POLICY "Authenticated can view all clinic members"
ON public.clinic_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can view all appointments"
ON public.appointments FOR SELECT TO authenticated USING (true);
```

> As tabelas `profiles`, `clinics` e `procedures` já têm policies `authenticated USING (true)`. A tabela `insurance_plans` tem policy restritiva para `authenticated` mas isso só afeta a tela de booking (onde o usuário já estará logado e vinculado a uma clínica como paciente — ajuste futuro se necessário).

## 3. Mapa fullscreen não renderiza
**Arquivo:** `src/components/marketplace/MarketplaceMap.tsx`

**Causa:** Quando `expanded` muda, o JSX renderiza condicionalmente um layout diferente. O `ref` do container do mapa é atribuído a um novo `<div>`, mas o Leaflet já foi destruído pelo unmount do div anterior, e o `useLeafletMap` não re-executa porque `clinics` não mudou.

**Solução:** Reestruturar para que o `<div ref={mapContainerRef}>` esteja **sempre montado no DOM**. O layout muda apenas com CSS (classes para fullscreen overlay). Assim o Leaflet nunca é destruído ao ampliar/reduzir.

```text
Antes (quebra):
  if (expanded) return <FullscreenLayout><div ref={mapRef} /></FullscreenLayout>
  return <NormalLayout><div ref={mapRef} /></NormalLayout>

Depois (funciona):
  <div className={expanded ? "fixed inset-0 z-50 flex" : "relative"}>
    {expanded && <Sidebar com ScrollArea />}
    <div ref={mapRef} className="h-full w-full" />  ← sempre no DOM
    <Botões flutuantes />
  </div>
```

## Resumo de mudanças

| Arquivo | O que muda |
|---|---|
| `src/components/marketplace/MarketplaceHeader.tsx` | 2 botões → 1 "Acesse a plataforma" |
| `src/components/marketplace/MarketplaceMap.tsx` | Container do mapa sempre no DOM; CSS para fullscreen |
| Migration SQL | 2 policies SELECT `authenticated USING (true)` em `clinic_members` e `appointments` |

Nenhum outro arquivo precisa ser alterado.

