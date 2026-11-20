# Configuração da IA jurídica pelo SysADV

## Tela
**Configurações do escritório > Inteligência artificial jurídica — OpenAI**

Administrador com `settings.manage` pode habilitar/desabilitar a IA, escolher modelo, cadastrar/substituir/revogar chave e testar conectividade.

## Segurança
- Chave de API é recebida somente por HTTPS, criptografada com AES-256-GCM usando o módulo `secret-crypto.ts` já existente.
- A chave não é devolvida pela API, não é incluída em auditorias e não é exibida na tela.
- A criptografia usa `SOURCE_ENCRYPTION_KEY` quando configurada; o módulo legado oferece fallback para `REFRESH_TOKEN_SECRET`. Em produção, manter chaves criptográficas estáveis e preferir `SOURCE_ENCRYPTION_KEY` dedicada.
- Configurações são segregadas por `organizationId` derivado da sessão; `settings.read` visualiza o estado, `settings.manage` altera.
- A configuração do escritório passa a ter precedência sobre variáveis de ambiente. Para instalações sem registro, o comportamento anterior baseado em `LEGAL_AI_ENABLED` e `LEGAL_AI_API_KEY` é preservado.
- O teste de conexão usa consulta ao catálogo de modelos da OpenAI, sem enviar documentos ou dados de clientes.
- O próprio usuário continua precisando autorizar o compartilhamento antes de gerar um rascunho.

## Implementação e publicação
- Migrar `prisma/migrations/202611190011_legal_ai_settings` **apenas em ambiente QA antes de produção**.
- A base do Railway ainda precisa ser reconciliada com o esquema da aplicação. Não fazer deploy da API nova sem migrações controladas e backup verificado.
- Não fazer o merge/deploy deste PR automaticamente durante a recuperação do login.

## Gate de publicação — estado verificado em 19/11/2026

- GitHub Actions de código e banco QA: aprovado no PR #7; a verificação de compatibilidade adicional foi acrescentada depois desse resultado, portanto exige novo run.
- No Railway, o serviço `@sysadv/api` está executando o commit `f51d078...`, mantido por rollback devido a incompatibilidade do esquema do usuário.
- O PostgreSQL de produção é PostgreSQL 18 com volume persistente `postgres-volume`, que não foi alterado nesta entrega.
- `SOURCE_ENCRYPTION_KEY` já consta entre os nomes de variáveis da API Railway; nenhum valor secreto foi acessado.
- Não há fork/cópia de QA do banco Railway disponível neste projeto neste momento.

### Inspeção segura do banco real

O comando `node scripts/qa/production-schema-preflight.mjs` consulta apenas metadados de colunas e de `_prisma_migrations`. Ele não lê registros de clientes, não faz DDL/DML, não altera senha e termina com código 2 caso o banco não esteja compatível.

Para executá-lo sobre a base de produção é necessário um shell autorizado no serviço Railway ou uma conexão PostgreSQL com acesso de leitura ao esquema. **O assistente não dispõe atualmente de uma execução de comandos nessa base e não realizará migração sem backup restaurável**.

Só após backup validado, comparação de estrutura e aprovação da inspeção será permitido promover esta PR, aplicar migrações em janela controlada e validar o login com a API nova. O deploy poderá ser efetuado via integração da `main` ao Railway após passar esses gates.
