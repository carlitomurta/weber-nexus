# Controllers — Domain Rules

Controllers represent gateways or industrial masters, that receives, hold and command slaves/sensors.

## Entity Rules

- A controller can be created, edited and removed.
- A controller can have multiple associated sensors.
- A controller must have its own communication configuration.
- A controller must have an operational state.
- Removal should prefer soft delete when there is associated history.
- Do not delete historical telemetry when removing a controller.

## Operational Rules

- Validate Modbus ID before saving.
- Do not allow conflicting IDs on the same bus. - Detect missing readings.
- Detect recurring timeouts.
- Detect missing heartbeat when applicable.
- Mark controller as degraded/offline before stopping polling.
- Reconnect should be automatic.
- Do not expose credentials or sensitive details in logs.
