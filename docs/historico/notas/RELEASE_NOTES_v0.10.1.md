# SysADV v0.10.1 — Motor parametrizavel de prazos juridicos + homologacao qa2

> **Candidato a homologacao — NAO apto para prazos reais ou producao sem validacao juridica, testes integrados e migracao revisada.**

## Pacote

- Backend: `apps/api/src/modules/deadlines/` (regra versionada, calculo, presets, API autenticada e auditada).
- Frontend: `apps/web/src/features/deadlines/DeadlinesPage.tsx`, menu `Gerenciador de prazos` e estilo responsivo.
- Persistencia: modelos `DeadlineRule`, `CourtCalendarCoverage`, `CourtSuspension`, `DeadlineCase`, `DeadlineAlert` no Prisma. SQL de referencia em `sql/` **nao executar diretamente no ambiente real**.
- QA: `HOMOLOGAR_COMPLETO.ps1` com compatibilidade ao stderr Docker do PowerShell 5.1. Testes de API de prazos adicionados e cobertura Playwright de 23 rotas.
- Testes unitarios offline: `npm run test:deadlines` (20 casos).

## Fluxo de operacao

1. Acessar **Gerenciador de prazos** e selecionar ramo, instituto e natureza.
2. Informar a **data juridicamente relevante** e a evidencia documental do ato/intimacao. Escolher tribunal, UF, municipio e se os autos sao fisicos ou eletronicos.
3. Opcionalmente, justificar a prerrogativa aplicavel de prazo em dobro; autos eletronicos bloqueiam a hipotese do art. 229 CPC por procuradores distintos.
4. Calcular **previa**, nunca automaticamente conclusiva; conferir calendario, expediente local e suspensoes.
5. Salvar como **rascunho**. Responsavel distinto valida o calendario local com base em fonte oficial e aprova o prazo, criando alertas **apenas internos** D-5, D-3, D-1 e prazo interno.
6. Prazo aprovado aparece na Agenda e permanece auditavel; cancelamento nao apaga o historico.

## Regras legais especialmente sensiveis

- Regra do CPC para prazos processuais em dias uteis (arts. 219-220); CPP em dias corridos, observadas prorrogacoes de vencimento; CLT com recesso e dias uteis; processo administrativo conforme norma aplicavel.
- Para recuperacao judicial, lei especial e STJ exigem avaliar os 180 dias do stay e os 10 dias da impugnacao de credito em **dias corridos** (nao usar automatico dias uteis).
- Defesa trabalhista e prazo de perito dependente de ordem judicial sao eventos com data e hora concretas, nunca 5 dias de forma universal.
- Recurso CRPS depende do regulamento atualizado e da forma de ciencia; a documentacao inclui cautelas.
- A Lei 8.213/91 art. 41-A par. 5o trata do primeiro pagamento e nao deve ser usada isoladamente como prazo generico para decisao do INSS.

## Verificacoes realizadas neste ambiente

- **20 testes unitarios do motor**, aprovados via `npm run test:deadlines` com Node 22.16.0.
- Sintaxe TS/TSX dos arquivos novos checada com TypeScript `transpileModule`.
- Arquivo SQL revisado como DDL de referencia.
- Integridade ZIP via Python `ZipFile.testzip()`.

**Nao foram executados:** build real da API/Vite, `prisma validate`, banco PostgreSQL real, e2e Playwright e deploy Windows. O script QA foi corrigido mas depende do Docker Desktop do destinatario.

## Comandos na maquina de homologacao

Faça backup e extraia em diretório de **homologacao**, sem sobrescrever base de producao. Com Docker Desktop Linux Engine ativo:

```powershell
cd C:\Temp\Sistemas\SysADV
.\HOMOLOGAR_COMPLETO.bat
```

`qa_evidencias/ULTIMO_RESULTADO.json` deve conter `status: passed` para todos os estagios. Se houver erro de build verdadeiro, abrir `qa_evidencias/<execucao>/build.log` e enviar o trecho final. **Nao rodar `IMPLANTAR_APOS_HOMOLOGACAO.bat` com dados reais enquanto existirem migracoes nao versionadas nem aceite juridico.**

## Limites conhecidos

A base de feriados e suspensoes e manual; nao ha consulta automatica em tempo real. As regras especiais requerem advogado revisor. Alertas disponiveis dentro da aplicacao nao garantem entrega externa. A cobertura anual do calendario e declaratoria e requer verificacao de fonte oficial pelo gestor. Nao existe calculo de prazos automaticamente a partir da leitura DJEN/Domicilio.
