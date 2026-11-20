# SysADV — e-mail de notificacoes (opt-in)
- Provedor HTTP: Resend, usando Idempotency-Key para impedir envios duplicados.
- Habilitacao requer NOTIFICATION_EMAIL_ENABLED=true, RESEND_API_KEY e NOTIFICATION_FROM_EMAIL verificado.
- Os segredos ficam somente no ambiente do worker; nao incluir no repositorio.
- Cada usuario opta explicitamente na pagina Notificacoes, e pode revogar o aceite.
- O job consulta o aceite no banco novamente antes de enviar, inclusive em retries.
- As mensagens sao genericas: sem processo, dados de clientes ou detalhes juridicos.
- O worker nao executa automaticamente por padrao. Para habilitar: agendar `node apps/api/dist/workers/notification-email-worker.js` em um job confiavel apos homologacao.
- O worker usa claims transacionais com SKIP LOCKED, bloqueio de concorrencia, ate 5 tentativas e idempotencia remota.
- Sem provisionamento e verificacao do remetente, nao ha entrega externa.
- Nao tratar existencia de codigo como evidencia de e-mails enviados.


## Evolução de 20/11/2026 — Alertas de prazos aprovados

- `DEADLINE_ALERT_AUTOMATION_ENABLED=true` ativa um ciclo na API a cada 5 minutos, além de uma consulta inicial após o servidor iniciar. Desativado por padrão até configuração explícita do ambiente.
- O ciclo consulta somente alertas de prazos **aprovados**, não reconhecidos, com data programada até o dia corrente em São Paulo e até 30 dias de atraso. Não cria ou aprova prazos.
- Cria notificações internas para o criador e eventual revisor **ativos**. A chave única `(organizationId,recipientId,sourceType,sourceId)` impede duplicação entre execuções e réplicas.
- Se `NOTIFICATION_EMAIL_ENABLED=true`, o destinatário optou por e-mails e o provedor está configurado, o alerta entra na fila existente `NotificationEmailDelivery`. Um despacho periódico na API processa a fila usando `SKIP LOCKED`, até cinco tentativas e chave de idempotência no Resend.
- Antes do envio, o dispatcher cancela a mensagem se o prazo foi cancelado ou o alerta reconhecido. E-mails permanecem **genéricos**, sem dados de processo, clientes ou informações sigilosas.
- Marcar o alerta como lido na tela atualiza a notificação interna do próprio usuário e impede novas gerações. Outros usuários podem manter suas notificações já recebidas.
- Sem `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL` verificado, `NOTIFICATION_EMAIL_ENABLED=true` e aceite individual, **não há envio de e-mails externos**, apenas alertas internos. SMS e push não fazem parte desta entrega.
- O teste de QA usa somente banco `sysadv_qa` e não realiza envio de e-mail externo.
