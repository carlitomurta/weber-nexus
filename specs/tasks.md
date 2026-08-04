# Tasks

## Auto Update Completo com Nexus Update Agent

Spec: `specs/auto-update-v1.md`

- [x] Definir contrato do manifesto Nexus.
- [x] Implementar parser e validação do manifesto.
- [x] Implementar comparação SemVer.
- [x] Implementar seleção por canal `internal`, `beta` e `stable`.
- [x] Implementar cálculo persistente de rollout bucket.
- [x] Definir instalação do Nexus Update Agent no Windows.
- [x] Definir instalação do Nexus Update Agent no Linux.
- [x] Implementar estado local do Agent.
- [x] Implementar verificação de conectividade no Agent.
- [x] Implementar consulta ao GitHub Releases privado.
- [x] Implementar download de artefatos pelo Agent.
- [x] Implementar validação SHA-256 dos artefatos.
- [x] Implementar canal administrativo local entre Agent, Desktop e Runtime.
- [x] Implementar eventos de update para Desktop aberto.
- [x] Implementar notificação do sistema para Desktop fechado.
- [x] Implementar preparação segura do Runtime para update.
- [x] Pausar polling durante preparação de update.
- [x] Fazer flush ou checkpoint das filas persistentes.
- [x] Remover dependência de `/runtime/stop` para produção.
- [x] Implementar parada do Runtime por supervisor local em produção.
- [x] Implementar modo manutenção no Runtime.
- [x] Criar tabelas SQLite de histórico de update e migrations.
- [x] Implementar backup SQLite antes de migrations destrutivas.
- [x] Implementar executor de migrations SQLite no startup do Runtime.
- [x] Implementar executor de rotinas InfluxDB idempotentes.
- [x] Bloquear polling até migrations concluírem.
- [x] Implementar health check final pós-update.
- [x] Registrar sucesso e falhas com timestamps UTC.
- [x] Configurar `electron-builder` com provider GitHub.
- [x] Criar pipeline GitHub Actions por tag `vMAJOR.MINOR.PATCH`.
- [x] Configurar build Windows.
- [x] Configurar build Linux.
- [x] Gerar hashes SHA-256 na pipeline.
- [x] Gerar manifesto Nexus na pipeline.
- [x] Publicar artifacts no GitHub Releases como draft.
- [x] Validar que Desktop, Runtime e manifesto usam a mesma versão.
- [x] Validar que migrations SQLite foram empacotadas.
- [x] Validar que recursos InfluxDB foram empacotados.
- [x] Criar testes unitários de manifesto, versão, canal e rollout.
- [x] Criar testes unitários de validação de hash.
- [x] Criar testes unitários de migrations SQLite idempotentes.
- [x] Criar testes unitários de rotinas InfluxDB idempotentes.
- [x] Criar testes de integração do Runtime em modo manutenção.
- [x] Criar testes de integração para falha de migration.
- [x] Criar teste Electron/Playwright para status de update.
- [x] Documentar processo de release, promoção de canais e rollback.
