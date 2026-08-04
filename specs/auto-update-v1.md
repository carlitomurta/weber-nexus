# Feature: Auto Update Completo com Nexus Update Agent

## Objetivo

Atualizar remotamente o Nexus como uma unidade operacional completa, incluindo Desktop Electron, Runtime, migrations SQLite, evolução de schema/configuração do InfluxDB e recursos empacotados, sem perda de dados e sem depender da UI estar aberta.

## Contexto

O Nexus roda em ambiente industrial e precisa continuar operando offline. A atualização deve ser possível quando houver acesso à internet, mas o funcionamento normal do Runtime, Modbus, SQLite e InfluxDB não pode depender de internet.

O Desktop Electron hoje inicia o Runtime local em desenvolvimento e em pacote instalado. Para produção, a estratégia de update deve evoluir para um supervisor local dedicado: `Nexus Update Agent`.

O `Nexus Update Agent` será responsável por verificar releases, baixar artefatos, validar integridade, coordenar parada segura, instalar a nova versão e reiniciar os componentes. O Runtime continuará sendo o dono das migrations de dados.

## Arquitetura Alvo

```text
GitHub Releases Privado
        │
        ▼
Nexus Update Agent
        │
        ├── Desktop Electron
        │
        ├── Runtime
        │
        ├── SQLite
        │
        └── InfluxDB
```

## Componentes

### Nexus Update Agent

- Serviço local instalado junto com o Nexus.
- Windows: Windows Service.
- Linux: systemd service.
- Deve iniciar com o sistema operacional.
- Deve funcionar com a UI fechada.
- Deve verificar internet sem interferir na comunicação Modbus.
- Deve consultar GitHub Releases privado somente quando houver conectividade.
- Deve baixar, validar e preparar update.
- Deve coordenar Desktop, Runtime, SQLite e InfluxDB.
- Não deve abrir porta pública.
- Deve se comunicar localmente por canal administrativo restrito, como named pipe no Windows ou Unix socket no Linux.

### Desktop Electron

- Deve exibir status de update quando estiver aberto.
- Deve exibir pop-up de atualização quando o Agent informar update disponível.
- Deve delegar instalação ao Agent.
- Deve receber eventos locais do Agent.
- Não deve ser o supervisor principal do update em produção.
- Pode usar metadados compatíveis com `electron-updater`, mas a instalação completa deve ser coordenada pelo Agent.

### Runtime

- Deve continuar sendo dono do SQLite, InfluxDB, polling, filas persistentes e migrations.
- Deve expor preparação para update por canal local seguro.
- Deve pausar polling antes da atualização.
- Deve fazer flush ou checkpoint das filas persistentes.
- Deve iniciar em modo manutenção após update.
- Deve executar migrations SQLite e rotinas InfluxDB antes de liberar polling.
- Não deve usar `/runtime/stop` como mecanismo de produção.

### SQLite

- Deve receber migrations versionadas junto com cada release.
- Deve fazer backup antes de migrations que alterem schema ou dados.
- Deve registrar histórico de updates e migrations com timestamps UTC.

### InfluxDB

- Deve acompanhar a atualização por rotinas idempotentes de evolução.
- Deve preservar dados de séries temporais.
- Deve aplicar alterações de bucket, database, retention, measurement, tags e fields quando necessário.
- Deve registrar checkpoints em SQLite ou metadado local controlado pelo Runtime.

## Escopo

- Criar estratégia de update remoto baseada em `Nexus Update Agent`.
- Usar GitHub Releases privado como provedor de release.
- Gerar artefatos por sistema operacional.
- Atualizar Desktop, Runtime, SQLite, InfluxDB e recursos empacotados na mesma versão.
- Usar SemVer `vMAJOR.MINOR.PATCH` para versionamento.
- Suportar canais `internal`, `beta` e `stable`.
- Suportar rollout gradual.
- Preservar dados locais.
- Criar pipeline de release automatizada.
- Criar validações antes de publicar uma release.
- Criar histórico local de update e migration.
- Criar fluxo de rollback operacional baseado em backup.

## Fora de Escopo

- Atualizar firmware de controladores DXM.
- Expor Modbus, Runtime, InfluxDB ou controladores à internet.
- Permitir update direto por API HTTP pública.
- Usar `/runtime/stop` em produção.
- Usar ferramenta externa de fila.
- Exigir internet para operação normal depois da instalação.

