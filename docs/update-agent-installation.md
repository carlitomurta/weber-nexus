# Instalação do Nexus Update Agent

## Windows

Serviço:

- Nome: `NexusUpdateAgent`
- Display name: `Nexus Update Agent`
- Startup: automático
- Conta: `LocalService`
- Binário esperado: `%ProgramFiles%\\Weber Nexus\\UpdateAgent\\nexus-update-agent.exe`
- Estado local: `%ProgramData%\\Weber Nexus\\UpdateAgent\\state.json`
- Downloads: `%ProgramData%\\Weber Nexus\\UpdateAgent\\downloads`
- Logs: `%ProgramData%\\Weber Nexus\\UpdateAgent\\logs`
- Canal administrativo: named pipe local restrito a administradores e `LocalService`

Variáveis/configuração:

- `NEXUS_RELEASE_CHANNEL`
- `NEXUS_UPDATE_AGENT_TOKEN`
- `NEXUS_GITHUB_OWNER`
- `NEXUS_GITHUB_REPO`

O instalador NSIS deve instalar ou atualizar o serviço, preservar `ProgramData` no uninstall normal e reiniciar o serviço após upgrade.

## Linux

Serviço:

- Unit: `nexus-update-agent.service`
- User: `nexus-update`
- Group: `nexus-update`
- Startup: `WantedBy=multi-user.target`
- Binário esperado: `/opt/weber-nexus/update-agent/nexus-update-agent`
- Estado local: `/var/lib/weber-nexus/update-agent/state.json`
- Downloads: `/var/lib/weber-nexus/update-agent/downloads`
- Logs: `/var/log/weber-nexus/update-agent`
- Canal administrativo: Unix socket em `/run/weber-nexus/update-agent.sock`

Unit base:

```ini
[Unit]
Description=Nexus Update Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=nexus-update
Group=nexus-update
ExecStart=/opt/weber-nexus/update-agent/nexus-update-agent
Restart=always
RestartSec=10
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/lib/weber-nexus/update-agent /var/log/weber-nexus/update-agent /run/weber-nexus

[Install]
WantedBy=multi-user.target
```

O pacote Linux deve criar usuário/grupo, diretórios com permissões restritas, instalar a unit, executar `systemctl daemon-reload` e habilitar o serviço.

## Regras

- O Agent não abre porta pública.
- O Agent não substitui o Runtime como dono de migrations.
- O Agent pode parar Runtime por supervisor local em produção.
- `/runtime/stop` permanece apenas para desenvolvimento/testes locais.
- O Agent deve funcionar com Desktop fechado.
