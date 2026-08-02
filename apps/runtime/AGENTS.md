# Runtime - Architecture Guide

The runtime is the local NestJS background process for Weber Nexus. It owns
industrial execution, local APIs, controller configuration sync, periodic
polling, InfluxDB lifecycle, and telemetry durability while the Electron UI may
be closed.

## Boundaries

- Runtime exposes only local HTTP APIs for the desktop app and local tooling.
- Runtime must work offline and must not depend on DNS, cloud services, or
  external queues.
- Runtime manages background work through NestJS lifecycle hooks.
- Runtime stores configuration, registrations, users, XML sync metadata, and
  write queues through `@weber-nexus/repository` backed by SQLite.
- Runtime stores time-series sensor readings in InfluxDB.
- Runtime communicates with industrial controllers through local network
  protocols only.
- Runtime must not contain UI rendering rules, Electron window concerns, or
  frontend state management.

## Current Module Shape

- `AppModule` composes `RuntimeConfigModule`, `RepositoryModule`,
  `RuntimeControlModule`, `InfluxdbModule`, `AuthModule`,
  `ControllersModule`, and `DiagnosticsModule`.
- `RuntimeConfigModule` is global and provides `RuntimeEnvService`.
- `ControllersModule` groups controller and sensor feature modules.
- `IndustrialControllersModule` owns controller CRUD plus XML sync entrypoints.
- `SensorsModule` owns sensor CRUD and XML upload orchestration.
- `ControllerXmlConfigModule` owns `WLConfig.xml` parsing, generation,
  download, upload, reset, and post-upload verification.
- `PollingModule` owns `PollingRuntimeService` and exports it to features that
  need polling refresh or diagnostics snapshots.
- `InfluxdbModule` owns InfluxDB process lifecycle, telemetry writes, queries,
  SQL generation, line protocol generation, and queue draining.
- `RuntimeControlModule` owns local health and development-only stop endpoints.
- `AuthModule` owns login and default admin bootstrap.
- `DiagnosticsModule` exposes runtime diagnostic snapshots.

Keep module imports aligned with actual folders. Industrial controller and
sensor features stay under `src/controllers/*`; runtime control and diagnostics
stay as top-level feature modules under `src/runtime-control` and
`src/diagnostics`.

## NestJS Patterns

- Organize by feature module first, not by technical layer.
- Keep controllers thin: route decorators, Nest pipes, DTO parsing, service
  calls.
- Keep domain decisions in services.
- Keep IO-specific details in focused repositories, adapters, or protocol files.
- Use constructor injection for all dependencies.
- Export a provider only when another module needs it.
- Avoid circular module imports; extract shared behavior into a smaller module
  when two features need the same dependency.
- Use `OnModuleInit` for module-local bootstrapping such as default users.
- Use `OnApplicationBootstrap` and `OnApplicationShutdown` for background
  processes, polling, timers, and child processes.
- Always clear timers and stop managed processes during shutdown.
- Keep public service methods explicit about return types when adding new
  exported behavior.

## API And DTO Patterns

- Request bodies enter controllers as `unknown`.
- Parse request bodies with functional DTO parsers before calling services.
- Reuse `src/common/request-validation.ts` for required strings, optional
  strings, integers, booleans, and positive integers.
- Throw NestJS HTTP exceptions from parsing and service validation.
- Use Brazilian Portuguese for every API-facing message and error.
- Trim user-provided strings before persistence or comparison.
- Normalize emails to lowercase in auth DTOs.
- Use `ParseIntPipe` for numeric route params.
- Keep query parsing in DTO helpers unless a dedicated pipe is already used.
- Do not return secrets, password hashes, tokens, file paths with credentials,
  or raw auth config from API responses.

## Persistence Decisions

- SQLite is the source of truth for controllers, sensors, users, Influx config,
  XML metadata, and pending telemetry writes.
- InfluxDB is the source of truth for historical sensor readings.
- Do not delete historical telemetry when deleting controllers or sensors.
- Prefer repository methods from `@weber-nexus/repository`; do not add direct
  SQL access inside runtime services.
- Use repository operations that preserve XML sync metadata when controller or
  sensor changes require a new `WLConfig.xml`.
- Preserve the persistent Influx write queue. Never replace it with in-memory
  state or an external queue.
- Any new background write path that can fail after polling should be either
  idempotent or recoverable through SQLite.

## Polling Decisions

- `PollingRuntimeService` is the bridge between SQLite configuration,
  `@weber-nexus/polling-engine`, operational status, diagnostics snapshots, and
  Influx telemetry.
- Polling starts on `OnApplicationBootstrap` by loading all controllers from
  SQLite and refreshing each controller.
- Polling stops on `OnApplicationShutdown`.
- Controller changes and sensor changes must call
  `PollingRuntimeService.refreshController(controllerId)` after persistence.
- Controller deletion must call `PollingRuntimeService.stopController(id)`.
- A controller with no sensors must not start polling.
- Polling errors must be logged and must mark controller and sensors offline
  without crashing the process.
- Successful polling must mark controller and sensors active.
- Latest raw holding-register snapshots are diagnostic, in-memory state only;
  they are not the source of truth.
- Use `polling-controller.mapper.ts` for repository-to-engine mapping.
- Keep the current Host API polling protocol decision unless a controller type
  explicitly requires another protocol.

## InfluxDB Decisions

- `InfluxdbRuntimeService` manages local InfluxDB startup when an external
  instance is not already reachable.
