# SysADV v0.8.1 — identidade DS e documentação funcional

Esta versão é uma evolução **incremental do código-fonte da v0.8.0 hotfix r1**.

### Mudanças efetivas
- Logo DS Advocacia Especializada otimizado em WebP para login e menu lateral.
- Login redesenhado com arte temática da Justiça, hierarquia visual moderna e formulário existente preservado.
- Marca d'água de balança da Justiça nas áreas internas, sem bloquear interação.
- Nova paleta azul-marinho / lavanda e responsividade adicional.
- Corrigida duplicidade da rota `/templates` no frontend.
- Atualizadas versões do frontend, da API e dos scripts de atualização/verificação.
- Incluída matriz de rastreabilidade e limitações da documentação pública Projuris ADV (`docs/funcional/PROJURIS_CATALOGO_ADERENCIA_v0.8.1.md`).
- Incluído teste de integração de marca, acessibilidade decorativa, rota e versão.

### O que NÃO está nesta entrega
- Não existe paridade funcional completa com o Projuris ADV.
- Não há implementação dos 283 tutoriais; trata-se de inventário de assuntos.
- Não foi feita migração de schema ou alteração da persistência existente.
- Recuperação de senha por e-mail depende de infraestrutura de envio não disponível nesta base; o login não anuncia esse fluxo.
- Build npm/Prisma e execução Docker exigem validação no ambiente Windows do solicitante, pois o registro npm não está acessível neste ambiente.

### Atualização
1. Faça backup do banco PostgreSQL e guarde o `.env` atual.
2. Descompacte a distribuição na pasta da instalação mantendo os caminhos relativos.
3. Execute `ATUALIZAR_SISTEMA.bat` na pasta principal.
4. Acesse a web pela porta configurada em `SYSADV_WEB_PORT` (`9080` se padrão).
5. Valide `/api/system/version` na porta 3001 e confira versão `0.8.1`.

**Nunca execute** `docker compose down -v` para atualizar.
