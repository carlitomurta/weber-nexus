import { createFileRoute } from "@tanstack/react-router";
import {
  BadgeCheck,
  Boxes,
  Link2,
  Plus,
  Save,
  Trash2,
  Unlink,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageTitle } from "@/components/shared/PageTitle";
import { Field, inputCls } from "@/features/settings/form-controls";
import {
  useConfirmEquipmentStandardClassification,
  useCreateEquipment,
  useCreateSensorInstallation,
  useDeleteEquipment,
  useEndSensorInstallation,
  useEquipment,
  useEquipmentTypes,
  useUpdateEquipment,
} from "@/hooks/react-query/useEquipment";
import { useSensors } from "@/hooks/react-query/useSensors";
import { apiErrorMessage } from "@/lib/api";

import type {
  CreateEquipmentInput,
  Equipment,
  EquipmentAttributeValue,
  EquipmentFieldDefinition,
  EquipmentType,
  EquipmentWrite,
  SensorInstallation,
} from "../../../types/equipment.type";
import type { Sensor } from "../../../types/sensors.type";

export const Route = createFileRoute("/_auth/equipment/")({
  head: () => ({ meta: [{ title: "Equipamentos" }] }),
  component: EquipmentPage,
});

type EquipmentDraft = {
  equipmentTypeId: number;
  name: string;
  tag: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  site: string;
  area: string;
  location: string;
  criticality: string;
  operationalStatus: string;
  specificAttributes: Record<string, EquipmentAttributeValue>;
};

type InstallationDraft = {
  sensorId: number | "";
  position: string;
  measurementAxis: string;
  notes: string;
};

const emptyEquipment: Equipment[] = [];
const emptyEquipmentTypes: EquipmentType[] = [];
const emptySensors: Sensor[] = [];
const criticalityOptions = [
  { label: "Baixa", value: "low" },
  { label: "Média", value: "medium" },
  { label: "Alta", value: "high" },
  { label: "Crítica", value: "critical" },
];
const statusOptions = [
  { label: "Ativo", value: "active" },
  { label: "Manutenção", value: "maintenance" },
  { label: "Inativo", value: "inactive" },
];

