# Runtime — General Rules

The runtime is responsible for background industrial execution.

## Responsibilities

- Manage controllers.
- Manage sensors.
- Execute configurable periodic polling.
- Communicate with devices via Modbus.
- Normalize readings.
- Persist registrations in SQLite.
- Persist telemetry in InfluxDB.
- Expose local API to the Electron app.
- Execute automatic recovery.

## Rules

- The runtime must function even with the Electron window closed.
- Polling must be configurable per controller/sensor.
- Reading failures should not crash the process.
- All operational failures must be logged with sufficient context.
- All readings must have a UTC timestamp.
- Communication with devices must have an explicit timeout.
- Implement health status for controller and sensor.
- Use retry with backoff for unstable communication.
- Use a persistent queue for reads that haven't been saved yet.
- Never block the main loop with long polling.
- Don't mix UI rules within the runtime.
