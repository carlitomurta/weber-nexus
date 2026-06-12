---
name: controller-xml-getter-and-setter
description: "Guide for an AI agent to develop a reader and validator of an XML configuration file obtained via Modbus connection on port 8844 of a controller. Also, develop a creator and validator of the XML configuration file when any changes are made to the page settings registration (add/edit/remove - controller or sensor)."
metadata:
  author: Carlito Murta
  version: "1.0"
  domain: development
  type: utility
  mode: assistive
---

# Objective

Get and Create a XML configuration file for controllers.
Always validating if the get/created file is valid.

## Stack

- fast-xml-parser (Package to validate/read/edit and parse XML files)

## Rules

This is how the configuration XML file works:
Use this [WLConfig](../packages/local_test/temp/WLConfig.xml) XML as an reference of a valid config XML.

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

### Important details

- **Validation:** If the total size of bytes sent does not match the value reported in `CMD1001`, the driver will return the `IPC_PARAMS` error on shutdown.
- **Memory:** If the file is too large for the available memory, the response to `CMD1001` will be `API_NO_MEMORY`.
- **Confirmation:** After restarting, you can verify if the new configuration was accepted by sending a push command or reading the virtual register `10101`, which indicates the successful reading of the configured maps.
- **Debugging:** Log all errors in logger, we will implement a log file system later.

## Development guide

Implement a function that connects to a controller over TCP, downloads WLConfig.xml using the controller file transfer command protocol, cleans the raw response, parses the XML and validate if this controller configuration already exists in our database, if not, it should add it.
Also, when the controller/sensor is editted, prompt in the UI a confirmation for saving the new configuration will reset the controller, if confirmed, it should create a new XML configuration file with the new configuration and upload it to the controller.

### Steps

1. Connect to controller using port 8844 (eg: "192.168.1.1:8844")
2. Request the file using the command: `CMD1001 WLConfig.xml,0,0,0\r\n`
3. Download the file chunk-by-chunk using: `CMD1002 <chunkId>\r\n`
4. Stop downloading when the response contains: `EOF`
5. Send the finish command: `CMD1003\r\n`
6. Clean the raw file response into valid XML. reference:[XML Cleaning Rules](#xml-cleaning-rules)
7. Parse the XML into JSON.
8. If any error occurs in any phase, trigger an toast on UI and log it. reference: [Error Handling](#error-handling-requirements)

## XML Cleaning Rules

The cleaning should:

1. Remove the EOF marker

2. Remove all RSP1002 chunk headers
   - The chunk header follow this format: `RSP1002<chunkNumber>,<hexChecksum>,`

3. Remove invalid control characters
   - Suggested regex: `/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g`

4. Trim everything before XML declaration
   - Find: `<?xml` if found, slice from that point.

5. Trim everything after closing configuration tag
   - Find the last occurrence of: `</configuration>` if found, slice until the end of that tag.

6. Normalize line endings
   - Convert all line endings to `\n`

7. Reduce excessive blank lines

8. Return trimmed XML

## Error Handling Requirements

The implementation must reject when:

1. The connection emits an error.
2. The first response is not a valid `RSP1001` response.
3. XML parsing fails.
4. The connection times out.
5. XML controller ingestion failed.

## Important Implementation Details

The agent must avoid these issues:

1. Do not parse the raw TCP response directly.
2. Do not ignore XML attributes.
3. Do not parse to JSON unless the XML was successfully cleaned and parsed.
4. Do not continue requesting chunks after `EOF`.
5. Do not use any unless absolutely necessary.

## Tests

Create unit tests for all functions.
