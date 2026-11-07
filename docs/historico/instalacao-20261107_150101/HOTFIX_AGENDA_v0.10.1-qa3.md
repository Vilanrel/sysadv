# SysADV v0.10.1-qa3 — correção do erro TS1117 na Agenda

## Diagnóstico

No build de 07/11/2026, `apps/web/src/features/agenda/AgendaPage.tsx`, linha 19, declarava a propriedade `DEADLINE` duas vezes no objeto `types`, gerando `TS1117: An object literal cannot have multiple properties with the same name`.

O primeiro `DEADLINE` representava o tipo de compromisso `DEADLINE` (`Prazo`) e o segundo tentava representar o registro jurídico homologado (`Prazo fatal aprovado`). Esses elementos são diferenciados pelo campo `kind`, não precisam compartilhar o mesmo rótulo.

## Modificações

1. Removida a declaração duplicada de `DEADLINE` no objeto `types`.
2. Para eventos (`kind: EVENT`, `type: DEADLINE`), mantém-se a descrição `Prazo`.
3. Para casos de prazos aprovados (`kind: DEADLINE`), exibe-se `Prazo fatal aprovado`.
4. Inclusos dois testes de regressão `scripts/tests/agenda-deadline-labels.test.mjs`.
5. **Somente no pacote completo**, a opção `--progress plain` do Docker Compose passou à posição global no `HOMOLOGAR_COMPLETO.ps1`, removendo apenas o aviso de sintaxe (não altera serviços).

## Aplicar o hotfix pequeno (sem banco)

1. Faça backup do diretório `C:\Temp\Sistemas\SysADV`.
2. Extraia **SysADV_v0.10.1-qa3_Hotfix_Agenda_TS1117.zip** em `C:\Temp\Sistemas\SysADV\hotfix_qa3`.
3. No PowerShell:

```powershell
cd C:\Temp\Sistemas\SysADV
.\hotfix_qa3\APLICAR_HOTFIX_AGENDA.bat
.\HOMOLOGAR_COMPLETO.bat
```

O aplicador copia `AgendaPage.tsx` e cria `AgendaPage.tsx.preqa3.bak` antes da troca. Não modifica `.env`, API, banco nem volumes.

Alternativamente, use o pacote **completo** `SysADV_v0.10.1-qa3_Completo_Agenda_Corrigida.zip`, extraindo-o em uma pasta de homologação depois de fazer backup.

## Testes e limitações

- Caso original: compilador TypeScript detectou 1 erro TS1117; no arquivo corrigido foram 0 erros TS1117.
- 2 testes de regressão da Agenda e 20 testes do motor de prazos passaram com Node 22 e `--experimental-strip-types`.
- A compilação completa Vite/API e os testes Docker/PostgreSQL **não foram certificados por esta correção**: precisam executar no Docker de homologação.
- Apenas a correção de build não autoriza uso em produção, especialmente para controle de prazos processuais.

Caso a compilação ainda falhe, envie as últimas linhas de `qa_evidencias/<execucao>/build.log`.
