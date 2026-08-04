# Padrão de Spec-Driven Development

Este diretório guarda specs antes da implementação.

Cada feature deve começar por uma spec objetiva, escrita em português ou inglês, contendo objetivo, escopo, requisitos, regras de negócio, critérios de aceite e testes esperados.

## Estrutura Recomendada

Use este formato para novas specs:

```md
# Feature: Nome da Feature

## Objetivo

Descreva o resultado esperado.

## Contexto

Explique onde a feature entra na arquitetura.

## Escopo

- O que deve ser implementado.

## Fora de Escopo

- O que não deve ser implementado agora.

## Parâmetros

- `parametro_exemplo`: TODO

## Requisitos

- Requisito verificável.

## Regras de Negócio

- Regra que governa comportamento.

## Fluxo

1. Primeiro passo.
2. Segundo passo.

## Estados

- `estado_exemplo`

## Acceptance Criteria

- Dado contexto, quando ação, então resultado.

## Testes

- Teste unitário esperado.
- Teste de integração esperado.
```

## Convenções

- Uma spec por feature.
- Nome em kebab-case.
- Exemplo: `auto-update-v1.md`.
- Use `TODO` somente para campos que ainda serão preenchidos pelo usuário.
- Não implemente requisitos marcados como `TODO`.
- Atualize a spec antes de alterar comportamento.

## Tasks

Quando a feature exigir vários passos, crie ou atualize `specs/tasks.md`.

Tasks devem ser pequenas, verificáveis e vinculadas à spec.
