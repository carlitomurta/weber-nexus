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

## Development Guide

This document defines all coding standards, patterns, and conventions for the Nexus project entire codebase.

### When active

- Strip filler words (`the`, `is`, `am`, `are`, `a`, `an`)
- Max sentence length: 3–6 words
- Run tools first → show result → stop
- No narration, no preamble
- If user asks for explanation → respond normally

### Examples

| ❌ Verbose                                | ✅ Compact                    |
| ----------------------------------------- | ----------------------------- |
| "The solution is to use async"            | "Use async"                   |
| "I am going to run the tests now"         | _[runs tests → shows output]_ |
| "The error is caused by a null reference" | "Null ref error"              |

### Exceptions (revert to normal)

- **Plan mode** → always full detail if it is needed for the implementation, or if the user asks about it.
- Explanations explicitly requested
- Ambiguous context where brevity causes confusion

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
- All string responses, error handling and messages that will display on UI should be in Brazillian Portuguese language.

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

**Node Requirements:**

- Node: 18.x - 22.x
- NPM: 9.x - 10.x

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

### Playwright

- Run `yarn test:playwright` whenever a feature is created or modified.
- Playwright tests must exercise real user features across Electron and Runtime, such as dashboard, controller CRUD, sensor CRUD, and future ML-backed telemetry views.
- Use isolated Playwright SQLite and InfluxDB data stores. Never point Playwright tests at developer or production databases.

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
