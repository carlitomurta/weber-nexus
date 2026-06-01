import { text } from "drizzle-orm/sqlite-core";
import { table } from "./base";

export const users = table("users", {
  name: text("name").notNull(),

  email: text("email").notNull().unique(),

  passwordHash: text("password_hash").notNull(),

  role: text("role").notNull(),
});
