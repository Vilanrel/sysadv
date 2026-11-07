# SysADV v0.9.2 — Integrações Judiciais (código para homologação)

**Base:** código-fonte SysADV v0.9.0 fornecido em 06/11/2026. Este pacote não incorpora automaticamente a extensão independente operacional v0.9.1 ou os 129 requisitos gerais.

## Implementado no código

- Catálogo de 15 fontes institucionais com capacidade, finalidade, condição de acesso e URL oficial; mapa documental de 26 Tribunais de Justiça estaduais e TJDFT.
- Conexões por organização, ambiente e finalidade, com aprovação interna expressa, hash do contrato, referência de autorização e auditoria. Nenhuma fonte é ativada automaticamente.
- **DJEN (condicional):** adaptador GET de comunicações com filtros e schema a confirmar no OpenAPI; fila separada da API, processamento paginado, limite de payload, controle de erro 429, checkpoint atômico, retries limitados, histórico imutável de revisões, deduplicação e quarentena do payload inválido.
- Publicações DJEN integradas com `OfficialPublication` e linha do tempo existente quando há NPU; pendências sem processo são mantidas. Leitura no SysADV é evento **interno**.
- **TJDFT:** pesquisa JurisDF com envelope REST documentado, biblioteca de resultados versionados sem gerar andamentos do processo.
- **STJ:** consulta a metadados do catálogo CKAN (package_search), sem baixar ZIP/arquivos automaticamente.
- **DataJud:** restrição de uso comercial aplicada; consulta manual isolada de outros fluxos somente após aprovação e configuração não comercial expressa. Consulta automática de cadastro de processos foi desligada; rotas antigas retornam bloqueio.
- Domicílio Judicial, MNI, datalake, OAB CNA, TPU, STF e demais órgãos constam no catálogo, mas **sem simulação de credenciais, ciência, petição ou acesso institucional**.
- Interface **Integrações Judiciais** em `/integrations` com configurações por escritório, jobs, triagem, jurisprudência e catálogo STJ.
- Adições isoladas ao schema Prisma; instalador Windows faz backup PostgreSQL antes de `prisma db push`, mantendo volumes.

## Não concluído / depende do órgão ou da operação

1. Credenciamento, termos e homologação real dos conectores não realizados nesta entrega.
2. DJEN: mapeamento dos filtros e do envelope da resposta deve ser verificado com Swagger integral vigente. Flag de bloqueio em `false` por padrão.
3. Domicílio Judicial: credenciais/escopos e efeitos de consulta, leitura e ciência dependem do CNPJ destinatário e versão atual. **Não existe execução de ciência**.
4. MNI: sem WSDL/convênio por tribunal, assinatura, anexos ou protocolo de petição. **Não existe peticionamento**.
5. OAB CNA: SOAP somente após chave/termos; sem chamadas.
6. Datalake CNJ: sem credenciamento GeCli; sem chamadas.
7. TPU: catálogo oficial está referenciado, porém o importador versionado ainda não foi implementado.
8. STJ: downloads ZIP, manifestos de arquivos e validação de expansão não implementados; apenas catálogo CKAN.
9. Prazos judiciais: nenhuma contagem ou vencimento é definitivo sem revisão profissional.
10. Outbox: eventos são persistidos para futuro processamento, mas o envio de alertas externos ainda não está implementado.
11. Auditoria jurídica, testes de carga e restauração real do banco e binários ainda precisam ser executados.

## Validação executada

- `node scripts/validate-judicial-offline.cjs`: **135 verificações passaram** (sintaxe TS/TSX de todos os arquivos do app, catálogo, restrições de uso, hosts HTTPS, redirecionamentos, 429/Retry-After, HTML 200 e limite de payload). Sem chamadas externas nem PostgreSQL.
- `apps/api/src/modules/judicial-integrations/judicial.test.ts`: testes Vitest adicionados para executar em ambiente com dependências instaladas. **Não foram executados neste ambiente**.
- `npm install`, `prisma validate/generate`, build completo, testes com PostgreSQL, Docker e homologação externa: **não realizados** por indisponibilidade de dependências/serviços no ambiente de preparação. **Não afirmar release homologada**.

## Instalação segura

1. Fazer backup da pasta, `.env`, PostgreSQL e arquivos antes da instalação.
2. Extrair a versão sobre a pasta do SysADV sem apagar volumes nem `.env` existente.
3. Conferir `JUDICIAL_DATAJUD_NONCOMMERCIAL_ENABLED=false` e `JUDICIAL_DJEN_CONTRACT_VALIDATED=false`; se ausentes, o comportamento padrão é bloqueio.
4. Executar `ATUALIZAR_SISTEMA.bat` no Windows com Docker operacional; ele faz build, gera backup e aplica alterações aditivas no schema via `prisma db push` e reaplica o seed.
5. Verificar `GET /api/system/version` = `0.9.2`, abrir **Integrações Judiciais**, criar conexões pendentes e registrar aprovação apenas após a verificação efetiva dos contratos e direitos de uso.
6. Em produção, confirmar a execução do serviço separado `sysadv-judicial-worker` e executar cenários H01–H18 com as evidências da documentação.

**Atenção:** nunca executar `docker compose down -v` se os dados nos volumes forem necessários. Não enviar senhas ou tokens nas configurações JSON do módulo; segredos continuam sob o módulo Fontes de Dados.
