# Controllers, Sensors, and DXM XML Configuration Specification

Last verified: 2026-06-16.

This specification defines Nexus rules for Banner Engineering DXM controller registration, sensor/register mapping, XML configuration download, XML generation, and XML upload.

Verified against:

- Banner Engineering, [DXM Controller API Protocol](https://info.bannerengineering.com/cs/groups/public/documents/literature/186221.pdf), p/n 186221, 2019-07-01.
- Banner Engineering, [DXM1200-Bx Wireless Controller Product Manual](https://info.bannerengineering.com/cs/groups/public/documents/literature/216539.pdf), p/n 216539 Rev. N, 2026-03-18.
- Banner Engineering, [DXM700-Bx Wireless Controller Product Manual](https://info.bannerengineering.com/cs/groups/public/documents/literature/207894.pdf), p/n 207894, 2026-01-19.
- Banner Engineering, [DXM Configuration Software v4 Product Manual](https://info.bannerengineering.com/cs/groups/public/documents/literature/209933.pdf), p/n 209933, 2025-04-17.
- Banner Engineering, [Gateways & Controllers product comparison](https://www.bannerengineering.com/us/en/products/wireless-sensor-networks/wireless-controllers.html).
- Local reference XML: [packages/local_test/temp/WLConfig.xml](packages/local_test/temp/WLConfig.xml).

## Scope

Nexus currently targets Banner Engineering DXM1200 and DXM700 controllers.

The platform must:

- Register controllers in SQLite.
- Download each controller `WLConfig.xml`.
- Import sensor and register definitions from XML.
- Persist controller, sensor, and register metadata in SQLite.
- Poll runtime readings via Modbus.
- Persist readings and time series in InfluxDB.
- Generate valid `WLConfig.xml` after configuration changes.
- Upload `WLConfig.xml` using DXM Host-Initiated API on TCP port `8844`.
- Keep Modbus and Host API access on trusted local/private networks only.

## Banner DXM Model Facts

### DXM1200

Banner documents DXM1200 as an IIoT logic controller with Ethernet, RS-485, local registers, optional cellular connectivity, and Sure Cross radio support depending on model.

Relevant capabilities:

- Ethernet supports Modbus/TCP client/server and EtherNet/IP.
- Field bus supports Modbus RS-485 client.
- Internal local registers are exposed using Modbus ID `199`.
- Local register ranges include:
  - `1-845`: 32-bit integer local data registers.
  - `846-849`: reset, constant, timer.
  - `851-900`: non-volatile integer data flash.
  - `901-1000`: reserved.
  - `1001-5000`: floating-point local data registers.
  - `5001-7000`: 32-bit integer local data registers.
  - `7001-8000`: non-volatile integer data flash.
  - `>10000`: read-only virtual/system registers.
- DXM1200 can run cyclical read/write rules for wireless devices or wired Modbus devices.
- DXM1200 can define Modbus TCP read/write rules for external server devices.

### DXM700

Banner documents DXM700-Bx as a DXM controller family with Ethernet, RS-485, LCD, local registers, and model-dependent radio/cellular options.

Relevant capabilities:

- Ethernet and RS-485 are supported.
- Product data confirms Modbus RTU, Modbus/TCP, EtherNet/IP, and PROFINET support on listed DXM700 variants.
- Internal local registers are exposed using Modbus ID `199`.
- DXM700-Bx may include internal Modbus server devices including:
  - ISM radio at Modbus ID `1` on radio-equipped models.
  - User display at Modbus ID `201`.
  - Base board/output registers, including PNP output registers on supported models.
- Do not infer radio availability only from the DXM700 series name. Read the exact model and downloaded XML.

## Communication Rules

### Host-Initiated API

Use Host-Initiated API for controller file transfer and controller metadata commands.

- Transport: TCP.
- Port: `8844`.
- Command format: ASCII command strings beginning with `CMD` plus four numeric digits.
- Response format: matching `RSP` plus four numeric digits.
- Access requirement: direct IP access on same trusted network or private VPN.
- Never expose port `8844` to the internet.

### Modbus

Use Modbus for runtime readings and register writes where applicable.

- Modbus TCP default port: `502`.
- Local DXM registers: Modbus ID `199`.
- Radio/display/base-board Modbus IDs vary by model and XML.
- Never expose Modbus TCP to the internet.
- Polling must tolerate cable disconnection, controller reboot, DXM shutdown, and timeout.

## Nexus Domain Model

### Controller

A controller is one physical DXM device plus its imported `WLConfig.xml`.

Required fields:

- `name`
- `ipAddress`
- `model`

Nexus must store:

- Controller identity.
- Network address.
- Model and firmware when available.
- Last downloaded XML.
- XML GUID from `<file_info>`.
- Import timestamp in UTC.
- Sync state.
- Soft-delete state.

Controller create flow:

1. Validate required fields.
2. Connect to Host API at `<ipAddress>:8844`.
3. Download `WLConfig.xml`.
4. Clean and validate XML.
5. Parse XML attributes.
6. Import sensors from `<rtu_read>`.
7. Import local registers from `<local_regs>`.
8. Persist data in SQLite.
9. Start or update polling.

Controller update flow:

1. Validate required fields.
2. If only local Nexus fields changed, update SQLite only.
3. If controller configuration changed, generate XML first.
4. Ask user to confirm synchronization because upload can reset/reload the controller.
5. Upload XML to physical controller.
6. Persist SQLite changes only after successful upload.

Controller delete flow:

- Soft delete only.
- Do not upload a new controller XML for controller delete.
- Stop polling deleted controller.

### Sensor

A sensor is a logical group of Modbus registers under one controller.

Required fields:

- `name`
- `nodeId`
- At least one register.

Nexus source of truth:

- Runtime polling reads values from controller Modbus registers.
- Human meaning comes from imported XML names, units, scaling, and RTU read rules.

Sensor create/update/delete that changes Modbus mapping must:

1. Generate a new XML.
2. Ask user to confirm synchronization.
3. Upload XML to controller.
4. Persist SQLite changes only after upload succeeds.

Sensor metadata fields that do not require XML upload:

- `model`
- `location`
- `description`

### Sensor Register

A sensor register describes one value produced by a sensor.

Required fields:

- `name`
- `localRegisterNumber`
- `remoteRegisterAddress`
- `dataType`
- Optional `scaleType`
- Optional `scaleUsing`
- Optional `unit`

Rules:

- `localRegisterNumber` maps to `<local_regs><reg num="...">`.
- `remoteRegisterAddress` maps to `<rtu_read><rule remreg="...">`.
- A generated RTU read rule maps one or more remote registers into consecutive local registers.
- Register names, units, and scaling must remain attached to local register numbers.
- Local register ranges must not overlap between active sensors.
- Remote register ranges must not overlap for the same controller, Modbus unit, and node.

## Sensor Node Address Rules

Nexus uses Banner wireless node addressing convention for the current sensor model.

Formula:

```text
firstRemoteRegister = (nodeId * 16) + 1
lastRemoteRegister = firstRemoteRegister + 15
```

Examples:

| Node ID | First register | Last register |
| ------- | -------------: | ------------: |
| 1       |             17 |            32 |
| 2       |             33 |            48 |
| 3       |             49 |            64 |

Validation:

- A sensor with `nodeId = 1` may use remote registers `17-32`.
- A sensor with `nodeId = 2` may use remote registers `33-48`.
- Multiple sensors may share a node ID only when their remote register ranges do not overlap.
- Duplicate remote register addresses are invalid within the same controller/unit/node range.
- A rule with `remreg=17` and `count=2` consumes remote registers `17` and `18`.
- A rule with `localreg=1` and `count=2` consumes local registers `1` and `2`.

## XML File Rules

### File Identity

- Controller configuration filename must always be `WLConfig.xml`.
- The root element must be `<configuration>`.
- XML must remain valid after any edit.
- XML attributes must be preserved when parsed and regenerated.
- Unknown/unsupported XML sections must be copied from the previous valid XML unless Nexus explicitly owns them.

### Owned Sections

Nexus owns these sections:

- `<file_info>`
- `<local_regs>`
- `<rtu_read>`
- Relevant Modbus TCP/RTU server enablement when required for polling.

Nexus must preserve these sections unless a feature explicitly edits them:

- `<cascade>`
- `<constant>`
- `<calculate>`
- `<thresholds>`
- `<trend>`
- `<rtu_write>`
- `<modbus_tcp>`
- `<sched_holidays>`
- `<sched_commands>`
- `<sched_events>`
- `<astro_clock>`
- `<gps>`
- `<master_mode>`
- `<rtu_device>`
- `<rtu_server>`
- `<scripts>`
- `<timekeepers>`
- `<system_types>`
- `<log_files>`
- `<device_sync>`
- `<email_server>`
- `<server_params>`
- `<http_push>`
- `<fwall>`
- `<profinet>`
- `<iot>`

### `<file_info>`

`<file_info><info ... /></file_info>` stores controller and configuration metadata.

Important attributes:

- `device`: controller model, for example `DXM1200`.
- `filename`: must be `WLConfig.xml`.
- `guid`: XML configuration identity.
- `software`: expected to identify DXM Configuration Software.
- `timestamp`: source XML timestamp.
- `version`: DXM Configuration Software version.

Generation rules:

- Preserve existing values when not changing controller identity.
- Update timestamp when Nexus generates a new XML.
- Use UTC internally. If XML requires Banner software format, convert only at serialization boundary.

### `<local_regs>`

`<local_regs>` stores local holding register metadata.

Each `<reg />` must include:

- `num`: local register number.
- `name`: display name.

Supported optional attributes:

- `scale_type`: `divide` or `multiply`.
- `scale_using`: numeric factor.
- `units`: unit label.

Reference-compatible default attributes:

- `cloudio="1"`
- `iot="1"`
- `lcd="1"`
- `logfiles="8"`
- `perms="1"`

Rules:

- Keep `num` unique.
- Keep `num` positive.
- Preserve existing attributes that Nexus does not understand.
- Apply scaling only for display/storage interpretation. Do not mutate raw Modbus values before persistence unless explicitly required by data model.

### `<rtu_read>`

`<rtu_read>` stores read rules for wireless or wired Modbus devices.

Each `<rule />` must include:

- `name`: sensor/rule name.
- `unit`: Modbus unit/server ID.
- `localreg`: first local register receiving data.
- `remreg`: first remote register read from target device.
- `count`: number of consecutive registers.
- `remtype`: usually `hold_reg` for current Nexus mappings.
- `remfmt`: currently `int` unless explicitly configured otherwise.

Reference-compatible default attributes:

- `default="0"`
- `mask="0"`
- `maxfail="0"`
- `offset="0"`
- `poll="1"`
- `scale="0"`
- `swapped="0"`

Rules:

- `localreg..localreg+count-1` must exist in `<local_regs>`.
- `remreg..remreg+count-1` must fit the sensor node register range.
- Adjacent registers from the same sensor may be represented by one rule with `count > 1`.
- Non-adjacent registers must use separate rules.
- Keep rule names stable when updating a sensor unless user changed the sensor name.

## XML Download

Use Host API file transfer read.

Sequence:

1. Open TCP socket to controller port `8844`.
2. Send `CMD1003\r\n` to close any stale transfer.
3. Send `CMD1001 WLConfig.xml,0,0,0\r\n`.
4. Expect `RSP1001`.
5. Request chunks in sequence:

```text
CMD1002 1\r\n
CMD1002 2\r\n
CMD1002 3\r\n
...
```

6. Each chunk response is:

```text
RSP1002<length>,<crc>,<data>
```

7. Stop when response indicates:

```text
RSP10020,ffff,EOF
```

8. Send `CMD1003\r\n`.
9. Decode line-ending substitutions.
10. Clean raw response into valid XML.
11. Parse with XML attributes enabled.

Download cleaning rules:

- Remove `EOF`.
- Remove each `RSP1002` header.
- Trim everything before `<?xml`.
- Trim everything after `</configuration>`.
- Remove invalid control characters except valid XML whitespace.
- Convert controller line-ending substitutions back:
  - `0x1E` to CR (`0x0D`) or normalized newline.
  - `0x1F` to LF (`0x0A`) or normalized newline.
- Normalize line endings to `\n` for storage.
- Reject XML that cannot be parsed.

## XML Upload

Use Host API file transfer write.

Banner-required facts:

- XML configuration filename must be `WLConfig.xml`.
- Newline characters must be substituted before CRC calculation.
- CR (`0x0D`) must become `0x1E`.
- LF (`0x0A`) must become `0x1F`.
- Each data packet is at most 512 bytes.
- CRC uses Modbus CRC method over the exact packet bytes after substitution.

Sequence:

1. Generate XML.
2. Validate XML.
3. Encode XML as bytes.
4. Substitute line endings:
   - CR (`0x0D`) -> `0x1E`.
   - LF (`0x0A`) -> `0x1F`.
5. Compute total byte size after substitution.
6. Send `CMD1003\r\n`.
7. Send:

```text
CMD1001 WLConfig.xml,1,<sizeInBytes>,0\r\n
```

8. Expect `RSP1001`.
9. Split substituted XML bytes into chunks of `512` bytes or less.
10. For each chunk, compute Modbus CRC-16 and send:

```text
CMD1002 <chunkLength>,<crc>,<chunkIndex>,<chunkData>\r\n
```

11. Expect `RSP1002` for each chunk.
12. Send `CMD1003\r\n`.
13. Expect `RSP1003`.
14. Treat controller reset/reload as expected after successful configuration upload.
15. Reconnect after restart and verify the controller accepted the map.

Upload validation:

- `<sizeInBytes>` must equal the exact substituted byte count.
- `chunkLength` must equal the exact current chunk byte count.
- `chunkIndex` starts at `1`.
- `chunkIndex` increments by `1`.
- CRC must be calculated from substituted chunk bytes only.
- Do not calculate CRC from original XML before substitution.
- Do not send chunks larger than `512` bytes.

Known API errors:

- `IPC_PARAMS`: transferred byte count did not match open-file size, or transfer was intentionally canceled by mismatch.
- `API_NO_MEMORY`: file is too large for available device memory.
- `API_INVALID_FILESIZE`: invalid file size.
- `API_NO_FILE`: file not found during read.
- `API_FILE_ALREADY_OPEN`: stale transfer; send `CMD1003` and retry once.
- `API_BAD_DATA`: chunk payload or CRC problem.
- `API_NO_PAYLOAD`: missing chunk payload.
- `API_PARAM_ERROR`: malformed parameters.
- `API_BAD_SEQUENCE`: out-of-order or invalid sequence.
- `UNSUPPORTED`, `API_BAD_COMMAND`, `API_BAD_SYNTAX`, `QFULL`: reject operation and log.

## Post-Upload Verification

After successful upload:

1. Wait for controller restart/reload.
2. Reconnect to Host API or Modbus.
3. Download `WLConfig.xml` again.
4. Compare XML GUID or deterministic normalized XML hash.
5. Read runtime registers.
6. Verify virtual/status register `10101` when supported by firmware/configuration.
7. Resume polling only after verification succeeds.

## Persistence Rules

SQLite stores durable configuration:

- Controllers.
- Sensors.
- Registers.
- XML metadata.
- Last successful XML snapshot.
- Pending sync operations.
- Sync failures.

InfluxDB stores time-series readings:

- Raw Modbus value.
- Scaled value when configured.
- Unit.
- Controller ID.
- Sensor ID.
- Register ID.
- Poll timestamp in UTC.

Do not store runtime time series in SQLite except small operational status fields.

## Offline and Resilience Rules

Nexus must work without DNS or internet access.

Runtime must:

- Retry failed controller connections.
- Reconnect after TCP close.
- Use watchdog/health state per controller.
- Persist pending sync operations locally.
- Survive reboot, power outage, cable disconnection, and controller shutdown.
- Never rely on external queues.
- Avoid unnecessary open ports.

## Security Rules

- Do not expose Modbus TCP port `502` to the internet.
- Do not expose DXM Host API port `8844` to the internet.
- Do not enable direct cloud access to DXM as part of Nexus configuration.
- Prefer local/private networks.
- If cellular direct Host API is required, use private VPN as Banner documents.
- Log sensitive connection failures without leaking credentials.

## UI Message Rules

Any user-facing messages, validation errors, confirmations, and toasts must be in Brazilian Portuguese.

Suggested messages:

- `Não foi possível conectar ao controlador.`
- `O arquivo de configuração não foi encontrado no controlador.`
- `A configuração será enviada ao controlador e o dispositivo poderá reiniciar. Deseja continuar?`
- `A configuração foi sincronizada com sucesso.`
- `A sincronização falhou. Nenhuma alteração foi salva.`

## Implementation Checklist

- Parse XML with attribute preservation enabled.
- Validate before persisting.
- Validate before upload.
- Preserve unsupported XML sections.
- Use exact byte counts after line-ending substitution.
- Use Modbus CRC-16 for upload chunks.
- Download XML after upload for verification.
- Save SQLite changes only after physical sync succeeds.
- Store all timestamps in UTC.
- Keep controller operations idempotent where possible.
