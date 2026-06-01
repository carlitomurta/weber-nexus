import { integer, text } from "drizzle-orm/sqlite-core";
import { table } from "./base";
import { controllers } from "./controllers";

export const sensors = table("sensors", {
  controllerId: text("controller_id")
    .references(() => controllers.id)
    .notNull(),

  name: text("name").notNull(),

  modbusId: integer("modbus_id").notNull(),
});
