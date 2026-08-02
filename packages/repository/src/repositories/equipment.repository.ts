import { Inject, Injectable } from "@nestjs/common";
import {
  equipment,
  equipmentStandardClassifications,
  equipmentTypes,
  sensorInstallations,
  standards,
  type Database,
} from "@weber-nexus/database";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { DB_TOKEN } from "../database.constants.js";

export type EquipmentType = typeof equipmentTypes.$inferSelect;
export type Equipment = typeof equipment.$inferSelect;
export type EquipmentWrite = Omit<Equipment, "createdAt" | "updatedAt">;
export type NewEquipment = Omit<EquipmentWrite, "id">;
export type SensorInstallation = typeof sensorInstallations.$inferSelect;
export type NewSensorInstallation = Omit<
  SensorInstallation,
  "id" | "createdAt" | "updatedAt"
>;
export type Standard = typeof standards.$inferSelect;
export type EquipmentStandardClassification =
  typeof equipmentStandardClassifications.$inferSelect;
export type NewEquipmentStandardClassification = Omit<
  EquipmentStandardClassification,
  "id" | "createdAt" | "updatedAt"
>;

@Injectable()
export class EquipmentRepository {
  constructor(@Inject(DB_TOKEN) private readonly db: Database) {}

  async findEquipmentTypes(): Promise<EquipmentType[]> {
    return this.db
      .select()
      .from(equipmentTypes)
      .where(eq(equipmentTypes.active, true));
  }

  async findEquipmentTypeById(id: number): Promise<EquipmentType | undefined> {
    const [type] = await this.db
      .select()
      .from(equipmentTypes)
      .where(eq(equipmentTypes.id, id));

    return type;
  }

  async findAllEquipment(): Promise<Equipment[]> {
    return this.db.select().from(equipment).where(isNull(equipment.deletedAt));
  }

  async findEquipmentById(id: number): Promise<Equipment | undefined> {
    const [record] = await this.db
      .select()
      .from(equipment)
      .where(eq(equipment.id, id));

    return record;
  }

  async insertEquipment(input: NewEquipment): Promise<Equipment> {
    const [record] = await this.db.insert(equipment).values(input).returning();
    return record;
  }

  async updateEquipment(input: EquipmentWrite): Promise<Equipment> {
    const { id, ...data } = input;
    const [record] = await this.db
      .update(equipment)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(equipment.id, id))
      .returning();

    return record;
  }

  async deleteEquipment(id: number): Promise<Equipment | undefined> {
    const [record] = await this.db
      .update(equipment)
      .set({
        deletedAt: new Date(),
        operationalStatus: "removed",
        updatedAt: new Date(),
      })
      .where(eq(equipment.id, id))
      .returning();

    return record;
  }

  async findInstallationsByEquipmentIds(
    equipmentIds: ReadonlyArray<number>,
  ): Promise<SensorInstallation[]> {
    if (equipmentIds.length === 0) return [];

    return this.db
      .select()
      .from(sensorInstallations)
      .where(inArray(sensorInstallations.equipmentId, [...equipmentIds]));
  }

  async findInstallationsByEquipmentId(
    equipmentId: number,
  ): Promise<SensorInstallation[]> {
    return this.db
      .select()
      .from(sensorInstallations)
      .where(eq(sensorInstallations.equipmentId, equipmentId));
  }

  async findActiveInstallationBySensorId(
    sensorId: number,
  ): Promise<SensorInstallation | undefined> {
    const [record] = await this.db
      .select()
      .from(sensorInstallations)
      .where(
        and(
          eq(sensorInstallations.sensorId, sensorId),
          isNull(sensorInstallations.endedAt),
        ),
      );

    return record;
  }

  async insertSensorInstallation(
    input: NewSensorInstallation,
  ): Promise<SensorInstallation> {
    const [record] = await this.db
      .insert(sensorInstallations)
      .values(input)
      .returning();

    return record;
  }

  async endSensorInstallation(
    id: number,
    endedAt: Date,
  ): Promise<SensorInstallation | undefined> {
    const [record] = await this.db
      .update(sensorInstallations)
      .set({ endedAt, updatedAt: new Date() })
      .where(eq(sensorInstallations.id, id))
      .returning();

    return record;
  }

  async findStandardByCode(code: string): Promise<Standard | undefined> {
    const [record] = await this.db
      .select()
      .from(standards)
      .where(eq(standards.code, code));

    return record;
  }

  async findStandardsByIds(
    standardIds: ReadonlyArray<number>,
  ): Promise<Standard[]> {
    if (standardIds.length === 0) return [];

    return this.db
      .select()
      .from(standards)
      .where(inArray(standards.id, [...standardIds]));
  }

  async findSensorInstallationById(
    id: number,
  ): Promise<SensorInstallation | undefined> {
    const [record] = await this.db
      .select()
      .from(sensorInstallations)
      .where(eq(sensorInstallations.id, id));

    return record;
  }

  async findActiveClassificationsByEquipmentIds(
    equipmentIds: ReadonlyArray<number>,
  ): Promise<EquipmentStandardClassification[]> {
    if (equipmentIds.length === 0) return [];

    return this.db
      .select()
      .from(equipmentStandardClassifications)
      .where(
        and(
          inArray(equipmentStandardClassifications.equipmentId, [
            ...equipmentIds,
          ]),
          inArray(equipmentStandardClassifications.status, [
            "suggested",
            "confirmed",
          ]),
        ),
      );
  }

  async findActiveClassificationByEquipmentId(
    equipmentId: number,
  ): Promise<EquipmentStandardClassification | undefined> {
    const [record] = await this.db
      .select()
      .from(equipmentStandardClassifications)
      .where(
        and(
          eq(equipmentStandardClassifications.equipmentId, equipmentId),
          inArray(equipmentStandardClassifications.status, [
            "suggested",
            "confirmed",
          ]),
        ),
      );

    return record;
  }

  async replaceSuggestedClassification(
    input: NewEquipmentStandardClassification,
  ): Promise<EquipmentStandardClassification> {
    await this.db
      .update(equipmentStandardClassifications)
      .set({ status: "superseded", updatedAt: new Date() })
      .where(
        and(
          eq(equipmentStandardClassifications.equipmentId, input.equipmentId),
          eq(equipmentStandardClassifications.status, "suggested"),
        ),
      )
      .run();

    const [record] = await this.db
      .insert(equipmentStandardClassifications)
      .values(input)
      .returning();

    return record;
  }

  async supersedeSuggestedClassification(equipmentId: number): Promise<void> {
    await this.db
      .update(equipmentStandardClassifications)
      .set({ status: "superseded", updatedAt: new Date() })
      .where(
        and(
          eq(equipmentStandardClassifications.equipmentId, equipmentId),
          eq(equipmentStandardClassifications.status, "suggested"),
        ),
      )
      .run();
  }

  async confirmActiveClassification(
    equipmentId: number,
  ): Promise<EquipmentStandardClassification | undefined> {
    const [record] = await this.db
      .update(equipmentStandardClassifications)
      .set({
        status: "confirmed",
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(equipmentStandardClassifications.equipmentId, equipmentId),
          eq(equipmentStandardClassifications.status, "suggested"),
        ),
      )
      .returning();

    return record;
  }
}
