import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schemas/index.ts",
  out: "./migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: "./db/nexus.db",
  },
});
