# Cadastro de Clínica: Pessoa Física vs Jurídica + Kit Credenciamento

Vamos transformar o fluxo "Cadastrar minha clínica" em dois caminhos, espelhando o Kit Credenciamento das imagens (Servdonto). O profissional escolhe se vai se cadastrar como **Pessoa Física** (autônomo, usa CPF) ou **Pessoa Jurídica** (clínica/empresa, usa CNPJ), e os campos/documentos solicitados mudam conforme o tipo.

## 1. Escolha do tipo no início do cadastro

No diálogo "Cadastrar minha clínica" (`RegisterClinicDialog.tsx`), antes dos campos atuais, dois cards grandes:

- **Pessoa Física** — Profissional autônomo, consultório individual no seu próprio CPF.
- **Pessoa Jurídica** — Clínica/empresa formalizada com CNPJ.

A escolha controla quais blocos aparecem abaixo.

## 2. Campos por tipo

### Pessoa Física (novo fluxo)
Dados pessoais
- Nome completo *
- CPF *
- RG
- Data de nascimento
- Telefone *
- E-mail *

Dados profissionais (kit credenciamento PF)
- CRO/CRM do profissional * (já existe via specialty)
- Número INSS / NIS / PIS
- Inscrição Estadual e Municipal (opcional)
- Certificado de especialização (se houver)
- CNES do estabelecimento de saúde

Endereço do consultório (já existe)
- CEP, logradouro, número, complemento, bairro, cidade, UF

Dados bancários (PF)
- Banco, agência, conta, tipo (corrente/poupança), CPF do titular

Documentos / Anexos (upload)
- Foto da clínica (várias)
- Alvará de funcionamento
- Licença sanitária
- Comprovante CNES
- Certificado de especialização

### Pessoa Jurídica (fluxo atual + extras do kit PJ)
Dados da empresa (já existe + ajustes)
- CNPJ *, Razão Social *, Nome fantasia *, Telefone *, Categoria *
- Inscrição Estadual, Inscrição Municipal
- CNES da clínica

Responsável legal (já existe)
- Nome completo *, CPF *, RG, cargo

Endereço (já existe)

Dados bancários (PJ)
- Banco, agência, conta, CNPJ do titular

Documentos / Anexos (upload)
- Cartão CNPJ
- Contrato Social ou Requerimento Empresarial
- Alvará de funcionamento
- Licença sanitária
- CRO/CRM da clínica (responsável técnico)
- Fotos da clínica
- Certificado de especialização (se houver)

## 3. Backend — schema

Migration adicionando em `public.clinics`:

- `entity_type` text NOT NULL DEFAULT 'juridica' — 'fisica' | 'juridica'
- `cpf` text — usado no fluxo PF
- `rg` text
- `birth_date` date
- `inss_pis` text — PF
- `state_registration` text — IE
- `municipal_registration` text — IM
- `cnes` text — Cadastro Nacional de Estabelecimento de Saúde
- `specialty_certificate` text — número/identificação
- `bank_name` text, `bank_agency` text, `bank_account` text, `bank_account_type` text, `bank_holder_document` text

Tabela nova `public.clinic_documents` para anexos:
- `clinic_id` uuid → clinics(id)
- `doc_type` text (ex.: 'alvara', 'licenca_sanitaria', 'cartao_cnpj', 'contrato_social', 'foto_clinica', 'cnes', 'cro_clinica', 'especializacao')
- `file_path` text (caminho no bucket `clinic-documents`)
- `file_name` text
- `uploaded_by` uuid

RLS: leitura/escrita restritas a `is_clinic_admin(clinic_id)`; `service_role` total. GRANTs explícitos para `authenticated` e `service_role`.

Bucket novo `clinic-documents` (privado) com policies por `clinic_id` no path.

## 4. Edge function

Atualizar `create-own-clinic` para aceitar todos os novos campos (entity_type, cpf, rg, birth_date, inss_pis, IE/IM, CNES, dados bancários). Validar: PF exige CPF, PJ exige CNPJ.

## 5. Frontend

- `RegisterClinicDialog.tsx`: reestruturado com `entityType` state, dois cards iniciais, blocos condicionais, seção de upload de documentos (drag-drop por tipo).
- Após criar a clínica, fazer upload dos arquivos para `clinic-documents/{clinic_id}/{doc_type}/...` e inserir linhas em `clinic_documents`.
- `ClinicaCredentialings.tsx` / `MyCredentialingSection.tsx`: ao solicitar credenciamento mostrar progresso "Documentos do Kit Credenciamento" — checklist PF ou PJ baseado em `clinics.entity_type`, marcando o que já está anexado. Pendências bloqueiam envio à operadora.
- `OperatorSettings.tsx` (lado operadora): nada muda agora além de exibir `entity_type` da clínica e link para baixar documentos via URL assinada.

## 6. Fora de escopo

- Sem alteração no marketplace, agenda, financeiro ou onboarding inicial (o onboarding continua mínimo; o cadastro completo PF/PJ é o que o profissional faz pelo botão "Cadastrar minha clínica").
- Sem integração real com API da Receita / SERPRO para validar CPF/CNPJ (mantém só máscara + checksum cliente).

## Detalhes técnicos resumidos

```text
clinics
 ├─ entity_type ('fisica' | 'juridica')   ← novo
 ├─ cpf, rg, birth_date, inss_pis         ← PF
 ├─ state_registration, municipal_registration, cnes
 ├─ specialty_certificate
 └─ bank_* (5 colunas)

clinic_documents (nova)
 └─ clinic_id, doc_type, file_path, file_name, uploaded_by

storage bucket: clinic-documents (privado)
```

Posso seguir com a migration + ajustes em `RegisterClinicDialog`, `create-own-clinic` e a seção de credenciamento?
