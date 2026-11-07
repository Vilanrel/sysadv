# SysADV - Gestao de escritorio de advocacia

**Release vigente: 2026110701** (mascara `AAAAMMDDNN`, `NN` comeca em `01` em cada dia).

Base consolidada: SysADV v0.10.1-qa6, reportada como operacional no Windows do usuario.
Esta entrega unifica correcoes da interface, CRM juridico, processos, agenda, prazos, financeiro, contratos, timesheet, documentos, permissoes e integracoes configuraveis.

## Ambientes Docker

- Projeto **principal**: `sysadv`, declaracao explicita em `docker-compose.yml`. Inclui PostgreSQL, API, worker judicial e Web. Sao quatro servicos de um mesmo sistema, nao um unico container.
- Projeto **QA descartavel** a remover: `sysadvqa1107135812`.
- Nunca use `docker system prune --volumes` ou `docker compose down -v` no projeto principal.

## Remocao segura do QA legado

Abra PowerShell em `C:\Temp\Sistemas\SysADV` e execute:

```powershell
.\REMOVER_AMBIENTE_QA.ps1          # pre-visualizacao sem alteracoes
.\REMOVER_AMBIENTE_QA.bat          # remove so containers e redes de sysadvqa1107135812
.\VERIFICAR_VERSAO.bat
```

A limpeza usa **labels exatas** de projeto Docker Compose, nao altera `sysadv`, `.env`, PostgreSQL ou volumes. Os volumes QA tambem sao preservados por padrao; a exclusao desses dados de teste requer a opcao explicita `-ExcluirVolumesQA`.

## Higienizar arquivos antigos da pasta atual

Use `.\HIGIENIZAR_ARQUIVOS_LOCAIS.ps1` para listar, e `.\HIGIENIZAR_ARQUIVOS_LOCAIS.bat` para **mover** arquivos de instalacao legados para `docs/historico/instalacao-...`, sem exclusao e sem mexer no codigo ativo, no .env ou nos volumes.

## Publicar apenas esta release no sistema que ja funciona

1. Faca copia de seguranca da pasta, preserve `.env`, `backups/`, `qa_evidencias/` e os volumes Docker.
2. Extraia o pacote **mesclando** arquivos na pasta `C:\Temp\Sistemas\SysADV`.
3. Rode `.\TESTAR_BUILD_SEM_INSTALAR.bat`.
4. Rode `.\PUBLICAR_VERSAO.bat` apenas se o build estiver aprovado.
5. Confira `.\VERIFICAR_VERSAO.bat`; API `/api/system/version` deve responder `2026110701`.

**PUBLICAR_VERSAO.bat nao executa `prisma db push`, seed ou migracoes**. Recria so API, worker e Web do projeto sysadv, com o mesmo PostgreSQL/volumes.

`ATUALIZAR_SISTEMA.bat` foi preservado para evolucoes futuras de schema, mas nao deve ser usado para simples troca do identificador de release.

## Geracao de novas versoes

```powershell
.\GERAR_NOVA_VERSAO.ps1 -Simular  # consultar proximo numero
.\GERAR_NOVA_VERSAO.bat          # grava proxima versao
```

A primeira gerada em 07/11/2026 e `2026110701`. A segunda sera `2026110702`; no dia seguinte, `2026110801`. O gerador sincroniza frontend, API, indice HTML, testes e `config/release.json`/`config/release-history.json`. O arquivo local `config/release-history.local.json` registra sequencias geradas e deve ser preservado quando voce extrair um ZIP novo.

A propriedade `version` interna do `package.json` permanece no padrao SemVer do npm; `sysadvRelease` e a identificacao publica e oficial do produto.

## Homologacao e cuidados

- Testes de prazo e checagens estruturais podem ser executados com Node.js 22 e sem PostgreSQL.
- `HOMOLOGAR_COMPLETO.bat` pode iniciar **novo** projeto QA temporario e o remove automaticamente no final, exceto se configurado para preservar. Use somente quando se deseja executar a homologacao isolada.
- Integracoes judiciais dependem de contratos, autorizacoes e testes com as fontes oficiais. O calculo de prazos requer aprovacao juridica, evidencias de publicacao e calendario local validado.
- Esta release nao promove automaticamente homologacao de producao.

Consulte `docs/prazos/REGRAS_E_LIMITES.md`, `docs/funcional/` e `docs/historico/` para limites e rastreabilidade.
