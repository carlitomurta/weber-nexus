# Controller and Sensor CRUD operations

Guide for an AI agent to develop create/read/update/delete processes for controllers and sensors.

## Objective

- Get registered controllers from SQLite.
- Get registered sensors from SQLite.
- Create controllers and import it's configuration file.
- Create sensors and upload a new configuration file into it's controller.
- Edit controller and upload the new updated configuration.
- Edit sensor and upload the new updated configuration of it's controller.
- Delete controllers from SQLite. (soft delete).
- Delete sensors and upload the new updated configuration of it's controller.

## Rules

### Controller

Required fields:

- Name
- Ip address
- Model

#### Controller Create

When users requests to create a controller, we follow these steps:

1. Validate the required fields.
2. Use the IP address to connect to the phisical controller through modbus.
3. Import the XML Configuration file from the controller.
4. Read the XML and register all sensors and registers.
5. Start polling the values.

#### Controller Read

When user requests to see a controller, we should consult the SQLite database to retrieve the data.

#### Controller Update

Non-upload fields:

- Name
- Polling interval

When user requests an update on controller values, we should:

1. Validate the required fields.
2. Present the user a dialog to confirm the syncronization only if the changed fields are not or partially present on non-upload fields.
3. Update the XML configuration file first.
4. Upload it to the phisical controller.
5. If controller return success, we finally change the data on SQLite, otherwise the operation is cancelled.
6. Reset/Reboot the controller.

#### Controller Delete

The delete should present a confirmation dialog for the user to warn about this operation.

The deletion should not remove or upload a new configuration to the controller. It should only soft-delete from SQLite.

---

### Sensor

A sensor is always attached to a controller, the sensor is a group of registers.

Required fields:

- Name
- NodeId (on UI "ID do sensor")
- At least 1 register.

#### Sensor Create

When user requests to create a new sensor on a controller, we should:

1. Validate the required fields.
2. Present the user a dialog to confirm the creation and syncronization.
3. Update the XML configuration file first.
4. Upload it to the phisical controller.
5. If controller return success, we finally change the data on SQLite, otherwise the operation is cancelled.
6. Reset/Reboot the controller.

#### Sensor Read

When user requests to see a sensor, we should consult the SQLite database to retrieve the all data.

#### Sensor Update

Non-upload fields:

- Model
- Location
- Description

When user requests an update on sensor values, we should:

1. Validate the required fields.
2. Present the user a dialog to confirm the syncronization only if the changed fields are not or partially present on non-upload fields.
3. Update the XML configuration file first.
4. Upload it to the phisical controller.
5. If controller return success, we finally change the data on SQLite, otherwise the operation is cancelled.
6. Reset/Reboot the controller.

#### Sensor Delete

The delete should present a confirmation dialog for the user to warn about this operation.

For sensors, we need to syncronize, so present also a confirmation dialog for syncronization.

If confirmed:

1. Update the XML configuration file first.
2. Upload it to the phisical controller.
3. If controller return success, we finally change the data on SQLite, otherwise the operation is cancelled.

---

### Sensor Register

A sensor register is where the data from controller is get, we need them to mark what the numbers returned from the controller means.

A register need to follow a very strict formula: (NodeId \* 16) where nodeId is the nodeId of the sensor where the register is attached.

For example: Node ID = 1 can only have registers address from 17 to 32.

Whe can create multiple sensors with same NodeID, but never the Node should have duplicate register addresses or surpass the formula.

For example: sensor 1 = Node ID = 1 with registers 17,18,19,20 and sensor 2 = Node ID = 1 with registers 20,21,22. This should NEVER happen cause it's a case of surpass and should be validated.
