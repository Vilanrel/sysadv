# SysADV v0.6.0 — Publicações, Fontes e Usuários

## Publicações e movimentações
- Novo menu **Publicações** com pesquisa por NPU, conteúdo, tribunal e tipo de ato.
- Persistência de movimentações DataJud em `ProcessMovement`.
- Linha do tempo unificada no processo, mantendo `MOVEMENT` e `PUBLICATION` como objetos distintos.
- Importação estruturada de publicações e correlação por data com movimentações.
- Conector de publicações configurável por fonte (`publicationSearchPath`, `searchMethod`, `itemsPath`, `fieldMapping`), sem simular acesso quando não configurado.

## Fontes de Dados
- Novo menu **Fontes de Dados** com CRUD de fontes, status, ambiente, URL, autenticação, timeout, retry/backoff, rate limits, sincronização, headers e configuração avançada.
- Segredos armazenados criptografados com AES-256-GCM e nunca retornados pelas APIs de leitura.
- Teste real de conexão com histórico de saúde, HTTP status e latência.
- DataJud pode usar a APIKey administrada na fonte; mantém fallback para `DATAJUD_API_KEY` do `.env`.

## Usuários
- Menu **Administração** substituído por **Usuários**.
- Alteração de dados, perfil e exigência de MFA.
- Ativação, inativação e bloqueio com motivo.
- Proteção do último administrador ativo.
- Redefinição de senha com revogação de sessões.
- Consulta e revogação de sessões e histórico de eventos de segurança.

## Atualização
Execute `ATUALIZAR_SISTEMA.bat`. A atualização usa `prisma db push`, reaplica o seed e valida `/api/system/version = 0.6.0` antes de concluir.
