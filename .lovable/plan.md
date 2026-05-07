# Unificar Ferramentas Clínicas — Implementação

## Escopo aprovado
- Página única `/ferramentas` com 4 seções: **Documentos**, **Cálculos**, **Produtividade**, **{Especialidade contextual}**, e **Odontologia** (só p/ família odonto).
- Ferramentas universais novas no MVP: **Solicitação de Exames**, **Encaminhamento**, **CID-10 Buscável**, **IMC + Sinais Vitais Rápidos**.
- Ferramentas exclusivas do dentista permanecem separadas dentro da mesma página (Anestésico, Atlas, Conversores Odonto).
- Ficam para v2: TUSS, TCLE com assinatura, TFG, Macros, NEWS/qSOFA, Genograma.

## Arquivos novos

1. `src/pages/ToolsHomeUnified.tsx` — página única, agrupa por seção, detecta família via `useSpecialtyProfile`, abre cada ferramenta em modal (fade-in/out).
2. `src/components/tools/ExamRequestPad.tsx` — formulário com modelos (hemograma, raio-X, ressonância, urina, etc.) → PDF + WhatsApp (reutiliza `clinicalDocsHelpers` e padrão do `PrescriptionPad`).
3. `src/components/tools/ReferralLetterPad.tsx` — carta de encaminhamento entre especialidades, gera PDF.
4. `src/components/tools/Cid10Search.tsx` — busca local com lista resumida de CIDs (top ~300), copia código+descrição.
5. `src/components/tools/VitalSignsQuick.tsx` — IMC, PA, FC, FR, SpO₂, Temp; salva em `clinical_records.vital_signs` se houver atendimento ativo, senão só calcula.
6. `src/lib/cid10Data.ts` — dataset estático com CIDs mais comuns.
7. `src/lib/generateExamRequestPdf.ts` e `src/lib/generateReferralPdf.ts` — geração via jsPDF (mesmo padrão do prescription).

## Arquivos editados

8. `src/App.tsx` — todas as rotas (`/ferramentas`, `/psi/ferramentas`, `/estetica/ferramentas`, `/medico/ferramentas`, `/nutricao/ferramentas`, `/fisio/ferramentas`, `/podologia/ferramentas`) apontam para `ToolsHomeUnified`.
9. `src/lib/specialtyFamily.ts` — `toolsRoute` = `/ferramentas` em todas as famílias.
10. `src/components/AppSidebar.tsx` — remover item "Ferramentas do Psicólogo" duplicado; manter só "Ferramentas Clínicas".
11. `src/components/MobileBottomNav.tsx` — usar sempre `/ferramentas`.

## Arquivos removidos
- `src/pages/dentist/ToolsHome.tsx`
- `src/pages/psi/PsiToolsHome.tsx`
- `src/pages/aesthetic/AestheticToolsHome.tsx`
- `src/pages/family/FamilyToolsHome.tsx`

## Layout da página

```text
Ferramentas Clínicas
[chips: Todas · Documentos · Cálculos · Produtividade · Especialidade]

📋 DOCUMENTOS
  Receituário · Atestado · Solicitação de Exames · Encaminhamento

🧮 CÁLCULOS
  IMC + Sinais Vitais · CID-10 Buscável

🎙 PRODUTIVIDADE
  Ditado por Voz · Timer · Próximo Retorno · Foto Clínica

⭐ {Família contextual}  (só aparece se aplicável)
  Estética: Toxina · Áreas Faciais
  Psi:      Escalas · Humor · SOAP · Timer Sessão · DSM-5
  Nutrição: IMC + Antropometria
  Médico:   IMC do paciente

🦷 ODONTOLOGIA  (só dentista)
  Anestésico · Atlas de Dentes · Conversores Odonto
```

## Sem mudanças em
- Banco de dados, RLS, Edge Functions.
- Página de Atendimento (`/atendimento`) — continua separada como pediu.
- Componentes individuais já existentes — reaproveitados sem alteração.
