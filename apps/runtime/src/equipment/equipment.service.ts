import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  EquipmentRepository,
  SensorsRepository,
  type Equipment,
  type EquipmentStandardClassification,
  type EquipmentType,
  type EquipmentWrite,
  type NewEquipment,
  type NewSensorInstallation,
  type SensorInstallation,
  type Standard,
} from '@weber-nexus/repository';

type EquipmentFieldDefinition = EquipmentType['fieldDefinitions'][number];

export type EquipmentStandardClassificationView =
  EquipmentStandardClassification & {
    standard: Standard | null;
  };

export type EquipmentView = Equipment & {
  equipmentType: EquipmentType;
  sensorInstallations: SensorInstallation[];
  standardClassification: EquipmentStandardClassificationView | null;
};

type StandardSuggestion = {
  code: string;
  explanation: string;
};

const CURRENT_VIBRATION_STANDARD = 'ISO-20816-3:2022';
const ruleVersion = 1;
const allowedCriticalities = new Set(['low', 'medium', 'high', 'critical']);
const allowedOperationalStatuses = new Set([
  'active',
  'maintenance',
  'inactive',
  'removed',
]);

@Injectable()
export class EquipmentService {
  constructor(
    private readonly equipmentRepository: EquipmentRepository,
    private readonly sensorsRepository: SensorsRepository,
  ) {}

  getEquipmentTypes(): Promise<EquipmentType[]> {
    return this.equipmentRepository.findEquipmentTypes();
  }

  async getAllEquipment(): Promise<EquipmentView[]> {
    const records = await this.equipmentRepository.findAllEquipment();
    return this.buildEquipmentViews(records);
  }

  async getEquipmentById(id: number): Promise<EquipmentView> {
    const record = await this.getEquipmentRecord(id);
    const [view] = await this.buildEquipmentViews([record]);

    if (!view) {
      throw new NotFoundException(`Equipamento ${id} não foi encontrado`);
    }

    return view;
  }

  async createEquipment(input: NewEquipment): Promise<EquipmentView> {
    const equipmentType = await this.getEquipmentType(input.equipmentTypeId);
    const payload = this.validateEquipmentInput(input, equipmentType);
    const record = await this.equipmentRepository.insertEquipment(payload);

    await this.updateSuggestedStandard(record, equipmentType);

    return this.getEquipmentById(record.id);
  }

  async updateEquipment(input: EquipmentWrite): Promise<EquipmentView> {
    await this.getEquipmentRecord(input.id);

    const equipmentType = await this.getEquipmentType(input.equipmentTypeId);
    const payload = this.validateEquipmentInput(input, equipmentType);
    const record = await this.equipmentRepository.updateEquipment(payload);

    await this.updateSuggestedStandard(record, equipmentType);

    return this.getEquipmentById(record.id);
  }

  async deleteEquipment(id: number): Promise<Equipment> {
    const deleted = await this.equipmentRepository.deleteEquipment(id);

    if (!deleted) {
      throw new NotFoundException(`Equipamento ${id} não foi encontrado`);
    }

    return deleted;
  }

  async createSensorInstallation(
    input: NewSensorInstallation,
  ): Promise<EquipmentView> {
    await this.getEquipmentRecord(input.equipmentId);

    const sensor = await this.sensorsRepository.findById(input.sensorId);

    if (!sensor || sensor.deletedAt) {
      throw new NotFoundException(`Sensor ${input.sensorId} não foi encontrado`);
    }

    const activeInstallation =
      await this.equipmentRepository.findActiveInstallationBySensorId(
        input.sensorId,
      );

    if (activeInstallation) {
      throw new BadRequestException(
        'Sensor já possui vínculo ativo com outro equipamento',
      );
    }

    await this.equipmentRepository.insertSensorInstallation({
      ...input,
      position: input.position?.trim() || null,
      measurementAxis: input.measurementAxis?.trim() || null,
      notes: input.notes?.trim() || null,
    });

    return this.getEquipmentById(input.equipmentId);
  }

  async endSensorInstallation(
    id: number,
    endedAt: Date,
  ): Promise<EquipmentView> {
    const installation =
      await this.equipmentRepository.findSensorInstallationById(id);

    if (!installation) {
      throw new NotFoundException(`Instalação ${id} não foi encontrada`);
    }

    if (installation.endedAt) {
      throw new BadRequestException('Instalação já está encerrada');
    }

    if (endedAt < installation.installedAt) {
      throw new BadRequestException(
        'Data de encerramento deve ser posterior à instalação',
      );
    }

    await this.equipmentRepository.endSensorInstallation(id, endedAt);

    return this.getEquipmentById(installation.equipmentId);
  }

