# machine-learning

POC offline para atender requisicoes do runtime sobre equipamentos.

## Modelos iniciais

- `generic`: modelo padrao para equipamentos genericos ou sem modelo especifico.
- `electric_motor`: modelo especifico para motor eletrico.

## Exemplo

```ts
import {
  createDefaultMachineLearningEngine,
  mockRuntimeRequests,
} from "@weber-nexus/machine-learning";

const engine = createDefaultMachineLearningEngine();
const prediction = engine.predict(mockRuntimeRequests.electricMotor);
```
