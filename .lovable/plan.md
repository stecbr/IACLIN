## Diagnóstico

O problema não é falta de dados: existem clínicas, membros e horários ativos no banco. A quebra está no fluxo de leitura do paciente.

Causa principal encontrada:
- A tela de agendamento do paciente (`/paciente/agendar`) busca profissionais diretamente em `clinic_members`.
- Essa tabela hoje só permite leitura para membros da própria clínica ou para o próprio usuário.
- Como o paciente não pertence às clínicas, a consulta retorna vazia para ele.
- Resultado: o app não consegue montar a lista de clínicas/profissionais disponíveis, mesmo havendo agenda ativa.

Também há um segundo ponto que pode reduzir resultados:
- A tela cruza especialidade com `clinic_members.specialty` e `professional_specialties`.
- Se parte dos profissionais tiver especialidade configurada em um lugar e a agenda em outro, a tela pode esconder profissionais que antes apareciam.

## Plano de correção

1. Ajustar a regra de leitura pública/controlada de profissionais
   - Permitir que pacientes autenticados consigam enxergar apenas os dados mínimos necessários de profissionais vinculados a clínicas para agendamento.
   - Não expor permissões de edição/criação/exclusão.
   - Manter dados sensíveis protegidos.

2. Corrigir a busca de profissionais no agendamento
   - Fazer o fluxo considerar profissionais com agenda ativa mesmo quando a especialidade vier de `professional_specialties` ou de `clinic_members.specialty`.
   - Preservar filtros atuais: especialidade, cidade, convênio e data.
   - Evitar que uma falha em uma consulta secundária zere toda a lista.

3. Corrigir a listagem do Marketplace se estiver sofrendo do mesmo bloqueio
   - A página `/marketplace` também depende de `clinic_members`; ela deve conseguir exibir a rede pública como antes.
   - Ajustar para usar os mesmos critérios seguros de visibilidade.

4. Validar o fluxo completo
   - Conferir se paciente acessa `/paciente/agendar` sem loop.
   - Conferir se aparecem clínicas e médicos com horários ativos.
   - Conferir se selecionar horário e enviar pedido continua usando o fluxo existente de solicitação de agendamento.

## Detalhes técnicos

- Será necessária uma migration de política de acesso no Lovable Cloud para leitura segura de `clinic_members` no contexto de marketplace/agendamento.
- Não vou alterar o modelo de agendamento nem criar novo fluxo; a meta é restaurar o comportamento anterior.
- Não vou liberar dados clínicos, financeiros ou prontuários para pacientes externos.