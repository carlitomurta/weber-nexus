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

## Technical Guide for DXM Performance Controllers

### 1. Overview

The DXM controller is a configurable industrial device that acts as an IIoT gateway, consolidating data from wired sensors (Modbus RTU/TCP) and wireless sensors (ISM radio). It runs a proprietary Real-Time Operating System (RTOS) to manage logic execution, data logging, and cloud communications.

### 2. Memory Map and Local Registers (Slave ID 199)

**Local Registers** are the core storage mechanism of the DXM, where all data exchange occurs. They support 32-bit (4-byte) values.

### Register Types and Ranges

| Register Range  | Data Type      | Description                                         |
| :-------------- | :------------- | :-------------------------------------------------- |
| **1 – 845**     | 32-bit Integer | Volatile memory (general processing)                |
| **846 – 850**   | Special        | Reset, Constant, and Timer registers                |
| **851 – 900**   | Non-Volatile   | Flash memory (persistent storage, 100k write limit) |
| **1001 – 5000** | Floating Point | IEEE 754 (each value occupies 2 Modbus addresses)   |
| **5001 – 7000** | 32-bit Integer | Additional volatile memory (high-capacity models)   |
| **7001 – 8000** | Non-Volatile   | Additional Flash memory                             |
| **> 10000**     | Virtual        | Read-only (system diagnostics)                      |

- **Floating-Point Note:** When accessing through Modbus, use odd-numbered addresses (e.g., 1001) to read the concatenated value.
- **Important Virtual Registers:**
  - **10031:** HTTP Push attempts.
  - **10039:** Cellular signal strength (0–31).
  - **10101:** Read Map success indicator.

### 3. Communication Protocols and Ports

The DXM operates simultaneously using multiple protocols:

| Protocol        | TCP Port | Primary Function                                         |
| :-------------- | :------- | :------------------------------------------------------- |
| **Modbus TCP**  | 502      | Direct access to local and remote registers.             |
| **ASCII API**   | 8844     | Host-initiated protocol for commands and file transfer.  |
| **EtherNet/IP** | N/A      | Communication with PLCs (limited to 228 I/O registers).  |
| **PROFINET**    | N/A      | Available on specific models such as DXM1200 and DXMR90. |

### 4. Host API Guide (Port 8844)

For integration with NodeJS or Python, communication is performed using ASCII strings over TCP.

- **Command Structure:** `CMDnnnn <parameters>`

- **Read Local Register (CMD0001):**
  - `CMD0001 StartReg, RegCount, 0, 0, 0`
  - Response: `RSP0001 StartReg, value1, value2...`

- **Write Local Register (CMD0002):**
  - `CMD0002 StartReg, RegCount, 0, 0, 0, value1, value2...`

- **Get Real-Time Clock (CMD0102):**
  - Returns UTC timestamp.

### 5. File Management via API

To read or write files such as `WLConfig.xml` (configuration) or `.sb` scripts:

1. **Start (CMD1001):** `CMD1001 filename, r/w, filesize, flags`
   - **Important:** To upload a new configuration, the filename **must** be `WLConfig.xml`.

2. **Data Transfer (CMD1002):** Packets of up to 512 bytes.
   - **Newline Replacement:**
     - CR (`0x0D`) → `0x1E`
     - LF (`0x0A`) → `0x1F`

3. **Finish (CMD1003):** Closes the file and processes the update.

### 6. ISM Radio Configuration (ID 1)

The internal radio is accessed as a Modbus slave using ID 1.

- **Performance Mode (Star Topology):**
  All data from all Nodes is consolidated into ID 1. Registers follow the formula:

  `Register = I/O# + (Node# × 16)`

- **MultiHop Mode (Tree Topology):**
  Each radio behaves as an individual Modbus device (recommended IDs: 11–60).
