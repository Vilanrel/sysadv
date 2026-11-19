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
