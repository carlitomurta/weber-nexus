# Weber Nexus - General Instructions

A desktop platform and distributed ecosystem for configuration, orchestration, and real-time data acquisition from industrial controllers.

Nexus is designed to integrate natively with Banner Engineering DXM controllers while maintaining a modular and vendor-agnostic architecture, enabling communication with a wide range of industrial devices and protocols. The platform continuously captures and processes operational data through resilient background services, providing a foundation for predictive analytics and future machine learning applications.

---

## Overview

Nexus combines a desktop application, background runtime services, industrial communication layers, and local databases into a single ecosystem.

The platform is built to:

- Configure and manage industrial controllers.
- Collect telemetry and process data in real time.
- Operate continuously even when the user interface is closed.
- Store relational and time-series data locally.
- Support multiple industrial communication protocols.
- Enable future predictive maintenance and machine learning workflows.
- Provide a scalable architecture for industrial monitoring and automation.

## Global Rules

- Use TypeScript.
- Always use UTC for timestamps.
- The system must work offline.
- Do not depend on DNS or the internet.
- Do not expose Modbus to the internet.
- Do not open unnecessary ports.
- Do not enable direct cloud access to DXM.
- Persist registrations/configurations in SQLite.
- Persist readings and time series in InfluxDB.
- The runtime project should work on the background.
- Implement retry, reconnect, watchdog, and health checks.
- Survive reboot, power outage, cable disconnection, and DXM shutdown.
- Do not use external queuing tools; implement your own persistent queuing logic.
- Prefer simple, explicit, and testable code.

## Architecture

```text
Desktop UI
    │
    ▼
Runtime API + Modbus Communication
    │
    ▼
 ┌──┴──┐
 ▼     ▼
SQLite InfluxDB
```

## Project Structure

```text
nexus/
│
├── apps/
│   ├── desktop/
│   ├── runtime/
│       └── src/
│           └── controllers/
│           └── core/
│
├── packages/
│   ├── repository/
│       └── src/
│           └── repositories/
│   ├── database/
│       ├── src/
│           └── schemas/
│       └── migrations/
│   ├── polling-engine/
│   ├── logger/
│   ├── shared/
│
├── README.md
└── turbo.json
```

## Technology Stack

- TypeScript

### Frontend

- Electron
- React
- Tanstack React Query
- Tanstack React Route
- Zod

### Backend

- NestJS
- SQLite
- InfluxDB 3
- Drizzle ORM
- Turborepo
- Zod

## Quick Start

### Run it locally

```bash
yarn install
yarn dev
```

### Build and generate the installer Electron

```bash
yarn build
```

### Test

```bash
yarn test
```

### Lint

```bash
yarn lint
```

### Formatting

Only on /apps/ projects

```bash
yarn prettier
```

## License

Proprietary

## Compatibility

The system should work properly for Windows >10 and Linux (Ubuntu)
