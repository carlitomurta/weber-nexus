---
name: fix-xml-upload-to-controller
description: "Guide for an AI agent to upload a XML config file into controller file transfer protocol at port 8844."
metadata:
  author: Carlito Murta
  version: "1.0"
  domain: development
  type: task
---

# Objective/Goal

Upload a XML configuration file into a controller successfully.

## To achieve the goal

Connect to the controller at ip: 192.168.1.1 at port 8844, when connection is success, follow these [steps](#steps-to-upload-the-xml-config-file-to-a-controller) and retry with a search on the web about "Banner DXM controller documentation" if any of the [known issues](#known-issues) are returned.

After the upload is successfull, the controller will restart, after restarting, you can verify if the new configuration was accepted by sending a push command or reading the virtual register `10101`, which indicates the successful reading of the configured maps.
Retry if it indicates fails.

## Stack

- crc (Package to create the CRC modbus 16bits)
- fast-xml-parser (Package to validate/read/edit and parse XML files)

## Steps to upload the XML config file to a controller

The name of the file should ALWAYS be `WLConfig.xml` and follow the strict order of actions:

- Normalize line endings
  - Replace CR (0x0D) for `0x1E`
  - Replace LF (0x0A) for `0x1F`
- Send a `CMD1003` command to ensure no open files from interrupted sessions (if not done, this can cause error IPC_PARAMS return from controller).
- Open the file for writing with `CMD1001 WLConfig.xml,1,<size_in_bytes>,0`
  - The parameter `1` indicates the writing operation.
  - The `<size_in_bytes>` should be the exact size of the file after the changes.
- Send the data
  - The file should be chunked in maximum 512bytes each.
  - Send the `CMD1002 <length>,<CRC>,<chunkIndex>,<data>`
    - `<length>` is the size in bytes of this specific chunk
    - `<crc>` is the checksum following the Modbus CRC-16 method applied to the fragment data, use the crc package to do it.
    - `<chunkIndex>` starts at 1 and increments after each sent chunk.
    - `<data>` chunk data.
- Close the file with `CMD1003`.
- After a success, the controller should reset automatically to startup the new configurations.

### Known issues

- **Validation:** If the total size of bytes sent does not match the value reported in `CMD1001`, the driver will return the `IPC_PARAMS` error on shutdown.
- **Memory:** If the file is too large for the available memory, the response to `CMD1001` will be `API_NO_MEMORY`.
