# Relatório da correção SysADV v0.10.1-qa3 — Agenda TS1117

**Data:** 07/11/2026  
**Entrada:** log de homologação do Windows enviado pelo usuário.  
**Origem do projeto:** SysADV v0.10.1 Motor de Prazos Jurídicos / QA2, sem substituição da base de dados.

## Erro reproduzido

- `src/features/agenda/AgendaPage.tsx(19,141): error TS1117`
- Objeto `types` com duas propriedades `DEADLINE`.
- O compilador TypeScript 5.8.3, em análise sem dependências externas, reportou **1 TS1117 no arquivo original** e **0 TS1117 no arquivo corrigido**.

## Correção

- Mantida uma chave `DEADLINE: 'Prazo'` no mapa de tipos para compromissos.
- Para eventos com `kind: 'DEADLINE'`, usado o rótulo explícito `Prazo fatal aprovado` na exibição da Agenda.
- Foram criados 2 testes para impedir regressão de duplicidade e de rótulos.
- No pacote completo, parâmetro global `--progress plain` movido para antes do comando `build` na rotina QA, evitando apenas o aviso do Compose.

## Execução de testes

| Verificação | Resultado |
|---|---|
| Reproduzir erro TS1117 no arquivo anterior | 1 erro (confirmado) |
| Diagnóstico TS1117 no arquivo corrigido | 0 erros (confirmado) |
| Testes de regressão da Agenda | 2 aprovados |
| Testes unitários do motor de prazos | 20 aprovados |
| Total de testes Node executados | 22 aprovados, 0 falhas |
| Build completo Docker/API/Vite | **Não executado neste ambiente** |
| Integração PostgreSQL real | **Não executada** |
| Testes Playwright autenticados | **Não executados** |

Comando dos testes locais:

```bash
node --experimental-strip-types --test scripts/tests/agenda-deadline-labels.test.mjs scripts/tests/deadline-engine.test.mjs
```

A tentativa de instalação de dependências `npm install` não concluiu neste ambiente, que não tem pacote npm em cache; a execução foi interrompida. Por isso, não é possível declarar build completo bem-sucedido. O Windows do destinatário, com Docker Engine operacional, deverá executar novamente `HOMOLOGAR_COMPLETO.bat` e verificar `qa_evidencias/ULTIMO_RESULTADO.json`.

## Segurança de instalação

O hotfix pequeno substitui apenas `AgendaPage.tsx` e cria backup do arquivo original. Não exige execução de `prisma db push` e não remove volumes. O pacote completo **não deve ser colocado em produção com dados reais** sem aprovação do pipeline de homologação e revisão do esquema/migrações.