## Provedor de Release

- O provedor oficial deve ser GitHub Releases privado.
- A pipeline deve publicar releases a partir de tags Git.
- Tags devem seguir `vMAJOR.MINOR.PATCH`.
- Releases não devem ser sobrescritas.
- Correções devem usar nova versão SemVer.
- Artifacts devem incluir instaladores Windows e Linux.
- Artifacts devem incluir metadados gerados pelo `electron-builder`, como `latest.yml` quando aplicável.
- Artifacts devem incluir manifesto próprio do Nexus para o Agent.
- O Agent deve validar versão, plataforma, canal e hash antes de instalar.
- O Agent deve recusar downgrade automático.
- Assinatura de artefatos fica fora do escopo inicial até existirem chaves/certificados de release.

## Manifesto Nexus

Cada release deve publicar um manifesto próprio para o Agent com:

- `version`
- `channel`
- `rollout`
- `published_at_utc`
- `commit_sha`
- `minimum_agent_version`
- `platforms`
- `artifacts`
- `artifact_url`
- `artifact_sha256`
- `artifact_size_bytes`
- `desktop_version`
- `runtime_version`
- `sqlite_schema_version`
- `influx_schema_version`
- `requires_reboot`
- `release_notes`

## Requisitos

- O Nexus deve usar versão única para Desktop, Runtime e pacote de dados.
- O Agent deve ser instalado e atualizado junto com o Nexus.
- O Agent deve conseguir verificar update com Desktop fechado.
- O Agent deve detectar conectividade sem depender de DNS para operação normal.
- O Agent deve baixar updates somente de GitHub Releases privado configurado.
- O Agent deve validar hash SHA-256 do artefato.
- O Agent deve validar compatibilidade de plataforma.
- O Agent deve validar canal configurado localmente.
- O Agent deve aplicar rollout gradual antes de baixar ou instalar.
- O Agent deve persistir estado local de update.
- O Desktop deve mostrar notificação de update quando estiver aberto.
- O sistema operacional deve mostrar notificação quando Desktop estiver fechado e update exigir ação do usuário.
- O Runtime deve preparar estado seguro para update.
- O Runtime deve pausar polling antes da instalação.
- O Runtime deve preservar filas persistentes.
- O Runtime deve iniciar em modo manutenção depois da instalação.
- O Runtime deve aplicar migrations SQLite antes de liberar API normal.
- O Runtime deve aplicar rotinas InfluxDB antes de liberar polling.
- O Runtime deve registrar sucesso ou falha de migrations.
- O Runtime deve executar health check final.
- Mensagens exibidas ao operador devem estar em português brasileiro.
- Todos os timestamps persistidos devem estar em UTC.

## Regras de Negócio

- O Agent é o supervisor de update em produção.
- O Desktop não instala update completo sozinho.
- O Runtime é o dono das migrations.
- `/runtime/stop` é permitido apenas para desenvolvimento ou operação local explicitamente habilitada.
- Em produção, parada do Runtime deve ser feita pelo Agent usando controle de processo ou serviço.
- Polling nunca deve rodar durante migration.
- Migrations SQLite devem ser sequenciais, versionadas e forward-only.
- Rotinas InfluxDB devem ser idempotentes.
- Alterações destrutivas exigem backup antes da execução.
- Falha antes da instalação deve manter versão atual.
- Falha durante migration deve manter Runtime em modo manutenção.
- Falha após alteração de dados deve exigir restore por backup local.
- O usuário não deve perder dados SQLite ou InfluxDB durante update normal.
- Release publicada não deve ser alterada.
- Rollback binário deve usar versão SemVer maior quando já houver release distribuída.

## Fluxo de Verificação

1. Agent inicia com o sistema operacional.
2. Agent lê configuração local de canal e versão instalada.
3. Agent verifica conectividade.
4. Agent consulta GitHub Releases privado.
5. Agent lê manifesto Nexus da release candidata.
6. Agent valida versão, canal, rollout e plataforma.
7. Agent compara Desktop, Runtime, SQLite e InfluxDB esperados.
8. Agent notifica Desktop se estiver aberto.
9. Agent cria notificação do sistema se Desktop estiver fechado e update exigir ação.

## Fluxo de Instalação

