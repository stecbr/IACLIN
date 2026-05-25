## Plano de correção

1. **Remover emojis do título principal**
   - Remover o emoji de cumprimento nos headers principais encontrados em:
     - Dashboard geral
     - Dashboard do dentista
     - Home do paciente
   - Manter o texto de boas-vindas sem alterar layout ou identidade visual.

2. **Corrigir o fluxo de parar/cancelar gravação**
   - Ajustar o `RecordingContext` para ter uma ação explícita de **cancelar gravação**, que pare o microfone, limpe a sessão e feche os diálogos sem enviar para transcrição.
   - Ajustar a ação de **finalizar/parar gravação** para não depender de estado antigo quando acionada pelo botão flutuante ou pelo botão da consulta.
   - Garantir que, após finalizar com sucesso ou erro, a gravação não continue marcada como ativa.

3. **Evitar gravação ativa ao sair da plataforma**
   - Ao fazer logout, encerrar/cancelar qualquer gravação em andamento antes de deslogar.
   - Atualizar os botões de sair usados no layout principal para respeitar esse fluxo.

4. **Melhorar o diálogo de confirmação**
   - Deixar claro que **Cancelar** apenas fecha a confirmação e continua gravando.
   - Se necessário, adicionar opção explícita para **descartar gravação** quando o usuário quiser parar sem processar.

5. **Validação**
   - Verificar no código que o MediaRecorder, stream do microfone, timers e estado global são limpos ao cancelar, finalizar ou sair.
   - Conferir que a barra flutuante desaparece quando a gravação é encerrada/cancelada.