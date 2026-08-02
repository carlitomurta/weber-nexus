import { z } from "zod";

export const equipmentAttributeValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const equipmentFieldOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const equipmentFieldDefinitionSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(["text", "number", "select", "boolean"]),
  unit: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(equipmentFieldOptionSchema).optional(),
});

export const equipmentTypeSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  version: z.number(),
  fieldDefinitions: z.array(equipmentFieldDefinitionSchema),
  active: z.boolean(),
  createdAt: z.coerce.date().nullish(),
  updatedAt: z.coerce.date().nullish(),
});

export const sensorInstallationSchema = z.object({
  id: z.number(),
  equipmentId: z.number(),
  sensorId: z.number(),
  installedAt: z.coerce.date(),
  endedAt: z.coerce.date().nullable(),
  position: z.string().nullable(),
  measurementAxis: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date().nullish(),
  updatedAt: z.coerce.date().nullish(),
});

export const standardSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  family: z.string(),
  status: z.string(),
  scope: z.string().nullable(),
  version: z.number(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.coerce.date().nullish(),
  updatedAt: z.coerce.date().nullish(),
});

export const equipmentStandardClassificationSchema = z.object({
  id: z.number(),
  equipmentId: z.number(),
  standardId: z.number(),
  status: z.string(),
  source: z.string(),
  explanation: z.string(),
  ruleVersion: z.number(),
  classifiedAt: z.coerce.date(),
  confirmedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date().nullish(),
  updatedAt: z.coerce.date().nullish(),
  standard: standardSchema.nullable(),
});

export const equipmentSchema = z.object({
  id: z.number(),
  equipmentTypeId: z.number(),
  name: z.string(),
  tag: z.string(),
  manufacturer: z.string().nullable(),
  model: z.string().nullable(),
  serialNumber: z.string().nullable(),
  site: z.string().nullable(),
  area: z.string().nullable(),
  location: z.string().nullable(),
  criticality: z.string(),
  operationalStatus: z.string(),
  specificAttributes: z.record(z.string(), equipmentAttributeValueSchema),
  deletedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date().nullish(),
  updatedAt: z.coerce.date().nullish(),
  equipmentType: equipmentTypeSchema,
  sensorInstallations: z.array(sensorInstallationSchema),
  standardClassification: equipmentStandardClassificationSchema.nullable(),
});

export const equipmentTypesSchema = z.array(equipmentTypeSchema);
export const equipmentListSchema = z.array(equipmentSchema);

export type EquipmentAttributeValue = z.infer<
  typeof equipmentAttributeValueSchema
>;
export type EquipmentFieldDefinition = z.infer<
  typeof equipmentFieldDefinitionSchema
>;
export type EquipmentType = z.infer<typeof equipmentTypeSchema>;
export type SensorInstallation = z.infer<typeof sensorInstallationSchema>;
export type Equipment = z.infer<typeof equipmentSchema>;
export type EquipmentWrite = Omit<
  Equipment,
  | "createdAt"
  | "updatedAt"
  | "equipmentType"
  | "sensorInstallations"
  | "standardClassification"
>;
export type CreateEquipmentInput = Omit<EquipmentWrite, "id">;
export type CreateSensorInstallationInput = {
  sensorId: number;
  installedAt?: string;
  position?: string | null;
  measurementAxis?: string | null;
  notes?: string | null;
};