1. Agent baixa artefato da release.
2. Agent valida SHA-256.
3. Agent registra início do update em UTC.
4. Agent solicita preparação segura ao Runtime por canal local.
5. Runtime pausa polling.
6. Runtime faz flush ou checkpoint das filas persistentes.
7. Runtime confirma `ready_for_update`.
8. Agent fecha Desktop, se necessário.
9. Agent para Runtime por controle de processo ou serviço.
10. Agent para InfluxDB local se a atualização exigir troca de recurso binário ou manutenção do diretório.
11. Agent executa instalador ou troca versão instalada.
12. Agent reinicia Runtime atualizado.
13. Runtime inicia em modo manutenção.
14. Runtime cria backup SQLite.
15. Runtime executa migrations SQLite pendentes.
16. Runtime executa rotinas InfluxDB pendentes.
17. Runtime executa health check de SQLite, InfluxDB, polling engine e API local.
18. Runtime libera API normal.
19. Runtime libera polling.
20. Agent registra sucesso do update em UTC.
21. Agent inicia ou notifica Desktop atualizado.

## Fluxo de Falha

- Se download falhar, Agent mantém versão atual.
- Se hash falhar, Agent descarta artefato.
- Se preparação do Runtime falhar, Agent cancela instalação.
- Se instalação falhar antes de migrations, Agent tenta manter ou restaurar versão anterior.
- Se migration SQLite falhar, Runtime permanece em modo manutenção.
- Se rotina InfluxDB falhar, Runtime permanece em modo manutenção.
- Se health check final falhar, Runtime permanece em modo manutenção e Agent registra erro.
- Toda falha deve ter mensagem operacional em português brasileiro.

## Estado Local

Criar tabela SQLite para histórico de updates:

- `id`
- `from_version`
- `to_version`
- `channel`
- `status`
- `started_at_utc`
- `finished_at_utc`
- `manifest_sha256`
- `artifact_sha256`
- `error_message`

Criar tabela SQLite para migrations:

- `id`
- `kind`
- `version`
- `status`
- `started_at_utc`
- `finished_at_utc`
- `checksum`
- `error_message`

Criar estado local do Agent:

- `installed_version`
- `configured_channel`
- `last_check_at_utc`
- `last_available_version`
- `last_downloaded_version`
- `last_error`
- `pending_install`
- `rollout_bucket`

## Estados

- `idle`
- `checking`
- `update_available`
- `downloading`
- `downloaded`
- `validating`
- `ready_to_install`
- `preparing_runtime`
- `stopping_services`
- `installing`
- `starting_runtime`
- `migrating_sqlite`
- `migrating_influx`
- `health_check`
- `healthy`
- `maintenance`
- `failed`

## Pipeline de Release

- A pipeline deve rodar no GitHub Actions.
- A pipeline deve iniciar por tag `vMAJOR.MINOR.PATCH`.
- A pipeline deve usar Node compatível com o projeto.
- A pipeline deve usar Yarn 4.
- A pipeline deve validar `yarn version:check`.
- A pipeline deve executar lint.
- A pipeline deve executar testes unitários.
- A pipeline deve executar testes de integração do Runtime.
- A pipeline deve executar Playwright quando houver feature visual ou fluxo Electron afetado.
- A pipeline deve compilar Runtime antes do Desktop.
- A pipeline deve gerar pacote Windows.
- A pipeline deve gerar pacote Linux.
- A pipeline deve gerar SHA-256 para cada artefato.
- A pipeline deve gerar manifesto Nexus.
- A pipeline deve publicar artefatos no GitHub Releases.
- A pipeline deve publicar `latest.yml` e metadados compatíveis com `electron-builder`.
- A pipeline deve criar release como draft primeiro.
- A release só deve ser promovida depois da validação manual.
- A pipeline deve falhar se Desktop, Runtime ou manifesto divergirem de versão.
- A pipeline deve falhar se migrations esperadas não forem empacotadas.
- A pipeline deve falhar se recursos InfluxDB esperados não forem empacotados.

## Secrets da Pipeline

- `GH_TOKEN` ou `GITHUB_TOKEN` com permissão para publicar releases.

## Rollout

