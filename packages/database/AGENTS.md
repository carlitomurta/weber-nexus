# Database — General Rules

This package contains local database infrastructure.

## Responsibilities

- SQLite Client.
- Drizzle Schemas.
- Migrations.
- Shared persistence types.
- Local connection utilities.

## Rules

- Use Drizzle ORM.
- Do not include complex domain rules in this package.
- Do not include polling rules in this package.
- Do not include Modbus rules in this package.
- Avoid inferred types that break declaration emit.
- Export explicit types.
- Relational timestamps must be UTC.
- Migrations must be versioned.
- SQLite must use WAL when applicable.
- InfluxDB can have shared configuration/types, but operational writing must happen at runtime.
