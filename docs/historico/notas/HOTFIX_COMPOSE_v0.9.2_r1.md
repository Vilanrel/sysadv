# SysADV v0.9.2-r1 — Correção de Docker Compose

Este hotfix corrige exclusivamente dois erros de duplicação de configuração observados no pacote v0.9.2:

1. Remove a segunda declaração do serviço `sysadv-judicial-worker` no `docker-compose.yml`, mantendo a primeira.
2. Remove o segundo argumento `sysadv-judicial-worker` no comando `docker compose build` do `ATUALIZAR_SISTEMA.bat`.

**Versão da aplicação mantida:** 0.9.2. Nenhum arquivo de banco, volume Docker, `.env`, credencial, código de regra de negócio ou esquema Prisma foi alterado neste hotfix.

## Atualização na pasta já instalada (Windows/PowerShell)

1. Faça uma cópia de segurança dos dois arquivos que serão substituídos (`docker-compose.yml` e `ATUALIZAR_SISTEMA.bat`).
2. Extraia o ZIP **SysADV_v0.9.2_r1_Hotfix_Compose.zip** na pasta `C:\Temp\Sistemas\SysADV`, substituindo apenas os dois arquivos.
3. Execute:

```powershell
cd C:\Temp\Sistemas\SysADV
docker compose config --quiet
.\ATUALIZAR_SISTEMA.bat
```

Se `docker compose config --quiet` não imprimir erros, o YAML foi aceito pelo Docker Compose. A atualização ainda depende de build, banco e testes do ambiente real. Não execute `docker compose down -v`.

## Verificações executadas nesta entrega

- YAML validado em modo estrito (chaves duplicadas detectadas).
- `services` inclui `sysadv-postgres`, `sysadv-api`, `sysadv-judicial-worker` e `sysadv-web`, cada um uma única vez.
- O comando `docker compose build` contém o worker somente uma vez.
- Integridade dos ZIPs conferida.

**Limitação:** Não houve execução de `docker compose config` nem build Docker neste ambiente, pois o Docker CLI não está instalado. O comando de validação acima deve ser executado na máquina de destino.