- InfluxDB can be disabled only through runtime environment configuration.
- InfluxDB URLs, tokens, data paths, binary paths, and platform-specific paths
  must be resolved through `RuntimeEnvService`.
- InfluxDB filesystem and process environment resolution belongs in
  `InfluxdbRuntimePathsService`; process lifecycle belongs in
  `InfluxdbRuntimeService`.
- InfluxDB child process output must go through `@weber-nexus/logger`.
- Telemetry writes use line protocol through `InfluxdbTelemetryRepository`.
- Failed telemetry writes must be enqueued through
  `InfluxWriteQueueRepository`.
- Queue draining must be single-flight and retry with backoff.
- Query APIs must batch registered sensor registers and paginate by timestamp.
- Use UTC timestamps and nanosecond precision for line protocol.
- Keep health registers and metric registers distinguishable with
  `register_kind`.
- Offline sensors should only write health readings; metric readings require an
  online health state.

## Controller XML Decisions

- Controller creation downloads `WLConfig.xml`, parses it, imports sensors, and
  persists XML metadata with the controller.
- Controller IP changes require downloading XML from the new IP and replacing
  XML-derived sensor metadata.
- Sensor create, update, and delete operations that affect XML fields must
  upload a new `WLConfig.xml` before persisting the final local change.
- XML upload failures must abort the local sensor mutation.
- After a successful XML upload, update controller XML sync metadata.
- After XML sync or XML-affecting mutations, refresh polling for that
  controller.
- `ControllerXmlConfigService` owns orchestration and Nest exceptions.
- `controller-file-transfer.ts`, `wlconfig-xml.ts`, and `wlconfig-template.ts`
  are public facades and should stay protocol/parser/template focused.
- Keep low-level TCP response readers, transport helpers, XML record helpers,
  metadata helpers, sensor XML mapping, upload plans, and CRC helpers in their
  dedicated files instead of expanding the facades again.
- Use TCP port `8844` for the DXM Host API file transfer unless an explicit
  option overrides it.
- Keep XML upload chunks at a maximum of 512 bytes.
- Preserve DXM newline encoding rules for file transfer.
- Verify uploads after controller restart by reading virtual register `10101`.

## Controller And Sensor Domain Rules

- A controller can have many sensors.
- A sensor always belongs to one controller and cannot be moved between
  controllers.
- Polling interval must be a positive integer in milliseconds.
- Sensor `nodeId` must be an integer from 1 to 247.
- A sensor must have at least one register.
- Sensor register addresses must be inside that node's 16-register range:
  `nodeId * 16 + 1` through `nodeId * 16 + 16`.
- Register names are required.
- Register scale is optional for metrics and forbidden for health-check logic.
- When scale exists, `scaleType` must be `multiply` or `divide`, and
  `scaleFactor` must be positive.
- Health-check registers do not use scale.
- Each node can have only one health-check register.
- Register addresses must not conflict within the same controller.
- Sensor removal should not delete historical telemetry.

## Runtime Control And Security

- Runtime binds to `127.0.0.1` by default.
- Runtime stop endpoint is for local development control only.
- `RuntimeControlService.stop()` must reject non-local callers.
- Runtime stop must be disabled in production unless explicitly enabled by env.
- Do not expose Modbus, Host API, InfluxDB tokens, or controller credentials to
  the internet.
- CORS is currently local-app friendly through `origin: true`; keep network
  exposure constrained by host binding and deployment packaging.
- Logs must include enough operational context, but must not expose secrets.

## Error Handling And Logging

- `main.ts` registers `uncaughtException` and `unhandledRejection` logging.
- Use `RuntimeExceptionFilter` for consistent HTTP error responses.
- Error response timestamps must use `new Date().toISOString()`.
- Use `@weber-nexus/logger` with stable source names such as
  `runtime/path/file.ts`.
- Operational failures should be logged with controller ID, controller name, IP,
  operation name, or queue item ID when available.
- Background failures must be contained and logged; they should not terminate
  polling unless shutdown is intentional.
- Avoid swallowing errors silently. If recovery is possible, log warning or
  error and continue with explicit fallback.

## Testing Patterns

- Keep unit specs next to runtime source files as `*.spec.ts`.
- Test pure parsers, mappers, SQL builders, and schema formatters directly.
- Mock repositories and external services in Nest service tests.
- Test lifecycle services for startup, shutdown, timer cleanup, retry, and
  failure behavior.
- Keep E2E tests under `apps/runtime/test`.
- Before changing architecture or imports, run runtime build or targeted tests.
- Prefer focused tests for changed behavior; broaden tests when touching shared
  modules, polling, Influx queueing, or XML file transfer.

## Development Commands

- Development: `yarn workspace @weber-nexus/runtime dev`
- Stop local runtime: `yarn workspace @weber-nexus/runtime stop`
- Build runtime: `yarn workspace @weber-nexus/runtime build`
- Unit tests: `yarn workspace @weber-nexus/runtime test`
- E2E tests: `yarn workspace @weber-nexus/runtime test:e2e`
- Format runtime: `yarn workspace @weber-nexus/runtime format`

## Non-Negotiables

- Use TypeScript.
- Keep runtime local-first and offline-capable.
- Use UTC for all persisted and API timestamps.
- Keep all API-facing messages in Brazilian Portuguese.
- Do not add external queueing infrastructure.
- Do not add direct cloud access to DXM controllers.
- Do not open unnecessary ports.
- Do not mix Electron UI behavior into runtime services.
- Preserve existing features while refactoring.
- Keep files focused; split files before they become multi-responsibility
  services.
