---
name: controller-specialist
description: "Expert Skill for agents integrating, configuring, or maintaining controllers"
license: MIT
compatibility: Requires node and typescript.
metadata:
  author: agent-skills
  version: "1.0"
  domain: development
  type: utility
  mode: assistive
---

# Overview

The controller is a configurable industrial device that functions as an IIoT gateway, consolidating data from wireless sensor networks (ISM radio) and wired networks (Modbus RTU/TCP).
It utilizes a proprietary real-time operating system (RTOS) to manage control logic, data logging, and cloud communications.

The Nexus project is a comprehensive project that should accept other controllers in the future, but for now we will focus only on the DXM controllers from Banner Engineering that can be checked [here](https://www.bannerengineering.com/us/en.html).

For specific controllers, the documentation can be searched on the website path `https://www.bannerengineering.com/us/en/search.html?q=<controller-model>` where `<controller-model>` is the controller model to be searched, like [this](https://www.bannerengineering.com/us/en/search.html?q=DXM+1200+Controller) for DXM1200.

The docs are provided in PDF.

## Communication Protocols

The DXM supports multiple simultaneous protocols:

- Host-Initiated API (Port 8844): An ASCII-based protocol over TCP, ideal for NodeJS integration. It uses `CMDnnnn` strings and returns `RSPnnnn` responses.
- Modbus TCP (Port 502): Industry-standard access for reading/writing Holding Registers (use Slave ID 199 for local registers).
- EtherNet/IP: For communication with Allen-Bradley PLCs (limited to 228 I/O registers).
- PROFINET: Available on specific models (DXM1200, DXMR90) via GSDML files.

## Controller details

The controller stores and outputs data from all registered sensors.

The hierarchy is as follows:

The controller has several sensors, sensors have several registers, and registers can only have one address.
If the communication is Modbus, the return will be a list of numbers ordered by the order in which the sensors were registered.

A sensor must have a Modbus address, following the formula Register Number = (Node# × 16).

Therefore, for a sensor with NodeId 1, the first register address would be 17 and the last would be 31.
A controller can have several sensors with the same NodeId, but they cannot share the same register address.

In our case, we will only communicate via Modbus, so we cannot establish a relationship between sensor names and the order of register values ​​returned by the controller.

So, to do this, we collect the controller's XML file, which contains the sensor and register names, to perform this correlation, as well as the order of the sensors.

Thus, our system should act as a configuration system for the controller. When we register a controller, the system should retrieve the controller's XML file, import sensors and registers (if present), and also make changes to the system. It should send a new XML configuration file to the controller to modify its functions and return the new register values ​​via Modbus.

## XML Configuration File Management

The intelligence of the DXM (read rules, logic, and cloud pushes) is stored in the `WLConfig.xml` file.

This is how the configuration XML file works:
Use this [WLConfig](../../../packages/local_test/temp/WLConfig.xml) XML as an reference of a valid config XML.

- `<file_info> <info>`: Holds the controller device and firmware information.
- `<local_regs>`: Holds the holding registers of the controller
  - `<reg>` attributes follows as:
    - `name`: The name of the register, can be anything, it's required.
    - `num`: Is the order number of the register, it's required.
    - `scale_type`: Can be "divide" or "multiply", it can be omitted if no scale.
    - `scale_using`: The multiplier of `scale_type`, it can be omitted if no scale.
    - `units`: It's the metric unit, like: "mm/s","C" or "Km", it can be omitted.
    - The rest of the params will be always the same as the reference.
- `<rtu_read>`: Holds the rules of reading from sensors
  - `<rule>` attributes follows as:
    - `count`: is the number of holding registers this rule will add.
    - `localreg`: is the order number of the first register that the rule will include in the holding registers.
    - `name`: is the name of the rule, in our case will be the sensor name.
    - `remreg`: is the first address of the register, it respects the count. Example: if count is 2 and the first register is 17, it will add the registers address 17 and 18.

For our case, we can understand that the entire file is our controller, the `rtu_read` rules are the sensors of this controller, and the `local_regs` are the registers of the sensors, organized by order number.

The rest of the tags and configurations should be copied from the reference, no need to change.

### In case of ingesting a new XML file into the controller

The name of the file should ALWAYS be `WLConfig.xml` and follow the strict order of actions:

- Normalize line endings
  - Replace CR (0x0D) for `0x1E`
  - Replace LF (0x0A) for `0x1F`
- Send a `CMD1003` command to ensure no open files from interrupted sessions.
- Open the file for writing with `CMD1001 WLConfig.xml,1,<size_in_bytes>,0`
  - The parameter `1` indicates the writing operation.
  - The `<size_in_bytes>` should be the exact size of the file after the changes.
- Send the data
  - The file should be chunked in maximum 512bytes each.
  - Send the `CMD1002 <length>,<CRC>,<chunkIndex>,<data>`
    - `<length>` is the size in bytes of this specific chunk
    - `<crc>` is the checksum following the Modbus CRC method applied to the fragment data.
    - `<chunkIndex>` starts at 1 and increments after each sent chunk.
    - `<data>` chunk data.
- Close the file with `CMD1003`.
- After a success, the controller should reset automatically to startup the new configurations.

### Error Handling

- **Validation:** If the total size of bytes sent does not match the value reported in `CMD1001`, the controller will return the `IPC_PARAMS` error.
- **Memory:** If the file is too large for the available memory, the response to `CMD1001` will be `API_NO_MEMORY`.

## Testing

For testing with real controller, use the `192.168.1.1` at port `8844` fro HostAPI or `502` for Modbus RTU.

## References

- [Dowload and Upload XML Configuration](./references/controller-xml-getter-and-setter.md) - How to download and upload the XML from controller.
- [Controllers and Sensors CRUD operations](./references/controller-and-sensor-crud-operations.md) - How to manage the controllers and sensors CRUD operations.
- [Controllers and Sensors](./references/controllers-and-sensors.md) - Detailed Nexus behaviour for controllers and sensors.
