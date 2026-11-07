# SysADV v0.10.0 — Gestão operacional de escritório

Base: SysADV 0.9.2-r5, sem remover tabelas existentes.

## Entregues no código

- **Atendimentos**: cadastro, edição, classificação, próxima interação e relacionamento com pessoa/processo.
- **Contratos de honorários**: tipos fixo, por hora e êxito; ciclo de vida, cliente e processo; receitas são lançadas explicitamente no financeiro.
- **Financeiro**: receitas/despesas, categorias, vencimentos, saldos, baixa parcial e total com chave de idempotência, cancelamento apenas sem baixa, conferência de limite e auditoria.
- **Timesheet**: horas associadas à demanda/processo, envio para aprovação, aprovação/devolução por perfil com permissão e cronômetro auxiliar na interface.
- **Relatórios**: indicadores reais e CSV de processos, pessoas, atendimentos, finanças, atividades e horas com controle de acesso e proteção contra CSV injection. Exportação limitada a 5.000 linhas por tipo; não é um gerador de DRE/DFC.
- **Configurações**: nome, e-mail, telefone, fuso e valor/hora padrão por escritório; permissões diferenciadas.
- **Administração**: central de navegação para controle de acessos, auditoria e fontes.
- **Dashboard**: indicadores resumidos para usuários autorizados.
- **Segurança**: autorização no backend, verificação dos vínculos entre escritórios, trilhas de auditoria e grants de novos escopos para usuários ADMIN existentes via seed.

## Não implementado ou não homologado

- Os 283 artigos anexos são apenas títulos de catálogo, não 283 especificações funcionais; esta versão não deve ser tratada como implementação integral dos artigos.
- Boleto/NFS-e, conciliação bancária, pagamentos reais, repasses complexos, rateio, DRE/DFC contábil, assinatura, app nativo, CRM avançado, motores de workflow, IA jurídica e integrações proprietárias necessitam projetos e/ou credenciamentos próprios.
- Prazos judiciais não são calculados automaticamente por esta entrega.
- Não foi realizada homologação autenticada em Docker/PostgreSQL nem verificação de endpoints de terceiros.

## Como atualizar

1. Backup do diretório e da configuração `.env`.
2. Extraia o ZIP completo sobre o código, sem excluir diretórios de dados nem arquivos já existentes.
3. `VALIDAR_AMBIENTE.bat` confirma Docker; não altera dados.
4. `TESTAR_BUILD_SEM_INSTALAR.bat` compila imagens antes de alterar o banco.
5. `ATUALIZAR_SISTEMA.bat` valida Compose, gera backup PostgreSQL custom-format (`.dump`), aplica o schema aditivo via Prisma e novas permissões por seed, e recria os serviços.
6. Homologue os módulos antes de uso em produção, incluindo exportações, permissão, idempotência de baixa e restauração de backup.

**Aviso:** `ATUALIZAR_INTERFACE.bat` foi bloqueado nesta versão. O frontend depende de novas tabelas e rotas; não basta instalar a interface.

## Homologação

A release não foi compilada integralmente em Docker neste ambiente. Execute `VALIDAR_AMBIENTE.bat`, `TESTAR_BUILD_SEM_INSTALAR.bat` e depois `ATUALIZAR_SISTEMA.bat`, com backup e testes reais. Critérios em `docs/funcional/CRITERIOS_HOMOLOGACAO_v0.10.0.md`.