  async confirmStandardClassification(id: number): Promise<EquipmentView> {
    const record = await this.getEquipmentRecord(id);
    const classification =
      await this.equipmentRepository.confirmActiveClassification(id);

    if (!classification) {
      throw new BadRequestException(
        'Nenhuma sugestão de norma pendente para confirmar',
      );
    }

    return this.getEquipmentById(record.id);
  }

  private async buildEquipmentViews(
    records: Equipment[],
  ): Promise<EquipmentView[]> {
    const equipmentIds = records.map((record) => record.id);
    const equipmentTypes = await this.equipmentRepository.findEquipmentTypes();
    const installations =
      await this.equipmentRepository.findInstallationsByEquipmentIds(
        equipmentIds,
      );
    const classifications =
      await this.equipmentRepository.findActiveClassificationsByEquipmentIds(
        equipmentIds,
      );
    const standards = await this.equipmentRepository.findStandardsByIds(
      classifications.map((classification) => classification.standardId),
    );

    const typeById = new Map(equipmentTypes.map((type) => [type.id, type]));
    const standardById = new Map(standards.map((standard) => [standard.id, standard]));
    const classificationByEquipmentId = new Map(
      classifications.map((classification) => [
        classification.equipmentId,
        classification,
      ]),
    );

    return records.map((record) => {
      const equipmentType = typeById.get(record.equipmentTypeId);

      if (!equipmentType) {
        throw new NotFoundException(
          `Tipo do equipamento ${record.equipmentTypeId} não foi encontrado`,
        );
      }

      const classification = classificationByEquipmentId.get(record.id);

      return {
        ...record,
        equipmentType,
        sensorInstallations: installations.filter(
          (installation) => installation.equipmentId === record.id,
        ),
        standardClassification: classification
          ? {
              ...classification,
              standard: standardById.get(classification.standardId) ?? null,
            }
          : null,
      };
    });
  }

  private async getEquipmentRecord(id: number): Promise<Equipment> {
    const record = await this.equipmentRepository.findEquipmentById(id);

    if (!record || record.deletedAt) {
      throw new NotFoundException(`Equipamento ${id} não foi encontrado`);
    }

    return record;
  }

  private async getEquipmentType(id: number): Promise<EquipmentType> {
    const equipmentType = await this.equipmentRepository.findEquipmentTypeById(id);

    if (!equipmentType || !equipmentType.active) {
      throw new BadRequestException('Tipo de equipamento inválido');
    }

    return equipmentType;
  }

  private validateEquipmentInput<T extends NewEquipment | EquipmentWrite>(
    input: T,
    equipmentType: EquipmentType,
  ): T {
    this.assertAllowedValue(
      input.criticality,
      allowedCriticalities,
      'Criticidade inválida',
    );
    this.assertAllowedValue(
      input.operationalStatus,
      allowedOperationalStatuses,
      'Status operacional inválido',
    );

    return {
      ...input,
      name: input.name.trim(),
      tag: input.tag.trim(),
      manufacturer: input.manufacturer?.trim() || null,
      model: input.model?.trim() || null,
      serialNumber: input.serialNumber?.trim() || null,
      site: input.site?.trim() || null,
      area: input.area?.trim() || null,
      location: input.location?.trim() || null,
      specificAttributes: this.validateSpecificAttributes(
        input.specificAttributes,
        equipmentType.fieldDefinitions,
      ),
    };
  }

  private validateSpecificAttributes(
    attributes: NewEquipment['specificAttributes'],
    fields: EquipmentFieldDefinition[],
  ): NewEquipment['specificAttributes'] {
    const next: NewEquipment['specificAttributes'] = {};

    for (const field of fields) {
      const value = attributes[field.key];

      if (isMissingValue(value)) {
        if (field.required) {
          throw new BadRequestException(`${field.label} é obrigatório`);
        }

        next[field.key] = null;
        continue;
      }

      next[field.key] = this.validateSpecificAttribute(field, value);
    }

    return next;
  }

