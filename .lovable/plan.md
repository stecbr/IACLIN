
# Assinatura Digital ICP-Brasil — Como funciona e como adicionar

## 1. Contexto rápido (o que é ICP-Brasil)

ICP-Brasil é a infraestrutura oficial de chaves públicas do governo. Para documentos médicos/odontológicos (atestado, receituário, encaminhamento, laudo), a assinatura precisa ser **PAdES** (PDF Assinado) usando um certificado **e-CPF A1, A3 ou em nuvem** do profissional. A receita digital de medicamentos controlados exige isso por força do CFM/CFO + Anvisa (RDC 471/2021).

Tipos de certificado relevantes:
- **A1**: arquivo `.pfx` no computador (validade 1 ano) — barato, mas o profissional tem que carregar o arquivo.
- **A3**: token/cartão físico (validade 3 anos) — exige hardware na máquina, **inviável em SaaS web puro**.
- **Nuvem (A1 nuvem / "Bird ID", "VidaaS", "Safeweb Cloud", "Soluti Birdid")**: o certificado fica em HSM da AC, profissional libera por app/biometria/PIN — **é o caminho correto para SaaS**.

## 2. Estratégia recomendada para o IaClin

Adotar **certificado em nuvem via provedor parceiro** (não tentar implementar HSM próprio — exige homologação ICP-Brasil, fora do MVP). Opções de mercado já com API REST:

| Provedor | Pontos fortes |
|---|---|
| **BirdID (Soluti)** | API REST madura, mais usado no setor saúde, app mobile p/ autorizar |
| **VIDaaS (Serpro)** | Oficial governo, integra com gov.br |
| **Safeweb Cloud** | Boa documentação, suporte BR |
| **Lacuna Signer / RestPKI** | Camada acima, abstrai vários provedores |

Sugestão: começar com **BirdID** (mais adotado por prontuários — Memed, iClinic usam) e, opcionalmente, adicionar VIDaaS depois.

## 3. Fluxo de assinatura (UX no app)

```
[Médico clica "Assinar e gerar PDF"]
        ↓
Edge Function monta PDF (já temos generateCertificatePdf, generatePrescriptionPdf, etc.)
        ↓
Edge Function envia hash do PDF + access_token do médico → API do provedor (BirdID)
        ↓
Médico recebe push no app BirdID → confirma com PIN/biometria
        ↓
Provedor devolve assinatura CMS/PAdES → Edge Function embute no PDF
        ↓
PDF assinado salvo em storage (clinic-documents) + registro em `documents`
```

Primeiro uso: médico faz **OAuth com o provedor** dentro do IaClin (uma vez) → recebemos `refresh_token` armazenado criptografado → reusado nas próximas assinaturas (TTL ~ algumas horas, renovação automática).

## 4. Mudanças técnicas no projeto

### Backend (Edge Functions novas)
- `icpbrasil-oauth-start` → gera URL de autorização do provedor.
- `icpbrasil-oauth-callback` → troca `code` por tokens, salva em `professional_signature_credentials`.
- `sign-clinical-document` → recebe `document_id` (ou HTML), gera PDF, calcula hash, chama API do provedor, embute assinatura PAdES, devolve URL assinada.
- Secrets necessários: `BIRDID_CLIENT_ID`, `BIRDID_CLIENT_SECRET`, `BIRDID_API_URL`.

### Banco (1 migration)
- `professional_signature_credentials` (user_id, provider, access_token_encrypted, refresh_token_encrypted, expires_at, certificate_subject, certificate_valid_until) — RLS: dono só vê o próprio.
- Em `documents`: adicionar `signature_status` (`unsigned|signed|failed`), `signature_provider`, `signed_at`, `signature_verification_url`, `signed_file_url`.

### Frontend
- **Configurações → Assinatura digital**: tela para conectar/desconectar ICP-Brasil, mostrar nome no certificado + validade.
- Em **CertificateGenerator**, **PrescriptionPad**, **ExamRequestPad**, **ReferralLetterPad**: substituir o botão único "Gerar PDF" por:
  - "Gerar PDF" (rascunho, marca-d'água "SEM VALIDADE LEGAL"),
  - "Assinar com ICP-Brasil" (só habilitado se certificado conectado e válido) → chama edge function, mostra modal "Aguardando confirmação no app BirdID…".
- Badge visual "Assinado digitalmente — ICP-Brasil" + link de verificação no Validador ITI ([validar.iti.gov.br](https://validar.iti.gov.br)).

### PDF
- O PDF já é gerado via `window.print()` no cliente. Para PAdES isso **precisa migrar para geração server-side** (a edge function precisa do binário do PDF para assinar). Usar `pdf-lib` (Deno-compatível) ou enviar HTML para um serviço headless. Recomendo refatorar `generate*Pdf.ts` para devolver HTML, e uma única edge function `render-pdf` converte HTML→PDF→assina.

## 5. Custos e compliance (avisar o usuário)

- Cada profissional precisa adquirir o próprio e-CNPJ/e-CPF em nuvem (~R$ 200–400/ano) numa AC credenciada — **a clínica/SaaS não emite certificado**.
- BirdID/VIDaaS cobram por assinatura ou por mensalidade na API (varia: R$ 0,30–1,00 por assinatura, ou pacotes).
- Para **receituário de controlados (B/A)** é obrigatório também usar a Receita Digital integrada ao SNGPC — escopo maior, fica para fase 2.
- Atestado, encaminhamento, receita simples e laudo: **PAdES ICP-Brasil já é suficiente** legalmente (CFM 2.299/2021, CFO 196/2019).

## 6. Plano de entrega sugerido (fases)

**Fase 1 (MVP da assinatura, ~1 sprint)**
- Migration + tela de conexão BirdID.
- Edge function `sign-clinical-document` só para **Atestado** (caso mais simples).
- Refatorar `generateCertificatePdf` para HTML→PDF server-side.
- Badge "Assinado digitalmente" + link de verificação.

**Fase 2 (~1 sprint)**
- Estender para Receituário, Encaminhamento e Solicitação de exame.
- Suporte a múltiplos provedores (VIDaaS).
- Verificador interno (mostrar dados do certificado dentro do app).

**Fase 3 (futuro)**
- Receita digital de controlados (integração Memed/SNGPC).
- Carimbo do tempo (LTV — Long Term Validation) para validade jurídica de longo prazo.

## 7. Decisões que preciso de você antes de implementar

1. Vamos começar com **BirdID** ou prefere outro provedor (VIDaaS, Safeweb)?
2. Aceita o modelo de **cada médico conectar o próprio certificado em nuvem** (recomendado) ou quer também suportar upload de `.pfx` A1?
3. Posso refatorar a geração de PDF de cliente para servidor (necessário para assinar)? Isso afeta atestado/receita/encaminhamento/exame.
4. Implementamos só Atestado na Fase 1 ou já os 4 documentos de uma vez?
