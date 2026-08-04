# Release e Auto Update Nexus

## Release

1. Garanta que `package.json`, Desktop, Runtime e pacotes estejam na mesma versão.
2. Garanta que `resources/influxdb/3.9.3/windows` e `resources/influxdb/3.9.3/linux` estejam disponíveis no checkout de CI.
3. Crie tag SemVer:

```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

A pipeline `Nexus Release` valida versões, testes, migrations SQLite, recursos InfluxDB, build Windows/Linux, hashes SHA-256 e manifesto Nexus.

## Canais

Toda versão começa em `internal`.

Para promover manualmente enquanto a release ainda estiver em draft, rode `workflow_dispatch` na mesma tag e escolha:

- `internal`: validação interna.
- `beta`: validação controlada.
- `stable`: produção.

Para `stable`, use rollout gradual: `10`, `25`, `50`, `100`.

A promoção em draft regenera apenas `nexus-update-manifest.json`. Binários publicados não são substituídos.

## Draft Release

A pipeline cria GitHub Release em draft. Antes de publicar:

- Verifique installers Windows e Linux.
- Verifique `latest.yml` e metadados Linux.
- Verifique `nexus-update-manifest.json`.
- Valide hash SHA-256 dos artefatos.
- Teste instalação em máquina interna.

## Rollback

Não sobrescreva release publicada.

Se houver falha distribuída, publique nova versão SemVer maior com correção ou reversão binária.

Se a falha ocorrer após migration de dados, mantenha Runtime em manutenção e restaure backup local antes de liberar polling.

## Recursos InfluxDB

Os binários do InfluxDB não estão versionados no git. O CI deve receber esses arquivos por Git LFS, cache interno ou outro mecanismo privado antes da etapa `release:validate`.
