import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { id, table, timestamps } from "./base.js";
import { sensors } from "./sensors.js";

export type EquipmentFieldOption = {
  label: string;
  value: string;
};

export type EquipmentFieldDefinition = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "boolean";
  unit?: string;
  required?: boolean;
  options?: EquipmentFieldOption[];
};

export type EquipmentSpecificAttributes = Record<
  string,
  string | number | boolean | null
>;

export type StandardRuleMetadata = {
  appliesToEquipmentTypes?: string[];
  legacyCodes?: string[];
};

export const equipmentTypes = table("equipment_types", {
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  version: integer("version").notNull().default(1),
  fieldDefinitions: text("field_definitions", { mode: "json" })
    .notNull()
    .$type<EquipmentFieldDefinition[]>()
    .default(sql`'[]'`),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const equipment = table("equipment", {
  equipmentTypeId: integer("equipment_type_id")
    .references(() => equipmentTypes.id)
    .notNull(),
  name: text("name").notNull(),
  tag: text("tag").notNull(),
  manufacturer: text("manufacturer"),
  model: text("model"),
  serialNumber: text("serial_number"),
  site: text("site"),
  area: text("area"),
  location: text("location"),
  criticality: text("criticality").notNull().default("medium"),
  operationalStatus: text("operational_status").notNull().default("active"),
  specificAttributes: text("specific_attributes", { mode: "json" })
    .notNull()
    .$type<EquipmentSpecificAttributes>()
    .default(sql`'{}'`),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export const sensorInstallations = sqliteTable(
  "sensor_installations",
  {
    ...id,
    equipmentId: integer("equipment_id")
      .references(() => equipment.id)
      .notNull(),
    sensorId: integer("sensor_id")
      .references(() => sensors.id)
      .notNull(),
    installedAt: integer("installed_at", { mode: "timestamp_ms" }).notNull(),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    position: text("position"),
    measurementAxis: text("measurement_axis"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("sensor_installations_active_sensor_idx")
      .on(table.sensorId)
      .where(sql`ended_at IS NULL`),
  ],
);

export const standards = table("standards", {
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  family: text("family").notNull(),
  status: text("status").notNull(),
  scope: text("scope"),
  version: integer("version").notNull().default(1),
  metadata: text("metadata", { mode: "json" })
    .notNull()
    .$type<StandardRuleMetadata>()
    .default(sql`'{}'`),
});

export const equipmentStandardClassifications = sqliteTable(
  "equipment_standard_classifications",
  {
    ...id,
    equipmentId: integer("equipment_id")
      .references(() => equipment.id)
      .notNull(),
    standardId: integer("standard_id")
      .references(() => standards.id)
      .notNull(),
    status: text("status").notNull().default("suggested"),
    source: text("source").notNull().default("rule"),
    explanation: text("explanation").notNull(),
    ruleVersion: integer("rule_version").notNull().default(1),
    classifiedAt: integer("classified_at", { mode: "timestamp_ms" }).notNull(),
    confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("equipment_standard_active_idx")
      .on(table.equipmentId)
      .where(sql`status IN ('suggested', 'confirmed')`),
  ],
);

export const equipmentTables = {
  equipmentTypes,
  equipment,
  sensorInstallations,
  standards,
  equipmentStandardClassifications,
};