  private validateSpecificAttribute(
    field: EquipmentFieldDefinition,
    value: string | number | boolean,
  ): string | number | boolean {
    if (field.type === 'number') {
      const numericValue = Number(value);

      if (!Number.isFinite(numericValue)) {
        throw new BadRequestException(`${field.label} deve ser numérico`);
      }

      return numericValue;
    }

    if (field.type === 'boolean') {
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;

      throw new BadRequestException(`${field.label} deve ser verdadeiro ou falso`);
    }

    if (field.type === 'select') {
      if (typeof value !== 'string') {
        throw new BadRequestException(`${field.label} deve ser texto`);
      }

      const allowedValues = new Set(
        (field.options ?? []).map((option) => option.value),
      );

      if (!allowedValues.has(value)) {
        throw new BadRequestException(`${field.label} possui opção inválida`);
      }

      return value;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(`${field.label} deve ser texto`);
    }

    return value.trim();
  }

  private assertAllowedValue(
    value: string,
    allowedValues: ReadonlySet<string>,
    message: string,
  ): void {
    if (!allowedValues.has(value)) {
      throw new BadRequestException(message);
    }
  }

  private async updateSuggestedStandard(
    record: Equipment,
    equipmentType: EquipmentType,
  ): Promise<void> {
    const activeClassification =
      await this.equipmentRepository.findActiveClassificationByEquipmentId(
        record.id,
      );

    if (activeClassification?.status === 'confirmed') return;

    const suggestion = this.suggestStandard(record, equipmentType);

    if (!suggestion) {
      await this.equipmentRepository.supersedeSuggestedClassification(record.id);
      return;
    }

    const standard = await this.equipmentRepository.findStandardByCode(
      suggestion.code,
    );

    if (!standard) return;

    await this.equipmentRepository.replaceSuggestedClassification({
      equipmentId: record.id,
      standardId: standard.id,
      status: 'suggested',
      source: 'rule',
      explanation: suggestion.explanation,
      ruleVersion,
      classifiedAt: new Date(),
      confirmedAt: null,
    });
  }

  private suggestStandard(
    record: Equipment,
    equipmentType: EquipmentType,
  ): StandardSuggestion | null {
    const attributes = record.specificAttributes;
    const ratedPowerKw = numericAttribute(attributes.ratedPowerKw);
    const speedRpm =
      numericAttribute(attributes.nominalSpeedRpm) ??
      numericAttribute(attributes.inputSpeedRpm);

    if (
      ratedPowerKw === undefined ||
      speedRpm === undefined ||
      ratedPowerKw <= 15 ||
      !isSpeedInIso20816Range(speedRpm)
    ) {
      return null;
    }

    if (equipmentType.code === 'electric_motor') {
      return {
        code: CURRENT_VIBRATION_STANDARD,
        explanation:
          'Motor elétrico acima de 15 kW com rotação entre 120 rpm e 30000 rpm; ISO 20816-3 é a referência vigente para avaliação de vibração em máquinas industriais.',
      };
    }

    if (
      equipmentType.code === 'compressor' &&
      attributes.compressorType === 'rotary'
    ) {
      return {
        code: CURRENT_VIBRATION_STANDARD,
        explanation:
          'Compressor rotativo acima de 15 kW dentro da faixa de rotação da ISO 20816-3.',
      };
    }

    if (
      equipmentType.code === 'fan' &&
      (ratedPowerKw > 300 || attributes.supportType === 'rigid')
    ) {
      return {
        code: CURRENT_VIBRATION_STANDARD,
        explanation:
          'Ventilador/soprador industrial com potência ou suporte compatível com avaliação pela ISO 20816-3.',
      };
    }

    if (equipmentType.code === 'gearbox') {
      return {
        code: CURRENT_VIBRATION_STANDARD,
        explanation:
          'Redutor industrial dentro da faixa geral de máquinas cobertas pela ISO 20816-3; testes de aceitação podem exigir norma específica.',
      };
    }

    return null;
  }
}

function isMissingValue(value: unknown): value is undefined | null | '' {
  return value === undefined || value === null || value === '';
}

function numericAttribute(value: unknown): number | undefined {
  if (typeof value !== 'number') return undefined;
  return Number.isFinite(value) ? value : undefined;
}

function isSpeedInIso20816Range(speedRpm: number): boolean {
  return speedRpm >= 120 && speedRpm <= 30000;
}
