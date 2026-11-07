# Release notes — SysADV v0.10.1-qa6

- Corrige a inferência de tipagem após validação Zod, incluindo campos com `.default(...)`.
- Soluciona a causa dos erros de compilação `TS2345` no campo `internalBusinessDays` registrados na QA5.
- Atualização limitada a `office-policy.ts` e teste estático de regressão.
- QA6 **não é homologação concluída**; API, Vite, PostgreSQL e navegação devem ser verificados na execução real.
- Aplicação via `_hotfix_qa6/APLICAR_HOTFIX_QA6.bat` ou pacote completo QA6.
