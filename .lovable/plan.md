## 1. PDF abrindo "bloqueado" na aba Imagens
**Arquivo:** `src/components/patients/PatientDocuments.tsx`

Hoje, ao clicar no olho de um PDF, `openPreview` joga a URL assinada num overlay que renderiza apenas `<img src={preview}>`. PDF não carrega no `<img>` → o usuário vê só uma tela preta ("bloqueado").

Correção:
- Trocar o state `preview` por `{ url, type, name }` (mesmo padrão usado em `PatientFiles.tsx`).
- Se `image/*` → manter o lightbox atual.
- Se `application/pdf` → abrir Dialog com `<iframe src={url}>` (90vh, com botão "Abrir em nova aba" + download).
- Outros tipos (doc/docx) → cair direto no `downloadDoc` em vez de tentar pré-visualizar.

## 2. Timeline do paciente — ajustes visuais e de filtro
**Arquivo:** `src/components/patients/PatientTimeline.tsx`

### 2a. Ícone sobreposto ao título
A bolinha usa `-left-4.5` (classe Tailwind inexistente → não gera CSS), então o dot fica em cima do título "Resumo de Atendimento.pdf". Trocar por classe válida (ex.: `left-0` no dot + `pl-10` no row, removendo o `ml-4` do card) para alinhar ícone e texto sem colisão.

### 2b. Remover ruído de eventos
O usuário não quer ver na timeline:
- Documentos PDF gerados automaticamente (Resumo de Atendimento, Atestado, Receituário, Solicitação de Exames, Documentos Médicos) — hoje vêm da query `documents` com `category` iniciando em `doctor_file:` ou nomes terminando em `.pdf` desses tipos.
- Transações financeiras ("Receita financeira").

Mudanças na query:
- **Remover por completo** o bloco que insere `txRes` (financeiras) na timeline.
- **Remover por completo** o bloco que insere `docRes` (documentos). Manter apenas uploads reais do paciente? Pelo pedido ("não precisa aparecer isso"), remover todos os documentos da timeline.
- Manter apenas: `appointments` + `clinical_records` (consultas).

### 2c. Mostrar quem foi o médico
- Ampliar o `select` de `appointments` para incluir `doctor:profiles!appointments_doctor_id_fkey(full_name)` (ou o relacionamento já existente no projeto — confirmar nome do FK ao implementar).
- Ampliar o `select` de `clinical_records` para incluir `doctor:profiles!clinical_records_doctor_id_fkey(full_name)`.
- No item da timeline, exibir abaixo do título: `Dr(a). {full_name}` quando disponível, concatenado à descrição existente.

## Resumo do que o usuário vai ver
- Aba Imagens: clicar no olho de um PDF abre um visualizador real (iframe) em vez da tela preta.
- Timeline: somente consultas/atendimentos, sem PDFs nem lançamentos financeiros, com ícone alinhado e o nome do profissional responsável.
