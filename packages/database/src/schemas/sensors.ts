import { integer, text } from "drizzle-orm/sqlite-core";
import { table } from "./base.js";
import { controllers } from "./controllers.js";

export const sensors = table("sensors", {
  controllerId: integer("controller_id")
    .references(() => controllers.id)
    .notNull(),
  name: text("name").notNull(),
  modbusId: integer("modbus_id").notNull(),
});
