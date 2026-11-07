# SysADV 0.10.1 — Motor de prazos jurídicos (candidato à homologação)

## Escopo implementado

- Regras por ramo/natureza e versões (`DeadlineRule`), catálogo inicial em `deadline-presets.ts`.
- Cálculo **determinístico por data civil** (ISO `YYYY-MM-DD`), sem confundir fuso UTC com datas de expedientes.
- Processo judicial vs prazo material vs administrativo; contagem em úteis, corridos, anos e data/hora fixa.
- Recesso padrão CPC/CLT de 20/12 a 20/01 quando aplicável, sem afetar CPP/Lei 11.101.
- Feriados manuais por tribunal, UF e cidade (`CourtHoliday` preexistente); suspensões cadastradas em `CourtSuspension`.
- Evidência de cobertura anual e escopo (`CourtCalendarCoverage`), mantida por gestor do escritório.
- Prazo em dobro só quando a regra permite, com fundamento escrito e proibição da hipótese de art. 229 nos autos eletrônicos.
- Previsão de prazo fatal, prazo interno (dias úteis anteriores) e D-5, D-3, D-1 em dias **corridos**; alertas internos persistidos após aprovação.
- Rascunho, aprovação por **outro usuário** com `calendar.manage`, logs na tabela `AuditEvent`, histórico sem reescrever o cálculo aprovado.
- Cancelamento lógico auditado e consulta de prazos aprovados na Agenda.
- `POST /api/deadlines/preview`, `POST /api/deadlines`, `GET /api/deadlines`, `POST /api/deadlines/:id/approve`, `GET /api/deadlines/alerts` e demais rotas de regras e calendário.

## Pontos jurídicos críticos corrigidos em relação ao pedido

1. **Lei 11.101/2005**: art. 189, §1º, I determina dias **corridos**. O *stay period* de 180 dias e a impugnação de crédito de 10 dias não são pré-configurados em úteis. Fonte: https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2005/lei/l11101compilado.htm e STJ https://www.stj.jus.br/sites/portalp/Paginas/Comunicacao/Noticias/15062022-Prazo-para-impugnar-habilitacao-de-credito-na-recuperacao-judicial-deve-ser-contado-em-dias-corridos--define-Quart.aspx
2. **CPP art. 798, §3º**: prazos são contínuos; se terminarem em domingo ou feriado, considerar eventual prorrogação ao dia útil imediato. A regra padrão da matéria criminal foi configurada com essa possibilidade e requer verificação no caso.
3. **CPC art. 229, §2º**: dobra por procuradores de escritórios distintos **não se aplica a autos eletrônicos**. Fazenda Pública e Defensoria têm fundamentos próprios e exceções.
4. **Lei 8.213/1991, art. 41-A, §5º**: os 45 dias citados referem-se ao **primeiro pagamento do benefício** após apresentação da documentação necessária; não devem ser lançados como prazo universal para o INSS proferir decisão inicial. Esse suposto gatilho **não** foi pré-cadastrado.
5. **Prazos fixados pelo magistrado** e defesa trabalhista: exigem informação de data e hora concreta. O aplicativo não supõe cinco dias quando há despacho específico.
6. **Prazos administrativos federais** têm regra geral da Lei 9.784/99, art. 66, mas normas especiais e regulamentos do CRPS podem prevalecer. Os presets são referências, não parecer jurídico.

## Segurança, escopo e restrições

- Todo acesso a objetos usa o `organizationId` da sessão autenticada, sem aceitar tenant no corpo.
- A regra customizada precisa de aprovação antes do uso. Uma nova versão não substitui o snapshot já salvo nos cálculos.
- A aprovação requer segunda pessoa, cobertura de calendário verificada e que o hash dos insumos não tenha mudado.
- Falta de calendário completo, ciência válida, conteúdo da ordem, horário oficial ou revisão impedem assumir prazo como definitivo.
- A verificação de calendário é *manual e declaratória*; não há consulta de API externa em tempo real nesta release.
- Os alertas **não enviam e-mail/SMS/push**; apenas aparecem internamente para usuários autorizados ao consultar a tela.
- Não há cálculo automático decorrente de DJEN, Domicílio Judicial ou DataJud sem identificação válida do gatilho. Uma publicação *não* equivale a ciência.
- Não há liberação para dados reais até validar `prisma validate`, build Docker/Vite, teste PostgreSQL e homologação jurídica com calendários/atos dos tribunais usados.

## SQL

O arquivo `sql/2026-11-sysadv-deadlines-reference.sql` é referência DDL PostgreSQL 16, **não um instalador automático**. O projeto já usa Prisma: derive migração revisada, execute em banco QA separado e ensaie restauração antes de migrar banco real. Nunca aplique simultaneamente DDL manual e `prisma db push` ao mesmo destino.

## Respostas juridicamente condicionais

- A escolha do dia-gatilho é obrigatória e deve conter evidência documental. A contagem não parte da hora de captura da integração.
- Regras de audiência e prazos materiais são templates revisáveis e podem envolver peculiaridades de espécie, comarca, rito ou tribunal.
- Alertas D-5/D-3/D-1 são datas corridas, inclusive fins de semana, para dar antecedência informativa. Não alteram a contagem legal nem garantem entrega externa.
- Para material anual, o motor usa aniversário do ato (e ajusta 29 de fevereiro para fim de fevereiro em ano não bissexto). A solução específica deve ser revista por advogado.
