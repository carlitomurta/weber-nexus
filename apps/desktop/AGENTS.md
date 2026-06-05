# Desktop — General Rules

The desktop is the local interface of Weber Nexus.

## Stack

- Electron
- Vite
- React
- TailwindCSS
- TanStack Query
- TanStack Route
- Zod

## Responsibilities

- Local login/connection.
- Local database configuration.
- Local UI that connects to local runtime/API
- Runtime health visualization.
- Display of time series data from InfluxDB via runtime/API.

## Rules

- Do not access SQLite directly through the UI.
- Do not access InfluxDB directly through the UI.
- Do not place Modbus rules in the UI.
- Do not place polling rules in the UI.
- The UI should display the following states: loading, empty, error, stale, and offline.
- All communication must go through the API/runtime.
- Validate forms with Zod when applicable.
- Do not assume internet access is available.
