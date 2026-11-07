# SysADV v0.7.0 — PJe-Calc Integration

## Destaques
- Workspace trabalhista com 16 áreas de parâmetros e versionamento profissional.
- Estados detalhados do ciclo do cálculo: rascunho, revisão, validação, pacote, fila, processamento e resultado.
- Importação segura de arquivos `.PJC` como artefatos opacos, com SHA-256 e histórico.
- Pacote de preparação SysADV em JSON para o agente/local workflow; ele **não é apresentado como arquivo `.PJC` compatível**.
- Contrato de Agente PJe-Calc local: registro, heartbeat, fila, resultado e falha.
- Comparação de versões e rastreabilidade dos parâmetros.
- Volume Docker dedicado `sysadv_pjecalc`.
- Tela de login com símbolo vetorial da Justiça em marca d'água decorativa, responsiva e não interativa.

## Compatibilidade PJe-Calc
O PJe-Calc Cidadão é tratado como aplicação externa. O SysADV não presume API remota pública. Arquivos `.PJC` gerados/exportados pelo próprio PJe-Calc podem ser incorporados ao histórico do cálculo. A automação integral depende do Agente Local e de uma rotina de automação compatível com a instalação do PJe-Calc do ambiente.

## Atualização
Execute `ATUALIZAR_SISTEMA.bat`. O banco é sincronizado pelo fluxo Prisma existente e os volumes persistentes não devem ser removidos.
