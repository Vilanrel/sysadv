# SysADV v0.8.0 - evolucao funcional

Base: SysADV v0.7.0. Desenvolvimento sem cadastro de avaliacao Projuris.

## Inclusoes
- Modelos juridicos: listagem, busca, edicao, historico de versoes, blocos genéricos e exclusivos, variaveis, previsualizacao, importacao DOCX, geracao PDF/DOCX vinculada ao processo.
- Dashboards: filtros temporais, distribuicoes, taxas de consulta, auditoria recente.
- Persistencia hibrida: PostgreSQL principal e cache efemero em arquivo para indicadores, mais volumes de documentos e PJe-Calc.
- Layout responsivo: biblioteca, dashboards, navegacao mobile.
- Porta web configuravel (padrao 9080) para coexistir com outros servicos locais.

## Limites
- O editor trabalha com texto plano; estilos ricos nao sao preservados no ciclo de importacao/exportacao.
- As APIs de fontes customizadas exigem configuracao e credenciais; conectores nao garantem disponibilidade de fontes externas.
- Nao inclui conta de avaliacao, screenshots autenticadas, IA generativa ou Office 365.
- Build integral, migração de banco e inicializacao Docker devem ser verificados no ambiente de instalacao.
