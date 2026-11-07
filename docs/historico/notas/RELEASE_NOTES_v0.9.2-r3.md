# SysADV v0.9.2-r3 - Correcao do frontend judicial

Base: pacote integral v0.9.2-r2. Revisao incremental sem alteracao de versao semantica da API (`0.9.2`).

## Falha reportada

No build Docker do app Web, `tsc -b` emitia:

```
src/features/integrations/JudicialIntegrationsPage.tsx(41,342): error TS2339: Property 'tribunal' does not exist on type 'Connection'.
src/features/integrations/JudicialIntegrationsPage.tsx(44,454): error TS2339: Property 'tribunal' does not exist on type 'Connection'.
```

## Correcao aplicada

Arquivo: `apps/web/src/features/integrations/JudicialIntegrationsPage.tsx`.

O tipo `Connection` passou a declarar `tribunal: string | null`, conforme o campo `JudicialConnection.tribunal String?` do Prisma e a listagem `GET /api/integracoes/conexoes`. Nenhum endpoint, schema de banco, arquivo `.env` ou politica de uso das fontes foi alterado.

## Verificacoes realizadas aqui

- Conferencia estatica de frontend, retorno da rota e schema Prisma: OK.
- Parsing sintatico dos 132 arquivos TypeScript/JavaScript: 0 erros.
- Validacao YAML com deteccao de chaves repetidas: 4 servicos validos.
- Estrutura do ZIP verificada apos geracao.
- `npm install` nao concluiu dentro do limite deste ambiente. Portanto, `npm run build`, build Docker, testes automatizados e conexao real com PostgreSQL NAO foram validados nesta revisao. Nada foi implantado.

## Como testar sem tocar no banco

1. Faca uma copia de seguranca do projeto e de seu `.env`.
2. Extraia o pacote r3 sobre a pasta atual, substituindo apenas os arquivos da distribuicao (o pacote nao contem `.env`).
3. Execute `TESTAR_BUILD_SEM_INSTALAR.bat`. O script compila as imagens e nao executa `up`, `db push` nem `seed`.
4. Se o teste de build for aprovado, execute `ATUALIZAR_SISTEMA.bat`. O atualizador cria backup PostgreSQL antes de executar as alteracoes de schema.
5. Se qualquer etapa falhar, pare e salve o log completo para diagnostico. Nao exclua volumes.

**Nota:** `r3` e uma revisao de empacotamento/correcao. A API continua reportando `0.9.2`.