- Toda versão deve iniciar no canal `internal`.
- Depois de validada, pode ser promovida para `beta`.
- Depois de validada em `beta`, pode ser promovida para `stable`.
- Rollout `stable` deve seguir percentuais: 10%, 25%, 50%, 100%.
- O Agent deve calcular bucket estável por instalação.
- O bucket deve ser persistido localmente.
- Problemas em produção devem ser corrigidos com nova versão SemVer.
- Release existente não deve ser editada para trocar binários.

## Acceptance Criteria

- Dado Desktop fechado, quando houver internet e release válida, então Agent identifica update disponível.
- Dado Desktop aberto, quando houver update disponível, então UI mostra notificação em português brasileiro.
- Dado Desktop fechado, quando update exigir ação, então sistema operacional mostra notificação.
- Dado release com versão menor ou igual, quando Agent consultar GitHub Releases, então update não é instalado.
- Dado release fora do canal configurado, quando Agent avaliar manifesto, então update não é instalado.
- Dado instalação fora do percentual de rollout, quando Agent avaliar manifesto, então update não é instalado.
- Dado artefato com hash inválido, quando Agent validar download, então instalação é bloqueada.
- Dado pacote incompatível com plataforma, quando Agent avaliar manifesto, então instalação é bloqueada.
- Dado update iniciado, quando Runtime preparar atualização, então polling é pausado.
- Dado update iniciado, quando Runtime preparar atualização, então filas persistentes são preservadas.
- Dado Runtime pronto para update, quando Agent instalar pacote, então Runtime é encerrado por supervisor local e não por `/runtime/stop`.
- Dado Runtime atualizado, quando ele iniciar, então entra em modo manutenção antes da API normal.
- Dado migrations SQLite pendentes, quando Runtime iniciar, então migrations executam antes do polling.
- Dado rotinas InfluxDB pendentes, quando Runtime iniciar, então rotinas executam antes do polling.
- Dado migration já aplicada, quando Runtime reiniciar, então migration não é reaplicada.
- Dado rotina InfluxDB já aplicada, quando Runtime reiniciar, então rotina não é reaplicada destrutivamente.
- Dado migration SQLite com falha, quando Runtime iniciar, então Runtime permanece em modo manutenção.
- Dado update concluído, quando health check passar, então Runtime libera API e polling.
- Dado update concluído, quando estado for registrado, então histórico contém timestamps UTC.
- Dado app sem internet, quando Agent não conseguir consultar release, então Nexus continua operando com versão instalada.
- Dado pipeline com versões divergentes, quando release rodar, então pipeline falha.
- Dado pipeline sem artefato de plataforma esperado, quando release rodar, então pipeline falha.
- Dado pipeline aprovada, quando release for publicada, então GitHub Releases contém instaladores, hashes SHA-256, `latest.yml` e manifesto Nexus.

## Testes

- Unit tests para parser do manifesto Nexus.
- Unit tests para comparação SemVer.
- Unit tests para seleção de canal.
- Unit tests para cálculo de rollout bucket.
- Unit tests para validação de plataforma.
- Unit tests para validação de hash.
- Unit tests para estado local do Agent.
- Unit tests para migrations SQLite idempotentes.
- Unit tests para rotinas InfluxDB idempotentes.
- Integration tests para preparação segura do Runtime.
- Integration tests para startup do Runtime em modo manutenção.
- Integration tests para falha de migration SQLite.
- Integration tests para falha de rotina InfluxDB.
- Integration tests para health check pós-update.
- Teste Electron/Playwright para notificação de update disponível.
- Teste Electron/Playwright para erro de update em português brasileiro.

## Notas Técnicas

- Usar GitHub Releases como provider do `electron-builder`.
- Configurar `publish.provider` como `github`.
- Publicar release como draft antes da promoção manual.
- Manter Windows NSIS como alvo principal para Windows.
- Manter AppImage como alvo preferencial para update Linux.
- Manter `.deb` como instalação manual ou gerenciada.
- Agent deve consumir manifesto Nexus próprio, mesmo quando também existirem metadados `electron-updater`.
- `electron-updater` pode ser usado para compatibilidade de metadados e experiência Desktop, mas não deve substituir o Agent na coordenação do update completo.
- `NEXUS_ENABLE_RUNTIME_STOP` deve permanecer voltado a desenvolvimento e testes locais.
- Nenhuma porta adicional deve ser aberta.
- Nenhum componente industrial deve ser exposto à internet.
