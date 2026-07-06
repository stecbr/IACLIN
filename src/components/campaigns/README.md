# Campaigns Components

Componentes React para gerenciar campanhas de marketing via WhatsApp e SMS no IACLIN.

## 📁 Estrutura

```
campaigns/
├── CampaignsPage.tsx       # Página principal (container)
├── CampaignForm.tsx        # Formulário criar/editar
├── CampaignList.tsx        # Tabela de campanhas
├── CampaignsPage.css
├── CampaignForm.css
└── CampaignList.css
```

## 🚀 Como Usar

### 1. Importar no App.tsx

```typescript
import CampaignsPage from './components/campaigns/CampaignsPage';

export default function App() {
  const clinicId = 'seu-clinic-id'; // Pega de contexto ou props

  return (
    <div>
      <CampaignsPage clinicId={clinicId} />
    </div>
  );
}
```

### 2. Configurar .env.local

```env
VITE_API_BASE_URL=http://localhost:3333
VITE_API_TOKEN=seu-token-da-api
```

### 3. Garantir que useApi hook existe

O hook está em: `/src/hooks/useApi.ts`

Se o arquivo de hooks não existir, crie a pasta:

```bash
mkdir -p src/hooks
```

## 📦 Componentes

### CampaignsPage

Container principal que gerencia estado global de campanhas.

**Props:**
- `clinicId: string` - ID da clínica

**Features:**
- Carrega lista de campanhas ao montar
- Renderiza formulário ou lista
- Trata erros e loading

**Exemplo:**
```typescript
<CampaignsPage clinicId="clinic-123" />
```

### CampaignForm

Formulário para criar e editar campanhas.

**Props:**
- `clinicId: string` - ID da clínica
- `campaign?: Campaign` - Campanha para editar (optional)
- `onSuccess: () => void` - Callback após salvar

**Features:**
- Campos: nome, descrição, template
- Checkboxes: WhatsApp, SMS
- Filtros: tipo paciente, dias, procedimentos, plano
- Preview: quantidade de recipients
- Validação: nome e template obrigatórios

**Exemplo:**
```typescript
<CampaignForm
  clinicId="clinic-123"
  onSuccess={() => console.log('Salvo!')}
/>
```

### CampaignList

Tabela exibindo campanhas com ações.

**Props:**
- `campaigns: Campaign[]` - Array de campanhas
- `onDelete: (id: string) => void` - Handler deletar
- `onSend: (id: string) => void` - Handler enviar
- `onEdit: (campaign: Campaign) => void` - Handler editar

**Features:**
- Exibe nome, status, canais, recipients, enviados, falhas
- Badges coloridas para status
- Ações (edit/delete/send) para draft only
- Amostra de recipients no preview
- Responsive table

**Exemplo:**
```typescript
<CampaignList
  campaigns={campaigns}
  onDelete={handleDelete}
  onSend={handleSend}
  onEdit={handleEdit}
/>
```

## 🔌 Hook useApi

Hook TypeScript para comunicação com API.

**Uso:**
```typescript
const { request, loading, error } = useApi();

// GET
const data = await request('/api/campaigns');

// POST
const data = await request('/api/campaigns', {
  method: 'POST',
  body: JSON.stringify({ name: 'Test' }),
});

// PATCH
const data = await request('/api/campaigns/123', {
  method: 'PATCH',
  body: JSON.stringify({ name: 'Updated' }),
});

// DELETE
await request('/api/campaigns/123', { method: 'DELETE' });
```

**Returns:**
- `request: <T>(url, options) => Promise<ApiResponse<T>>` - Faz requisição
- `loading: boolean` - Flag se está carregando
- `error: string | null` - Mensagem de erro

## 📊 Tipos de Dados

### Campaign

```typescript
interface Campaign {
  id?: string;
  name: string;
  description?: string;
  template: string;
  channels: string[];
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';
  stats: {
    total_recipients: number;
    sent_whatsapp: number;
    sent_sms: number;
    failed_whatsapp: number;
    failed_sms: number;
  };
  created_at: string;
  filters: {
    patient_type: 'all' | 'returning' | 'new';
    last_visit_days?: number | null;
    procedures?: string[] | null;
    insurance_plan?: string | null;
  };
}
```

## 🎨 Styling

Componentes usam CSS vanilla com variáveis CSS:

- `--text-primary` - Cor de texto primária (default: #000)

Para customizar, sobrescreva em seu CSS global:

```css
:root {
  --text-primary: #1a1a1a;
}
```

Ou customize os arquivos CSS diretamente:

- `CampaignsPage.css` - Layout geral
- `CampaignForm.css` - Formulário
- `CampaignList.css` - Tabela

## 📡 API Backend

Backend precisa ter esses endpoints:

```
GET    /api/clinics/{clinicId}/campaigns
POST   /api/clinics/{clinicId}/campaigns
GET    /api/clinics/{clinicId}/campaigns/{id}
PATCH  /api/clinics/{clinicId}/campaigns/{id}
DELETE /api/clinics/{clinicId}/campaigns/{id}
POST   /api/clinics/{clinicId}/campaigns/{id}/preview
POST   /api/clinics/{clinicId}/campaigns/{id}/send
```

Todos usam header: `x-api-key: token`

## 🔧 Troubleshooting

**"API não conecta"**
- Cheque: `VITE_API_BASE_URL` correto?
- Backend rodando? `npm run dev` na raiz do IA-Atendimento

**"Preview não funciona"**
- Pacientes cadastrados na base?
- Filtros muito restritivos?

**"Estilos estranhos"**
- CSS files estão importados?
- Conflito com styles globais?

**TypeScript errors**
- Atualize imports se fez lint/prettier
- Cheque que `useApi.ts` está em `src/hooks/`

## 📝 Exemplo Completo

```typescript
// App.tsx
import { useState } from 'react';
import CampaignsPage from './components/campaigns/CampaignsPage';

export default function App() {
  const [clinicId] = useState('clinic-001');

  return (
    <div className="app">
      <nav>
        <h1>IACLIN Admin</h1>
      </nav>
      <main>
        <CampaignsPage clinicId={clinicId} />
      </main>
    </div>
  );
}
```

## 🚀 Deploy

Quando for fazer deploy no Lovable:

1. Garanta que `.env.local` está com valores corretos
2. Backend precisa estar acessível da URL configurada
3. Token de API precisa estar válido
4. Teste fluxo completo: criar → preview → enviar

## 📞 Suporte

Para dúvidas, cheque:
- Backend: `/Users/stec/Desktop/IA-Atendimento/README.md`
- API Docs: `CAMPANHAS-README.md`
- Exemplos: `CAMPANHAS-TESTE-API.sh`
