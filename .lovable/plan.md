## Objetivo

Ajustar **apenas** a lógica do campo de registro profissional para alternar entre **CRO** (odonto) e **CRM** (médico/demais) conforme a especialidade selecionada — sem mexer em layout, cores ou outras áreas.

## Como detectar o tipo

Já existe `category` em `SPECIALTIES` (`src/components/patient/booking/SpecialtyStep.tsx`):
- `category === 'odonto'` → **CRO**
- qualquer outra (`medico`, `estetica`, `veterinario`, `outro`) → **CRM**

Criarei 2 helpers em `src/components/SpecialtySelect.tsx` (já é o lugar canônico de utilidades de especialidade):

```ts
export function registrationLabelForSpecialty(specialtyId?: string | null): 'CRO' | 'CRM' {
  const s = SPECIALTIES.find(x => x.id === specialtyId);
  return s?.category === 'odonto' ? 'CRO' : 'CRM';
}
export function registrationPlaceholderForSpecialty(specialtyId?: string | null): string {
  return `Digite seu ${registrationLabelForSpecialty(specialtyId)}`;
}
```

## Pontos a ajustar (somente o campo de registro)

1. **`src/pages/Auth.tsx`** (cadastro do profissional, linha ~659)
   - Trocar `<Label>` fixo e `placeholder` do input `registration` para usarem os helpers, baseados em `selectedSpecialty`.
   - Na submissão (linhas ~214/255/284): se a especialidade for odonto e o registro estiver explicitamente marcado/colado como "CRM ..." (ou vice-versa), bloquear com mensagem amigável. Validação leve via prefixo: se o usuário digitar `CRM` num cadastro odonto (ou `CRO` num médico), exibir toast de erro e impedir o submit. O valor salvo no banco continua sendo só o número (campo `registration_number`); o tipo é inferido pela especialidade.

2. **`src/pages/Profile.tsx`** (perfil do profissional, linha ~139)
   - Mesmo tratamento: label e placeholder dinâmicos a partir de `specialty` selecionado. Aplicar a mesma validação leve no save (linha ~73) usando os helpers.

3. **`src/components/clinica/AddMedicoDialog.tsx`** (admin adicionando médico, linha ~134)
   - Label e placeholder dinâmicos com base no `form.specialty`. Mesma validação leve antes de chamar o invite (linha ~62).

4. **Exibições "CRO/CRM" hardcoded** (apenas troca de string para coerência, sem mudar layout):
   - `src/lib/generateCertificatePdf.ts` (linha 108) e `src/lib/generatePrescriptionPdf.ts` (linha 114): substituir o literal `CRO/CRM` por `registrationLabelForSpecialty(dentist.specialty)` para que o PDF mostre apenas o termo correto.
   - `src/pages/clinica/ClinicaMedicos.tsx` (linha 178): manter o número como está; opcionalmente prefixar com o label correto da especialidade do membro (`CRO 12345` / `CRM 12345`).

## O que NÃO será alterado

- Layout, cores, espaçamentos, ícones e estrutura geral das telas.
- Tela da Clínica (apenas o input do diálogo de adicionar médico).
- Schema do banco (mantém `registration_number`; o tipo é derivado da especialidade).
- Fluxos de autenticação, agenda, financeiro, etc.

## Critérios de aceite

- Selecionar "Clínico Geral" / "Cardiologia" / "Pediatria" → label **CRM**, placeholder "Digite seu CRM".
- Selecionar "Dentista" / "Limpeza Dental" / "Cirurgia Bucomaxilofacial" → label **CRO**, placeholder "Digite seu CRO".
- Tentar salvar dentista com valor começando por "CRM" (ou médico com "CRO") → toast de erro e submit bloqueado.
- O label correto aparece no perfil após o cadastro e nos PDFs gerados.