function EquipmentPage() {
  const equipmentQuery = useEquipment();
  const equipmentTypesQuery = useEquipmentTypes();
  const sensorsQuery = useSensors();
  const equipment = equipmentQuery.data ?? emptyEquipment;
  const equipmentTypes = equipmentTypesQuery.data ?? emptyEquipmentTypes;
  const sensors = sensorsQuery.data ?? emptySensors;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(true);
  const [draft, setDraft] = useState<EquipmentDraft>(() =>
    emptyDraft(equipmentTypes[0]?.id ?? 0),
  );
  const [installationDraft, setInstallationDraft] =
    useState<InstallationDraft>({
      sensorId: "",
      position: "",
      measurementAxis: "",
      notes: "",
    });

  const createEquipment = useCreateEquipment();
  const updateEquipment = useUpdateEquipment();
  const deleteEquipment = useDeleteEquipment();
  const createInstallation = useCreateSensorInstallation(selectedId);
  const endInstallation = useEndSensorInstallation();
  const confirmClassification = useConfirmEquipmentStandardClassification();

  const selectedEquipment =
    equipment.find((item) => item.id === selectedId) ?? null;
  const selectedType =
    equipmentTypes.find((item) => item.id === draft.equipmentTypeId) ?? null;
  const activeSensorIds = useMemo(() => activeInstalledSensorIds(equipment), [
    equipment,
  ]);
  const availableSensors = sensors.filter(
    (sensor) => !activeSensorIds.has(sensor.id),
  );
  const isLoading =
    equipmentQuery.isLoading ||
    equipmentTypesQuery.isLoading ||
    sensorsQuery.isLoading;
  const isError =
    equipmentQuery.isError ||
    equipmentTypesQuery.isError ||
    sensorsQuery.isError;

  useEffect(() => {
    if (equipmentTypes.length > 0 && draft.equipmentTypeId === 0) {
      setDraft(emptyDraft(equipmentTypes[0].id));
    }
  }, [draft.equipmentTypeId, equipmentTypes]);

  function startCreate() {
    setSelectedId(null);
    setIsCreating(true);
    setDraft(emptyDraft(equipmentTypes[0]?.id ?? 0));
    setInstallationDraft(emptyInstallationDraft());
  }

  function selectEquipment(item: Equipment) {
    setSelectedId(item.id);
    setIsCreating(false);
    setDraft(draftFromEquipment(item));
    setInstallationDraft(emptyInstallationDraft());
  }

  function changeType(equipmentTypeId: number) {
    const type = equipmentTypes.find((item) => item.id === equipmentTypeId);

    setDraft((current) => ({
      ...current,
      equipmentTypeId,
      specificAttributes: defaultAttributes(type),
    }));
  }

  function saveEquipment() {
    if (!draft.name.trim() || !draft.tag.trim()) {
      toast.error("Informe nome e tag do equipamento.");
      return;
    }

    const payload = equipmentPayload(draft);

    if (isCreating) {
      createEquipment.mutate(payload, {
        onSuccess: (created) => {
          setSelectedId(created.id);
          setIsCreating(false);
          setDraft(draftFromEquipment(created));
          toast.success("Equipamento cadastrado.");
        },
        onError: (error) =>
          toast.error(
            apiErrorMessage(error, "Não foi possível cadastrar equipamento."),
          ),
      });
      return;
    }

    if (!selectedEquipment) return;

    const update: EquipmentWrite = {
      id: selectedEquipment.id,
      ...payload,
    };

    updateEquipment.mutate(update, {
      onSuccess: (updated) => {
        setDraft(draftFromEquipment(updated));
        toast.success("Equipamento atualizado.");
      },
      onError: (error) =>
        toast.error(
          apiErrorMessage(error, "Não foi possível atualizar equipamento."),
        ),
    });
  }

  function removeSelectedEquipment() {
    if (!selectedEquipment) return;

    if (!window.confirm(`Remover "${selectedEquipment.name}"?`)) return;

    deleteEquipment.mutate(selectedEquipment.id, {
      onSuccess: () => {
        startCreate();
        toast.success("Equipamento removido.");
      },
      onError: (error) =>
        toast.error(
          apiErrorMessage(error, "Não foi possível remover equipamento."),
        ),
    });
  }

  function addSensorInstallation() {
    if (!selectedEquipment || installationDraft.sensorId === "") {
      toast.error("Selecione um sensor para vincular.");
      return;
    }

    createInstallation.mutate(
      {
        sensorId: installationDraft.sensorId,
        position: installationDraft.position,
        measurementAxis: installationDraft.measurementAxis,
        notes: installationDraft.notes,
      },
      {
        onSuccess: (updated) => {
          setSelectedId(updated.id);
          setInstallationDraft(emptyInstallationDraft());
          toast.success("Sensor vinculado ao equipamento.");
        },
        onError: (error) =>
          toast.error(
            apiErrorMessage(error, "Não foi possível vincular o sensor."),
          ),
      },
    );
  }

  function endSensorLink(installationId: number) {
    endInstallation.mutate(installationId, {
      onSuccess: () => toast.success("Vínculo encerrado."),
      onError: (error) =>
        toast.error(
          apiErrorMessage(error, "Não foi possível encerrar o vínculo."),
        ),
    });
  }

  function confirmStandard() {
    if (!selectedEquipment) return;

    confirmClassification.mutate(selectedEquipment.id, {
      onSuccess: (updated) => {
        setSelectedId(updated.id);
        toast.success("Norma confirmada.");
      },
      onError: (error) =>
        toast.error(
          apiErrorMessage(error, "Não foi possível confirmar a norma."),
        ),
    });
  }

  return (
    <>
      <PageTitle
        page="Manutenção preventiva"
        title="Equipamentos"
        subtitle={`${equipment.length} equipamentos cadastrados · ${activeSensorIds.size} sensores vinculados`}
      />
      <hr />

      {isLoading ? (
        <RouteState message="Carregando equipamentos..." />
      ) : isError ? (
        <RouteState message="Não foi possível carregar equipamentos." />
      ) : (
        <div className="grid grid-cols-12 gap-5">
          <section className="col-span-4 min-w-0">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
                Ativos monitorados
              </div>
              <button
                onClick={startCreate}
                className="inline-flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="size-3" /> Novo
              </button>
            </div>

            {equipment.length === 0 ? (
              <RouteState message="Nenhum equipamento cadastrado." />
            ) : (
              <div className="space-y-2">
                {equipment.map((item) => (
                  <EquipmentListItem
                    key={item.id}
                    equipment={item}
                    active={item.id === selectedId}
                    onSelect={() => selectEquipment(item)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="col-span-8 min-w-0 space-y-4">
            <div className="rounded-lg border border-border bg-card/60">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-primary">
                    {isCreating ? "Novo equipamento" : "Editar equipamento"}
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {draft.name || "Cadastro técnico"}
                  </div>
                </div>
                {!isCreating ? (
                  <button
                    onClick={removeSelectedEquipment}
                    className="inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3" /> Remover
                  </button>
                ) : null}
              </div>

              <div className="space-y-4 p-4">
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Tipo">
                    <select
                      className={inputCls}
                      value={draft.equipmentTypeId}
                      onChange={(event) => changeType(Number(event.target.value))}
                    >
                      {equipmentTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Nome">
                    <input
                      className={inputCls}
                      value={draft.name}
                      onChange={(event) =>
                        setDraft({ ...draft, name: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Tag / código">
                    <input
                      className={`${inputCls} font-mono`}
                      value={draft.tag}
                      onChange={(event) =>
                        setDraft({ ...draft, tag: event.target.value })
                      }
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Field label="Fabricante">
                    <input
                      className={inputCls}
                      value={draft.manufacturer}
                      onChange={(event) =>
                        setDraft({ ...draft, manufacturer: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Modelo">
                    <input
                      className={inputCls}
                      value={draft.model}
                      onChange={(event) =>
                        setDraft({ ...draft, model: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Número de série">
                    <input
                      className={`${inputCls} font-mono`}
                      value={draft.serialNumber}
                      onChange={(event) =>
                        setDraft({ ...draft, serialNumber: event.target.value })
                      }
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Field label="Planta">
                    <input
                      className={inputCls}
                      value={draft.site}
                      onChange={(event) =>
                        setDraft({ ...draft, site: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Área">
                    <input
                      className={inputCls}
                      value={draft.area}
                      onChange={(event) =>
                        setDraft({ ...draft, area: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Localização">
                    <input
                      className={inputCls}
                      value={draft.location}
                      onChange={(event) =>
                        setDraft({ ...draft, location: event.target.value })
                      }
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Field label="Criticidade">
                    <select
                      className={inputCls}
                      value={draft.criticality}
                      onChange={(event) =>
                        setDraft({ ...draft, criticality: event.target.value })
                      }
                    >
                      {criticalityOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Status operacional">
                    <select
                      className={inputCls}
                      value={draft.operationalStatus}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          operationalStatus: event.target.value,
                        })
                      }
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <SpecificFields
                  type={selectedType}
                  attributes={draft.specificAttributes}
                  onChange={(key, value) =>
                    setDraft({
                      ...draft,
                      specificAttributes: {
                        ...draft.specificAttributes,
                        [key]: value,
                      },
                    })
                  }
                />
              </div>

              <div className="flex justify-end border-t border-border px-4 py-3">
                <button
                  onClick={saveEquipment}
                  className="inline-flex h-9 items-center gap-1.5 rounded bg-primary px-4 text-xs text-primary-foreground hover:bg-primary/90"
                >
                  <Save className="size-3.5" /> Salvar equipamento
                </button>
              </div>
            </div>

            {selectedEquipment ? (
              <>
                <StandardPanel
                  equipment={selectedEquipment}
                  onConfirm={confirmStandard}
                />
                <SensorInstallationsPanel
                  equipment={selectedEquipment}
                  sensors={sensors}
                  availableSensors={availableSensors}
                  draft={installationDraft}
                  onDraftChange={setInstallationDraft}
                  onAdd={addSensorInstallation}
                  onEnd={endSensorLink}
                />
              </>
            ) : null}
          </section>
        </div>
      )}
    </>
  );
}

function EquipmentListItem({
  equipment,
  active,
  onSelect,
}: {
  equipment: Equipment;
  active: boolean;
  onSelect: () => void;
}) {
  const activeInstallations = equipment.sensorInstallations.filter(
    (installation) => !installation.endedAt,
  );

  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${
        active
          ? "border-primary bg-primary/10"
          : "border-border bg-card/60 hover:border-primary/50"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="grid size-9 shrink-0 place-items-center rounded bg-background text-primary">
          <Boxes className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{equipment.name}</div>
          <div className="mt-0.5 truncate text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
            {equipment.tag} · {equipment.equipmentType.name}
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>{criticalityLabel(equipment.criticality)}</span>
            <span>{activeInstallations.length} sensores</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function SpecificFields({
  type,
  attributes,
  onChange,
}: {
  type: EquipmentType | null;
  attributes: Record<string, EquipmentAttributeValue>;
  onChange: (key: string, value: EquipmentAttributeValue) => void;
}) {
  if (!type || type.fieldDefinitions.length === 0) {
    return (
      <div className="rounded border border-border bg-background/40 p-4 text-xs text-muted-foreground">
        Tipo sem campos específicos.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
        <Wrench className="size-3" /> Campos específicos · {type.name}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {type.fieldDefinitions.map((field) => (
          <SpecificField
            key={field.key}
            field={field}
            value={attributes[field.key] ?? ""}
            onChange={(value) => onChange(field.key, value)}
          />
        ))}
      </div>
    </div>
  );
}

function SpecificField({
  field,
  value,
  onChange,
}: {
  field: EquipmentFieldDefinition;
  value: EquipmentAttributeValue;
  onChange: (value: EquipmentAttributeValue) => void;
}) {
  const label = field.unit ? `${field.label} (${field.unit})` : field.label;

  if (field.type === "select") {
    return (
      <Field label={label}>
        <select
          className={inputCls}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Selecione</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
    );
  }

  if (field.type === "boolean") {
    return (
      <Field label={label}>
        <select
          className={inputCls}
          value={typeof value === "boolean" ? String(value) : ""}
          onChange={(event) => onChange(event.target.value === "true")}
        >
          <option value="">Selecione</option>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
      </Field>
    );
  }

  return (
    <Field label={label}>
      <input
        className={field.type === "number" ? `${inputCls} font-mono` : inputCls}
        type={field.type === "number" ? "number" : "text"}
        value={String(value ?? "")}
        onChange={(event) =>
          onChange(
            field.type === "number" ? Number(event.target.value) : event.target.value,
          )
        }
      />
    </Field>
  );
}

function StandardPanel({
  equipment,
  onConfirm,
}: {
  equipment: Equipment;
  onConfirm: () => void;
}) {
  const classification = equipment.standardClassification;

  return (
    <div className="rounded-lg border border-border bg-card/60">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
          <BadgeCheck className="size-3" /> Norma aplicável
        </div>
        {classification?.status === "suggested" ? (
          <button
            onClick={onConfirm}
            className="inline-flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
          >
            <BadgeCheck className="size-3" /> Confirmar norma
          </button>
        ) : null}
      </div>
      <div className="p-4">
        {!classification ? (
          <div className="text-sm text-muted-foreground">
            Nenhuma norma sugerida para o cadastro atual.
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2">
              <div className="font-mono text-sm font-semibold text-primary">
                {classification.standard?.code ?? "Norma"}
              </div>
              <span className="rounded border border-border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                {classification.status === "confirmed"
                  ? "confirmada"
                  : "sugerida"}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {classification.explanation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SensorInstallationsPanel({
  equipment,
  sensors,
  availableSensors,
  draft,
  onDraftChange,
  onAdd,
  onEnd,
}: {
  equipment: Equipment;
  sensors: Sensor[];
  availableSensors: Sensor[];
  draft: InstallationDraft;
  onDraftChange: (draft: InstallationDraft) => void;
  onAdd: () => void;
  onEnd: (installationId: number) => void;
}) {
  const activeInstallations = equipment.sensorInstallations.filter(
    (installation) => !installation.endedAt,
  );
  const historicalInstallations = equipment.sensorInstallations.filter(
    (installation) => installation.endedAt,
  );

  return (
    <div className="rounded-lg border border-border bg-card/60">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
          <Link2 className="size-3" /> Sensores instalados
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-4 gap-3">
          <Field label="Sensor disponível">
            <select
              className={inputCls}
              value={draft.sensorId}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  sensorId: event.target.value ? Number(event.target.value) : "",
                })
              }
            >
              <option value="">Selecione</option>
              {availableSensors.map((sensor) => (
                <option key={sensor.id} value={sensor.id}>
                  {sensor.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Posição">
            <input
              className={inputCls}
              value={draft.position}
              onChange={(event) =>
                onDraftChange({ ...draft, position: event.target.value })
              }
            />
          </Field>
          <Field label="Eixo / direção">
            <input
              className={inputCls}
              value={draft.measurementAxis}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  measurementAxis: event.target.value,
                })
              }
            />
          </Field>
          <Field label="Observação">
            <input
              className={inputCls}
              value={draft.notes}
              onChange={(event) =>
                onDraftChange({ ...draft, notes: event.target.value })
              }
            />
          </Field>
        </div>
        <button
          onClick={onAdd}
          className="inline-flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
        >
          <Link2 className="size-3" /> Vincular sensor
        </button>

        <InstallationList
          title="Vínculos ativos"
          installations={activeInstallations}
          sensors={sensors}
          onEnd={onEnd}
        />
        {historicalInstallations.length > 0 ? (
          <InstallationList
            title="Histórico"
            installations={historicalInstallations}
            sensors={sensors}
          />
        ) : null}
      </div>
    </div>
  );
}

function InstallationList({
  title,
  installations,
  sensors,
  onEnd,
}: {
  title: string;
  installations: SensorInstallation[];
  sensors: Sensor[];
  onEnd?: (installationId: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium">{title}</div>
      {installations.length === 0 ? (
        <div className="rounded border border-border bg-background/40 p-3 text-xs text-muted-foreground">
          Nenhum vínculo.
        </div>
      ) : (
        <div className="space-y-2">
          {installations.map((installation) => (
            <div
              key={installation.id}
              className="flex items-center justify-between rounded border border-border bg-background/40 px-3 py-2"
            >
              <div>
                <div className="text-sm font-medium">
                  {sensorName(sensors, installation.sensorId)}
                </div>
                <div className="mt-0.5 text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
                  {installation.position ?? "Sem posição"} ·{" "}
                  {installation.measurementAxis ?? "Sem eixo"} ·{" "}
                  {formatDate(installation.installedAt)}
                </div>
              </div>
              {onEnd ? (
                <button
                  onClick={() => onEnd(installation.id)}
                  className="inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Unlink className="size-3" /> Encerrar
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RouteState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function emptyDraft(equipmentTypeId: number): EquipmentDraft {
  return {
    equipmentTypeId,
    name: "",
    tag: "",
    manufacturer: "",
    model: "",
    serialNumber: "",
    site: "",
    area: "",
    location: "",
    criticality: "medium",
    operationalStatus: "active",
    specificAttributes: {},
  };
}

function draftFromEquipment(equipment: Equipment): EquipmentDraft {
  return {
    equipmentTypeId: equipment.equipmentTypeId,
    name: equipment.name,
    tag: equipment.tag,
    manufacturer: equipment.manufacturer ?? "",
    model: equipment.model ?? "",
    serialNumber: equipment.serialNumber ?? "",
    site: equipment.site ?? "",
    area: equipment.area ?? "",
    location: equipment.location ?? "",
    criticality: equipment.criticality,
    operationalStatus: equipment.operationalStatus,
    specificAttributes: equipment.specificAttributes,
  };
}

function equipmentPayload(draft: EquipmentDraft): CreateEquipmentInput {
  return {
    equipmentTypeId: draft.equipmentTypeId,
    name: draft.name,
    tag: draft.tag,
    manufacturer: draft.manufacturer,
    model: draft.model,
    serialNumber: draft.serialNumber,
    site: draft.site,
    area: draft.area,
    location: draft.location,
    criticality: draft.criticality,
    operationalStatus: draft.operationalStatus,
    specificAttributes: draft.specificAttributes,
    deletedAt: null,
  };
}

function defaultAttributes(
  equipmentType: EquipmentType | undefined,
): Record<string, EquipmentAttributeValue> {
  if (!equipmentType) return {};

  return Object.fromEntries(
    equipmentType.fieldDefinitions.map((field) => [field.key, null]),
  );
}

function emptyInstallationDraft(): InstallationDraft {
  return {
    sensorId: "",
    position: "",
    measurementAxis: "",
    notes: "",
  };
}

function activeInstalledSensorIds(equipment: Equipment[]): Set<number> {
  return new Set(
    equipment.flatMap((item) =>
      item.sensorInstallations
        .filter((installation) => !installation.endedAt)
        .map((installation) => installation.sensorId),
    ),
  );
}

function sensorName(sensors: Sensor[], sensorId: number): string {
  return sensors.find((sensor) => sensor.id === sensorId)?.name ?? "Sensor";
}

function criticalityLabel(value: string): string {
  return (
    criticalityOptions.find((option) => option.value === value)?.label ??
    "Criticidade"
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
