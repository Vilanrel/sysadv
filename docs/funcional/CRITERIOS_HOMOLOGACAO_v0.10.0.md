# SysADV v0.10.0 — Roteiro mínimo de homologação da gestão de escritório

Os procedimentos a seguir **não foram executados contra uma instância real**; destinam-se ao responsável técnico e à operação jurídica. Usar dados fictícios em homologação e nunca ativar integrações condicionadas sem credenciamento.

## Pré-condições

- Docker Desktop com mecanismo Linux em execução, Compose válido, `.env` preservado e segredos de produção configurados.
- Backup de PostgreSQL verificado e capacidade de restauração confirmada.
- Usuário administrador de homologação e pelo menos dois usuários com papéis distintos.
- Dois escritórios em um ambiente apropriado para testar segregação; não reutilizar credenciais e dados reais.

## H01 — Cadastro e atendimento

Cadastrar uma pessoa como cliente; criar atendimento com canal, descrição e data; alterar situação para aguardando cliente e depois converter vinculando ao processo. Verificar filtros, tela mobile e log de auditoria. Tentar converter sem processo: deve ser negado.

## H02 — Honorários

Criar contrato com modelo fixo e valor válido; alterar para vigente; criar contrato por hora e contrato de êxito com percentual. Tentar associar pessoa e processo de outro escritório: deve falhar. Confirmar que contrato **não gera cobrança automática** sem lançamento financeiro explícito.

## H03 — Financeiro

Criar receita e despesa, validar saldos e datas. Registrar baixa parcial e depois total. Tentar registrar baixa maior que saldo: rejeição; repetir mesmo `Idempotency-Key`: não duplicar; repetir a chave com outro valor: conflito. Tentar cancelar lançamento pago: rejeição. Conferir auditoria e exportação de CSV.

## H04 — Concorrência financeira

Executar duas solicitações de baixa simultâneas que somam acima do saldo, e alteração simultânea do valor. Deve ser impossível registrar saldo pago superior ao lançamento; conflitos transacionais devem retornar erro e exigir conferência humana antes da nova tentativa.

## H05 — Timesheet

Registrar horas de uma demanda, revisar e enviar para aprovação. Um usuário sem `timesheet.manage` deve ver apenas seus apontamentos. Gestor aprova/devolve. Apontamento aprovado não pode ser editado por seu autor. Cronômetro é auxiliar e não salva registros automaticamente.

## H06 — Relatórios e perfis

Conferir KPIs com os mesmos dados de origem; exportar CSV das seis categorias; garantir que um usuário sem autorização financeira não visualize valores nem obtenha relatório financeiro por URL direta. Nomes de células iniciando por caracteres de fórmula não devem ser executáveis ao abrir CSV em planilha.

## H07 — Configurações e auditoria

Alterar dados do escritório com administrador; outro perfil deve receber acesso somente leitura; verificar trilha e isolamento organizacional.

## H08 — UX responsiva

Testar 390, 768, 1024 e 1440 pixels **com o sistema autenticado**, em processos, tabelas financeiras, formulários, agenda, Kanban, documentos e menu; validar foco, navegação pelo teclado, scroll e edição. Os testes visuais automatizados não puderam ser executados no ambiente de geração.

## H09 — Integrações judiciais

Manter DataJud comercial bloqueado, credenciais em backend, DJEN dependente de contrato homologado, ciência e peticionamento não automáticos. Verificar comportamento para fonte indisponível, erro 403/429 e dados incompletos antes de ativar qualquer conector.

## Aceite final

Registrar evidências de build, geração Prisma, migração incremental, testes API, restauração de backup, screenshots reais de cada tela e aceite de advogado responsável. Não classificar a release como homologada sem essas evidências.
