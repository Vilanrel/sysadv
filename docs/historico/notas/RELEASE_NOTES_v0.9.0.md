# SysADV v0.9.0 — Operação Jurídica / primeira etapa da Especificação Funcional v1.0

**Data:** 06/11/2026. **Status:** implementação incremental para HOMOLOGAÇÃO, não certificada para produção até conclusão do build completo e validação com PostgreSQL real/Docker.

## Funcionalidades efetivamente acrescentadas nesta etapa

1. **Pessoas e Clientes** — busca, filtros, cadastro de pessoas físicas/jurídicas, validação de CPF/CNPJ, perfis de relacionamento, dados de contato, inativação preservando histórico e vínculos a processos, com isolamento organizacional e trilha de auditoria.
2. **Tarefas** — cadastro e atribuição, prioridades, vencimentos, estados, checklist obrigatório para conclusão, pesquisa e filtros, criação contextual de tarefa de triagem a partir de publicação oficial, com idempotência e auditoria.
3. **Kanban** — quadro padrão com quatro etapas, criação de quadros/colunas, movimentação visual via arrastar ou seleção acessível, registro de mudanças. Quadros exibem até 100 tarefas por coluna neste ciclo.
4. **Agenda jurídica** — registros de audiências e compromissos, visões dia/semana/mês, união de eventos/tarefas com vencimento e feriados cadastrados, filtros de intervalo e cancelamento preservando registros.
5. **Dashboard** — números reais de pessoas, tarefas abertas/vencidas/a vencer e audiências, respeitando permissões. Cache em arquivos com invalidação por organização após mutações e proteção contra concorrência. PostgreSQL continua sendo a fonte de verdade.
6. **Permissões e segurança** — permissões por perfil para Pessoas, Tarefas, Agenda, gestão de Kanban e feriados; segregação por escritório e trilha de auditoria para mutações.
7. **Operação Windows** — o atualizador agora compila imagens antes de alterar o banco, cria backup lógico PostgreSQL via pg_dump e preserva os volumes; versão da API verificada como 0.9.0. Porta web configurável (padrão 9080).

## Limites e regras de homologação

- **Prazos processuais não são calculados automaticamente.** Os feriados cadastrados são informativos, sem aplicar regras processuais específicas por tribunal, suspensão ou legislação. Confira sempre os prazos com fonte oficial.
- Não há integração homologada com calendário externo, PJe-Calc executável, IA generativa, NFS-e, boletos ou serviços bancários nesta entrega.
- Os 129 requisitos da Especificação Funcional v1.0 **não foram integralmente implementados**. As demais frentes (financeiro avançado, workflows, portal cliente, etc.) permanecem no backlog.
- O pacote inclui código-fonte; a sintaxe TS/TSX e os testes Node são verificáveis neste ambiente, mas o build completo do Vite/Fastify, `prisma db push` e a execução Docker exigem homologação na máquina do usuário.
- `prisma db push` não usa `--accept-data-loss`; se exigir operação destrutiva, interrompa e avalie migração formal antes de prosseguir.
- O atualizador grava backups em `backups/SysADV_AAAAMMDD_HHMMSS.dump` e **não** sobrescreve o arquivo `.env` existente.

## Instalação e verificação (Windows)

1. Faça uma cópia do `.env` e dos arquivos existentes. Extraia o conteúdo do ZIP sobre a instalação do SysADV, sem substituir `.env`.
2. Na pasta do projeto, execute `ATUALIZAR_SISTEMA.bat` com Docker Desktop operacional.
3. Verifique `docker compose ps` e `VERIFICAR_VERSAO.bat`; a API deve informar `0.9.0`.
4. Faça testes de cadastro pessoa/processo, tarefa/checklist, movimentação Kanban e agenda com dados fictícios antes de liberar usuários reais.

## Referência funcional

- `SysADV_Especificacao_Funcional_v1.0.docx` (requisitos entregues pelo solicitante).
- `SysADV_Matriz_Rastreabilidade_Funcional_v1.0.xlsx` (rastreabilidade funcional anexa à especificação).
- `docs/superpowers/plans/2026-11-06-sysadv-v0.9.0-exec.md` (escopo do ciclo).

**Rastreabilidade detalhada do ciclo:** `docs/funcional/IMPLEMENTACAO_v0.9.0.md`.
