# Sensors — Domain Rules

Sensors represent devices or measurement points associated with a controller.

## Entity Rules

- A sensor always belongs to a controller.
- A sensor can have multiple metrics.
- A sensor can be created, edited and removed.
- Removal should prefer soft delete when there is history.
- A reading failure should not delete the last known value.

## Reading Rules

- Raw readings should be separated from normalized readings.
- Apply metric scaling.
- Validate minimum and maximum range when known.
- Persist normalized telemetry in InfluxDB.
- Persist metadata/configuration in SQLite.
- All readings must have a UTC timestamp.
- All metrics must have an explicit unit.
- Invalid readings should generate an error event, not a fatal exception.
