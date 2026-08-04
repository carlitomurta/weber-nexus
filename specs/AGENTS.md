# Spec-Driven Development

## Regra Principal

Codex deve trabalhar a partir de specs em `/specs`.

Não implemente uma feature quando não existir spec clara com critérios de aceite.

## Fluxo Obrigatório

1. Ler `specs/README.md`.
2. Ler a spec relacionada à solicitação.
3. Criar ou atualizar `specs/tasks.md` quando a implementação exigir múltiplos passos.
4. Implementar somente requisitos descritos na spec.
5. Criar ou atualizar testes automatizados para os critérios de aceite.
6. Validar os critérios de aceite antes de concluir.
7. Atualizar a task como concluída somente depois da validação.

## Como Lidar com Lacunas

- Se a spec tiver campos `TODO`, não invente comportamento.
- Se a lacuna bloquear implementação, pergunte ao usuário.
- Se a lacuna não bloquear, implemente apenas o caminho explicitamente definido.
- Se descobrir novo requisito durante implementação, atualize a spec antes do código.

## Formato de Task

Use `specs/tasks.md` para decompor trabalho implementável.

Cada task deve conter:

- referência à spec;
- checklist técnico;
- testes esperados;
- status claro.

## Restrições do Projeto

- Use TypeScript.
- Mensagens exibidas na UI devem estar em português brasileiro.
- Timestamps devem usar UTC.
- O sistema deve continuar funcionando offline.
- Não exponha Modbus, Runtime, InfluxDB ou DXM à internet.
- Persistir configurações e registros em SQLite.
- Persistir leituras e séries temporais em InfluxDB.
- Preferir soluções simples, explícitas e testáveis.

## Definition of Done

- Spec existe e está atualizada.
- Critérios de aceite estão cobertos.
- Testes relevantes passam.
- Código segue arquitetura existente.
- Nenhuma mudança fora do escopo foi introduzida.
