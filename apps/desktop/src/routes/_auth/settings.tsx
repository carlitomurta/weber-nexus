import { EditControllerDialog } from "@/components/controller/EditControllerDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  useControllers,
  useCreateController,
  useDeleteController,
  useUpdateController,
} from "@/hooks/useControllers";
import {
  useCreateSensor,
  useDeleteSensor,
  useSensors,
  useUpdateSensor,
} from "@/hooks/useSensors";
import { createFileRoute } from "@tanstack/react-router";
import {
  Cpu,
  Pencil,
  Plus,
  Radio,
  Save,
  Settings2,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type {
  Controller,
  ControllerWrite,
  CreateControllerInput,
} from "../../../types/controllers.type";
import type {
  CreateSensorInput,
  Sensor,
  SensorWrite,
} from "../../../types/sensors.type";

export const Route = createFileRoute("/_auth/settings")({
  head: () => ({ meta: [{ title: "Administração" }] }),
  component: AdminPage,
});

type ControllerDraft = CreateControllerInput;
type SensorDraft = Omit<CreateSensorInput, "controllerId">;

const emptyController: ControllerDraft = {
  name: "",
  model: "DXM700",
  ipAddress: "",
  site: "",
  port: null,
  pollingIntervalMs: 10000,
};

const emptySensor: SensorDraft = {
  modbusId: 1,
  name: "",
  description: "",
  location: "",
  model: "",
  registers: [],
};

function AdminPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ControllerDraft>(emptyController);
  const [sensorDraft, setSensorDraft] = useState<SensorDraft>(emptySensor);
  const [showNewSensor, setShowNewSensor] = useState(false);
  const [showNewController, setShowNewController] = useState(false);
  const [editingSensorId, setEditingSensorId] = useState<number | null>(null);
  const [editingControllerId, setEditingControllerId] = useState<number | null>(
    null,
  );
  const [confirm, setConfirm] = useState<
    | { kind: "controller"; id: number; name: string }
    | { kind: "sensor"; id: number; name: string }
    | null
  >(null);

  const { data: controllers = [] } = useControllers();
  const { data: sensors = [] } = useSensors();

  const { mutate: createController } = useCreateController({
    onSuccess: (id) => {
      setSelectedId(id);
      setDraft(emptyController);
      setShowNewController(false);
    },
  });

  const { mutate: deleteController } = useDeleteController();
  const { mutate: updateController } = useUpdateController();
  const { mutate: createSensor } = useCreateSensor();
  const { mutate: updateSensor } = useUpdateSensor();
  const { mutate: deleteSensor } = useDeleteSensor();

  const selected = controllers?.find((c) => c.id === selectedId) ?? null;
  const editing = controllers.find((c) => c.id === editingControllerId) ?? null;
  const selectedSensors = selected
    ? sensors.filter((s) => s.controllerId === selected.id)
    : [];

  useEffect(() => {
    if (selectedId === null && controllers.length > 0) {
      setSelectedId(controllers[0].id);
    }
  }, [controllers, selectedId]);

  function addController() {
    if (!draft.name.trim() || !draft.ipAddress.trim()) {
      toast.error("Informe nome e endereço IP do controlador.");
      return;
    }
    const created: ControllerDraft = {
      name: draft.name.trim(),
      model: draft.model.trim(),
      ipAddress: draft.ipAddress.trim(),
      site: draft.site.trim(),
      port: draft.port,
      pollingIntervalMs: draft.pollingIntervalMs,
    };
    createController(created, {
      onSuccess: () => toast.success("Controlador criado."),
      onError: () => toast.error("Não foi possível criar o controlador."),
    });
  }

  function removeController(controllerId: number) {
    deleteController(controllerId, {
      onSuccess: () => {
        if (selectedId === controllerId) setSelectedId(null);
        toast.success("Controlador removido.");
      },
      onError: () => toast.error("Não foi possível remover o controlador."),
    });
  }

  function addSensor() {
    if (!selected) return;
    const sensor = buildSensorPayload(sensorDraft, selected.id);

    if (!sensor) return;

    createSensor(sensor, {
      onSuccess: () => {
        setSensorDraft(emptySensor);
        setShowNewSensor(false);
        toast.success("Sensor adicionado.");
      },
      onError: () => toast.error("Não foi possível adicionar o sensor."),
    });
  }

  function startEditSensor(sensor: Sensor) {
    setShowNewSensor(false);
    setEditingSensorId(sensor.id);
    setSensorDraft({
      modbusId: sensor.modbusId,
      name: sensor.name,
      description: sensor.description ?? "",
      location: sensor.location ?? "",
      model: sensor.model ?? "",
      registers: sensor.registers,
    });
  }

  function saveEditSensor() {
    const sensor = sensors.find((s) => s.id === editingSensorId);
    if (!sensor) return;
    const payload = buildSensorPayload(sensorDraft, sensor.controllerId);

    if (!payload) return;

    const updatedSensor: SensorWrite = {
      id: sensor.id,
      ...payload,
    };

    updateSensor(
      updatedSensor,
      {
        onSuccess: () => {
          setEditingSensorId(null);
          setSensorDraft(emptySensor);
          toast.success("Sensor atualizado.");
        },
        onError: () => toast.error("Não foi possível atualizar o sensor."),
      },
    );
  }

  function removeSensor(sensorId: number) {
    deleteSensor(sensorId, {
      onSuccess: () => {
        if (editingSensorId === sensorId) {
          setEditingSensorId(null);
          setSensorDraft(emptySensor);
        }
        toast.success("Sensor removido.");
      },
      onError: () => toast.error("Não foi possível remover o sensor."),
    });
  }

  function handleConfirm() {
    if (!confirm) return;
    if (confirm.kind === "controller") removeController(confirm.id);
    else removeSensor(confirm.id);
    setConfirm(null);
  }

  function saveEditController(patch: ControllerWrite) {
    if (!editingControllerId) return;
    if (!patch.name.trim() || !patch.ipAddress.trim()) {
      toast.error("Informe nome e endereço IP do controlador.");
      return;
    }
    updateController(
      {
        ...patch,
        name: patch.name.trim(),
        model: patch.model.trim(),
        ipAddress: patch.ipAddress.trim(),
        site: patch.site.trim(),
      },
      {
        onSuccess: () => {
          setEditingControllerId(null);
          toast.success("Controlador atualizado.");
        },
        onError: () => toast.error("Não foi possível atualizar o controlador."),
      },
    );
  }

  return (
    <>
      <div className=" space-y-6">
        <div className="flex items-end justify-between border-b border-border pb-5">
          <div>
            <div className="text-[10px] font-mono tracking-[0.2em] text-primary uppercase flex items-center gap-2">
              <Shield className="size-3" /> Administração
            </div>
            <h1 className="text-3xl font-semibold tracking-tight mt-1">
              Cadastro de Controladores
            </h1>
            <div className="text-sm text-muted-foreground mt-1">
              Gerencie controladores e configure os registros dos sensores
              conectados.
            </div>
          </div>
          <button
            onClick={() => {
              setDraft(emptyController);
              setShowNewController(true);
            }}
            className="inline-flex items-center gap-2 h-9 px-4 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="size-4" /> Novo controlador
          </button>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Lista de controladores */}
          <div className="col-span-4 border border-border rounded-lg bg-card/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="text-[10px] font-mono tracking-[0.16em] uppercase text-muted-foreground">
                Controladores · {controllers.length}
              </div>
              <Cpu className="size-3.5 text-muted-foreground" />
            </div>

            {showNewController && (
              <NewControllerForm
                draft={draft}
                setDraft={setDraft}
                onSave={addController}
                onCancel={() => setShowNewController(false)}
              />
            )}

            <ul className="divide-y divide-border">
              {controllers.map((c) => {
                const active = c.id === selectedId;
                return (
                  <li
                    key={c.id}
                    className={`px-4 py-3 cursor-pointer transition-colors ${
                      active
                        ? "bg-primary/10 border-l-2 border-primary"
                        : "hover:bg-muted/40"
                    }`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {c.name}
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground truncate">
                          {c.model} · {c.ipAddress}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* <span className="text-[10px] font-mono text-muted-foreground">
                        {c.sensors.length} sensores
                      </span> */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingControllerId(c.id);
                          }}
                          className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10"
                          aria-label="Editar"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirm({
                              kind: "controller",
                              id: c.id,
                              name: c.name,
                            });
                          }}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          aria-label="Remover"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
              {controllers.length === 0 && (
                <li className="px-4 py-8 text-center text-xs text-muted-foreground">
                  Nenhum controlador cadastrado.
                </li>
              )}
            </ul>
          </div>

          {/* Detalhe / sensores */}
          <div className="col-span-8 space-y-4">
            {!selected && (
              <div className="border border-dashed border-border rounded-lg p-16 text-center text-sm text-muted-foreground">
                Selecione ou cadastre um controlador para configurar seus
                sensores.
              </div>
            )}

            {selected && (
              <>
                <div className="border border-border rounded-lg bg-card/60 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-mono tracking-[0.18em] text-primary uppercase flex items-center gap-1.5">
                        <Radio className="size-3" /> Banner {selected.model}
                      </div>
                      <h2 className="text-xl font-semibold mt-1">
                        {selected.name}
                      </h2>
                      <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                        <span>{selected.site}</span>
                        <span className="font-mono">{selected.ipAddress}</span>
                      </div>
                    </div>
                    {/* <StatusPill status={selected.status} /> */}
                  </div>
                </div>

                <div className="border border-border rounded-lg bg-card/60 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Settings2 className="size-3.5 text-muted-foreground" />
                      <div className="text-[10px] font-mono tracking-[0.16em] uppercase text-muted-foreground">
                        Sensores e registros · {selectedSensors.length}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEditingSensorId(null);
                        setSensorDraft(emptySensor);
                        setShowNewSensor(true);
                      }}
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-xs bg-primary/15 text-primary hover:bg-primary/25"
                    >
                      <Plus className="size-3" /> Adicionar sensor
                    </button>
                  </div>

                  {showNewSensor && (
                    <NewSensorForm
                      key="new-sensor"
                      title="Novo sensor"
                      draft={sensorDraft}
                      setDraft={setSensorDraft}
                      onSave={addSensor}
                      onCancel={() => {
                        setShowNewSensor(false);
                        setSensorDraft(emptySensor);
                      }}
                    />
                  )}

                  {editingSensorId !== null && (
                    <NewSensorForm
                      key={editingSensorId}
                      title="Editar sensor"
                      draft={sensorDraft}
                      setDraft={setSensorDraft}
                      onSave={saveEditSensor}
                      onCancel={() => {
                        setEditingSensorId(null);
                        setSensorDraft(emptySensor);
                      }}
                    />
                  )}

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground border-b border-border">
                        <th className="text-left px-4 py-2 font-normal">
                          Nome
                        </th>
                        <th className="text-left px-4 py-2 font-normal">
                          Modelo
                        </th>
                        <th className="text-left px-4 py-2 font-normal">
                          Localização
                        </th>
                        <th className="text-left px-4 py-2 font-normal">
                          Registro
                        </th>
                        <th className="text-right px-4 py-2 font-normal"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSensors.map((s) => (
                        <tr
                          key={s.id}
                          className="border-b border-border/60 last:border-0"
                        >
                          <td className="px-4 py-2.5">
                            <div className="font-medium">{s.name}</div>
                            <div className="text-[10px] font-mono text-muted-foreground">
                              {s.description}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs">
                            {s.model}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {s.location}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs">
                            {s.registers.join(", ")}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => startEditSensor(s)}
                                className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10"
                                aria-label="Editar sensor"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                onClick={() =>
                                  setConfirm({
                                    kind: "sensor",
                                    id: s.id,
                                    name: s.name,
                                  })
                                }
                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                aria-label="Remover sensor"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {selectedSensors.length === 0 && !showNewSensor && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-10 text-center text-xs text-muted-foreground"
                          >
                            Nenhum sensor configurado. Clique em "Adicionar
                            sensor".
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {editing && (
        <EditControllerDialog
          controller={editing}
          open={editingControllerId !== null}
          onOpenChange={(o) => !o && setEditingControllerId(null)}
          onSave={saveEditController}
        />
      )}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm?.kind === "controller"
            ? "Remover controlador?"
            : "Remover sensor?"
        }
        description={
          confirm?.kind === "controller"
            ? `Esta ação remove o controlador "${confirm?.name}" e todos os seus sensores. Não pode ser desfeita.`
            : `Esta ação remove o sensor "${confirm?.name}" e suas configurações de registro. Não pode ser desfeita.`
        }
        confirmLabel="Remover"
        destructive
        onConfirm={handleConfirm}
      />
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[10px] font-mono tracking-[0.14em] uppercase text-muted-foreground mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}

const inputCls =
  "w-full h-9 px-2.5 rounded bg-background border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary";

function buildSensorPayload(draft: SensorDraft, controllerId: number) {
  if (!draft.name.trim()) {
    toast.error("Informe o nome do sensor.");
    return null;
  }

  if (!Number.isInteger(draft.modbusId) || draft.modbusId <= 0) {
    toast.error("Informe um ID Modbus válido.");
    return null;
  }

  if (draft.registers.length === 0) {
    toast.error("Informe ao menos um registro Modbus.");
    return null;
  }

  return {
    controllerId,
    modbusId: draft.modbusId,
    name: draft.name.trim(),
    description: draft.description?.trim() || null,
    location: draft.location?.trim() || null,
    model: draft.model?.trim() || null,
    registers: draft.registers,
  };
}

function parseRegisters(value: string) {
  return value
    .split(",")
    .map((register) => Number(register.trim()))
    .filter((register) => Number.isInteger(register) && register > 0);
}

function NewControllerForm({
  draft,
  setDraft,
  onSave,
  onCancel,
}: {
  draft: ControllerDraft;
  setDraft: (d: ControllerDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="p-4 border-b border-border bg-muted/20 space-y-3">
      <Field label="Nome do controlador">
        <input
          autoFocus
          className={inputCls}
          placeholder="Ex.: Sala de Prensas Norte"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Modelo">
          <select
            className={inputCls}
            value={draft.model}
            onChange={(e) =>
              setDraft({
                ...draft,
                model: e.target.value as Controller["model"],
              })
            }
          >
            <option value="DXM700">DXM700</option>
            <option value="DXM1200">DXM1200</option>
          </select>
        </Field>
        <Field label="Endereço IP">
          <input
            className={inputCls + " font-mono"}
            placeholder="10.4.21.10"
            value={draft.ipAddress}
            onChange={(e) => setDraft({ ...draft, ipAddress: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Local / Planta">
        <input
          className={inputCls}
          placeholder="Planta A · Baia 1"
          value={draft.site}
          onChange={(e) => setDraft({ ...draft, site: e.target.value })}
        />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded text-xs text-muted-foreground hover:bg-muted"
        >
          <X className="size-3" /> Cancelar
        </button>
        <button
          onClick={onSave}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded text-xs bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Save className="size-3" /> Salvar
        </button>
      </div>
    </div>
  );
}

function NewSensorForm({
  title,
  draft,
  setDraft,
  onSave,
  onCancel,
}: {
  title: string;
  draft: SensorDraft;
  setDraft: (d: SensorDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [registersText, setRegistersText] = useState(
    draft.registers.join(", "),
  );

  return (
    <div className="p-4 border-b border-border bg-muted/20 space-y-3">
      <div className="text-[10px] font-mono tracking-[0.16em] uppercase text-muted-foreground">
        {title}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome do sensor">
          <input
            autoFocus
            className={inputCls}
            placeholder="Ex.: Bomba Hidráulica 01"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Field>
        <Field label="Modelo do sensor">
          <input
            className={inputCls}
            placeholder="Ex.: QM30VT2"
            value={draft.model ?? ""}
            onChange={(e) => setDraft({ ...draft, model: e.target.value })}
          />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="ID Modbus">
          <input
            type="number"
            min={1}
            className={inputCls + " font-mono"}
            value={draft.modbusId}
            onChange={(e) =>
              setDraft({
                ...draft,
                modbusId: Number(e.target.value) || 0,
              })
            }
          />
        </Field>
        <Field label="Localização">
          <input
            className={inputCls}
            placeholder="Mancal superior"
            value={draft.location ?? ""}
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
          />
        </Field>
        <Field label="Registros Modbus">
          <input
            className={inputCls + " font-mono"}
            placeholder="40001, 40002"
            value={registersText}
            onChange={(e) => {
              setRegistersText(e.target.value);
              setDraft({
                ...draft,
                registers: parseRegisters(e.target.value),
              });
            }}
          />
        </Field>
      </div>
      <Field label="Descrição">
        <input
          className={inputCls}
          placeholder="Ex.: Vibração e temperatura do conjunto"
          value={draft.description ?? ""}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded text-xs text-muted-foreground hover:bg-muted"
        >
          <X className="size-3" /> Cancelar
        </button>
        <button
          onClick={onSave}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded text-xs bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Save className="size-3" /> Salvar sensor
        </button>
      </div>
    </div>
  );
}
