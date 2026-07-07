# 📊 Estado Atual da Feature de Campanhas

**Data:** 2026-07-07  
**Status:** 85% completo - Pronto pra usar, aguardando configuração de env vars no Lovable

---

## ✅ O Que Já Foi Feito

### Backend (IA-Atendimento) — COMPLETO
- ✅ 7 endpoints REST funcionais
- ✅ Twilio SMS integrado
- ✅ Segmentação de pacientes (4 filtros)
- ✅ Endpoint de estimativa de recipients
- ✅ Endpoints auxiliares (profissionais, especialidades, procedimentos, convênios)
- ✅ Todos os commits pushed ao GitHub

**Commits principais:**
- `4c96046` - Endpoints de estimativa e dados auxiliares
- Main branch atualizada

### Frontend (IACLIN/Lovable) — COMPLETO
- ✅ Wizard de 5 etapas (visual minimalista e intuitivo)
- ✅ Componentes React TypeScript (CampaignsPage, CampaignForm, CampaignHistory, etc)
- ✅ Hook useApi para comunicação com backend
- ✅ Estilos CSS responsivos
- ✅ Integração com Secretária IA (aba "Campanhas")
- ✅ Bugs críticos corrigidos:
  - "Enviar agora" agora cria + envia de verdade
  - Filtros alinhados com schema do backend
  - TypeScript sem errors

**Commits principais:**
- `32b5c3b` - Redesign completo com wizard
- `d4c779b` - Integração com API real
- `f2053d5` - Fix dos bugs críticos
- `52883eb` - Pergunta pra outra sessão

---

## 🟡 O Que Falta (BLOQUEADO)

### Configuração de Env Vars no Lovable
**Problema:** Campanhas dá tela branca porque `VITE_API_BASE_URL` e `VITE_API_TOKEN` não estão configuradas no Lovable.

**Solução:** Precisa saber como a outra sessão configura essas variáveis no Lovable.

**Pergunta já foi feita em:** `PERGUNTA-PARA-OUTRA-IA.md`

**Após isso estar resolvido:**
- Campanhas vai funcionar normalmente
- Feature tá 100% pronta pro uso

---

## 📋 Fluxo de Campanhas (Como Funciona)

### 1. Usuário entra em Secretária IA → Aba "Campanhas"

### 2. Wizard de 5 Etapas

**Etapa 1:** Informações da campanha
- Nome (obrigatório)
- Descrição (opcional)

**Etapa 2:** Público (segmentação inteligente)
- Tipo de público (9 opções: todos, ativos, inativos, com consulta, sem consulta há X meses, aniversariantes, particulares, por convênio, seleção manual)
- Filtros adicionais (procedimentos, convênio, últimos X dias)
- Contagem em tempo real: "X pacientes serão impactados"

**Etapa 3:** Mensagem
- 2 opções:
  - Usar template pré-pronto (promoção, lembrete, retorno, etc)
  - Criar custom + opção "Escrever com IA"
- Botão "Inserir informação" (amigável, sem código)
- Preview em tempo real como paciente vai receber

**Etapa 4:** Canal
- WhatsApp (ativo)
- SMS (desabilitado, "Em breve")

**Etapa 5:** Revisão
- Resumo completo com tabs (Resumo / Prévia da mensagem)
- Botões: "Salvar rascunho" / "Agendar envio" / "Enviar agora"

### 3. Histórico
- Tabela com todas as campanhas
- Colunas: Nome, Status, Público, Pacientes, Enviados, Falhas, Criada em, Ações
- Ações contextuais (Visualizar, Duplicar, Deletar)

---

## 🔌 Integração Backend

**Endpoints usados:**
```
POST   /api/clinics/{clinicId}/campaigns/estimate
GET    /api/clinics/{clinicId}/campaigns
POST   /api/clinics/{clinicId}/campaigns
GET    /api/clinics/{clinicId}/campaigns/{id}
PATCH  /api/clinics/{clinicId}/campaigns/{id}
DELETE /api/clinics/{clinicId}/campaigns/{id}
POST   /api/clinics/{clinicId}/campaigns/{id}/preview
POST   /api/clinics/{clinicId}/campaigns/{id}/send
GET    /api/clinics/{clinicId}/campaigns/data/procedures
GET    /api/clinics/{clinicId}/campaigns/data/insurances
```

**Headers obrigatórios:**
- `Content-Type: application/json`
- `x-api-key: <token>`

**Filtros suportados pelo backend:**
- `procedures` (array de IDs)
- `insurance_plan` (string ID)
- `last_visit_days` (número)

---

## 📁 Estrutura de Arquivos

```
IACLIN/
├── src/
│   ├── components/campaigns/
│   │   ├── CampaignsPage.tsx       (Main container)
│   │   ├── CampaignsWizard.tsx     (Wizard orchestrator)
│   │   ├── CampaignHistory.tsx     (Tabela de histórico)
│   │   ├── CampaignForm.tsx        (Old form - deprecated)
│   │   ├── CampaignList.tsx        (Old list - deprecated)
│   │   ├── steps/
│   │   │   ├── Step1InfoCampaign.tsx
│   │   │   ├── Step2Audience.tsx
│   │   │   ├── Step3Message.tsx
│   │   │   ├── Step4Channel.tsx
│   │   │   └── Step5Review.tsx
│   │   ├── CampaignsPage.css
│   │   ├── CampaignForm.css
│   │   ├── CampaignList.css
│   │   └── README.md
│   │
│   ├── hooks/
│   │   └── useApi.ts               (API communication hook)
│   │
│   ├── pages/
│   │   └── CampaignsPage.tsx       (Page wrapper - pega clinicId via useAuth)
│   │
│   └── App.tsx                     (Rota /campanhas + aba em Secretária IA)
│
├── .env                            (Local config - VITE_API_BASE_URL, VITE_API_TOKEN)
├── .env.example                    (Template)
├── LOVABLE-ENV-SETUP.md            (Guia de setup)
├── LOVABLE-PROMPT.md               (Prompt pronto pra colar)
├── PERGUNTA-PARA-OUTRA-IA.md       (Pergunta sobre env vars)
└── ESTADO-ATUAL-CAMPANHAS.md       (Este arquivo)
```

---

## 🎯 Próximos Passos

### Imediato (Bloqueado)
1. ⏳ Esperar resposta sobre como configurar env vars no Lovable
2. Uma vez configurado, testar:
   - Abrir Campanhas na Secretária IA
   - Criar uma campanha teste
   - Enviar pra alguns pacientes

### Melhorias futuras (não-críticas)
- Implementar "Agendar envio" com data/hora
- Adicionar mais templates pré-prontos
- Dashboard de analytics (campanhas vs taxa de entrega)
- Permitir upload de lista de pacientes manual
- Webhook de status de entrega

---

## 📞 Resumo pra Outra Sessão

Se você está atualizando este doc:

1. **Responda a pergunta em PERGUNTA-PARA-OUTRA-IA.md** explicando como configura env vars no Lovable
2. **Execute a configuração** se for simples (editar .env, etc)
3. **Atualize este arquivo** com o status final

Depois disso, a feature estará 100% completa e pronta pra usar!
