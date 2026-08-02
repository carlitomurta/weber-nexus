import { useEffect, useState } from "react";

import { toast } from "sonner";

import {
  useControllers,
  useCreateController,
  useDeleteController,
  useSyncControllerXml,
  useUpdateController,
} from "@/hooks/react-query/useControllers";
import {
  useCreateSensor,
  useDeleteSensor,
  useSensors,
  useUpdateSensor,
} from "@/hooks/react-query/useSensors";
import { apiErrorMessage } from "@/lib/api";

import type {
  Controller,
  ControllerWrite,
} from "../../../types/controllers.type";
import type { Sensor, SensorWrite } from "../../../types/sensors.type";
import {
  buildSensorPayload,
  normalizeSensorRegister,
} from "./sensor-registers";
import {
  type DeleteConfirmation,
  type ResetConfirmation,
  type SensorDraft,
} from "./settings.type";
import { emptyController, emptySensor } from "./settingsDefaults";

const emptyControllers: Controller[] = [];
const emptySensors: Sensor[] = [];

export function useSettingsPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [controllerDraft, setControllerDraft] = useState(emptyController);
  const [sensorDraft, setSensorDraft] = useState<SensorDraft>(emptySensor);
  const [showNewSensor, setShowNewSensor] = useState(false);
  const [showNewController, setShowNewController] = useState(false);
  const [editingSensorId, setEditingSensorId] = useState<number | null>(null);
  const [editingControllerId, setEditingControllerId] = useState<number | null>(
    null,
  );
  const [confirm, setConfirm] = useState<DeleteConfirmation | null>(null);
  const [resetConfirm, setResetConfirm] = useState<ResetConfirmation | null>(
    null,
  );

  const controllersQuery = useControllers();
  const sensorsQuery = useSensors();
  const controllers = controllersQuery.data ?? emptyControllers;
  const sensors = sensorsQuery.data ?? emptySensors;

  const { mutate: createController } = useCreateController({
    onSuccess: (id) => {
      setSelectedId(id);
      setControllerDraft(emptyController);
      setShowNewController(false);
    },
  });

  const { mutate: deleteController } = useDeleteController();
  const { mutate: updateController } = useUpdateController();
  const { mutate: syncControllerXml, isPending: isSyncingControllerXml } =
    useSyncControllerXml();
  const { mutate: createSensor } = useCreateSensor();
  const { mutate: updateSensor } = useUpdateSensor();
  const { mutate: deleteSensor } = useDeleteSensor();

  const selected =
    controllers.find((controller) => controller.id === selectedId) ?? null;
  const editingController =
    controllers.find((controller) => controller.id === editingControllerId) ??
    null;
  const selectedSensors = selected
    ? sensors.filter((sensor) => sensor.controllerId === selected.id)
    : [];
  const isSensorDialogOpen = showNewSensor || editingSensorId !== null;
  const isLoading = controllersQuery.isLoading || sensorsQuery.isLoading;
  const isError = controllersQuery.isError || sensorsQuery.isError;

  useEffect(() => {
    if (selectedId === null && controllers.length > 0) {
      setSelectedId(controllers[0].id);
    }
  }, [controllers, selectedId]);

  function openNewControllerForm() {
    setControllerDraft(emptyController);
    setShowNewController(true);
  }

  function addController() {
    if (!controllerDraft.name.trim() || !controllerDraft.ipAddress.trim()) {
      toast.error("Informe nome e endereço IP do controlador.");
      return;
    }

    if (!isValidPollingInterval(controllerDraft.pollingIntervalMs)) {
      toast.error("Informe um intervalo de coleta válido.");
      return;
    }

    setResetConfirm({
      title: "Importar configuração do controlador?",
      description:
        "O cadastro baixa o WLConfig.xml do controlador físico e importa sensores e registros encontrados.",
      confirmLabel: "Importar e cadastrar",
      onConfirm: createControllerFromDraft,
    });
  }

  function createControllerFromDraft() {
    createController(
      {
        name: controllerDraft.name.trim(),
        model: controllerDraft.model.trim(),
        ipAddress: controllerDraft.ipAddress.trim(),
        site: controllerDraft.site?.trim() ?? "",
        port: controllerDraft.port,
        pollingIntervalMs: controllerDraft.pollingIntervalMs,
      },
      {
        onSuccess: () =>
          toast.success("Controlador criado e configuração importada."),
        onError: (error) =>
          toast.error(
            apiErrorMessage(
              error,
              "Não foi possível importar a configuração do controlador.",
            ),
          ),
      },
    );
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

  function openNewSensorDialog() {
    setEditingSensorId(null);
    setSensorDraft(emptySensor);
    setShowNewSensor(true);
  }

  function addSensor() {
    if (!selected) return;

    const sensor = buildSensorPayload(sensorDraft, selected.id);

    if ("error" in sensor) {
      toast.error(sensor.error);
      return;
    }

    const conflictAddress = findConflictingRegisterAddress(
      sensor.registers,
      selectedSensors,
    );

    if (conflictAddress !== undefined) {
      toast.error(
        `Endereço de registrador ${conflictAddress} já está cadastrado neste controlador.`,
      );
      return;
    }

    createSensor(sensor, {
      onSuccess: () => {
        setSensorDraft(emptySensor);
        setShowNewSensor(false);
        toast.success("Sensor adicionado.");
      },
      onError: (error) =>
        toast.error(
          apiErrorMessage(error, "Não foi possível adicionar o sensor."),
        ),
    });
  }

  function startEditSensor(sensor: Sensor) {
    setShowNewSensor(false);
    setEditingSensorId(sensor.id);
    setSensorDraft({
      nodeId: sensor.nodeId,
      name: sensor.name,
      description: sensor.description ?? "",
      location: sensor.location ?? "",
      model: sensor.model ?? "",
      registers: sensor.registers.map(normalizeSensorRegister),
    });
  }

  function saveEditSensor() {
    const sensor = sensors.find((item) => item.id === editingSensorId);
    if (!sensor) return;

    const payload = buildSensorPayload(sensorDraft, sensor.controllerId);

    if ("error" in payload) {
      toast.error(payload.error);
      return;
    }

    const conflictAddress = findConflictingRegisterAddress(
      payload.registers,
      sensors.filter((item) => item.controllerId === sensor.controllerId),
      sensor.id,
    );

    if (conflictAddress !== undefined) {
      toast.error(
        `Endereço de registrador ${conflictAddress} já está cadastrado neste controlador.`,
      );
      return;
    }

    const updatedSensor: SensorWrite = {
      id: sensor.id,
      ...payload,
    };

    updateSensor(updatedSensor, {
      onSuccess: () => {
        setEditingSensorId(null);
        setSensorDraft(emptySensor);
        toast.success("Sensor atualizado.");
      },
      onError: (error) =>
        toast.error(
          apiErrorMessage(error, "Não foi possível atualizar o sensor."),
        ),
    });
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
      onError: (error) =>
        toast.error(
          apiErrorMessage(error, "Não foi possível remover o sensor."),
        ),
    });
  }

  function handleConfirm() {
    if (!confirm) return;

    if (confirm.kind === "controller") {
      removeController(confirm.id);
    } else {
      const sensorId = confirm.id;
      const sensorName = confirm.name;

      setResetConfirm({
        title: "Atualizar configuração do controlador?",
        description: `Remover "${sensorName}" envia uma nova configuração ao controlador e pode reiniciá-lo.`,
        confirmLabel: "Remover e sincronizar",
        onConfirm: () => removeSensor(sensorId),
      });
    }

    setConfirm(null);
  }

  function saveEditController(patch: ControllerWrite) {
    if (!editingControllerId) return;
    const currentController = editingController;

    if (!currentController) return;

    if (!patch.name.trim() || !patch.ipAddress.trim()) {
      toast.error("Informe nome e endereço IP do controlador.");
      return;
    }

    if (!isValidPollingInterval(patch.pollingIntervalMs)) {
      toast.error("Informe um intervalo de coleta válido.");
      return;
    }

    const save = () => updateControllerFromPatch(patch);

    if (currentController.ipAddress.trim() === patch.ipAddress.trim()) {
      save();
      return;
    }

    setResetConfirm({
      title: "Importar configuração do novo IP?",
      description:
        "Alterar o IP baixa o WLConfig.xml do novo controlador e substitui sensores e registros locais após sucesso.",
      confirmLabel: "Importar e salvar",
      onConfirm: save,
    });
  }

  function updateControllerFromPatch(patch: ControllerWrite) {
    updateController(
      {
        ...patch,
        name: patch.name.trim(),
        model: patch.model.trim(),
        ipAddress: patch.ipAddress.trim(),
        site: patch.site?.trim() ?? "",
      },
      {
        onSuccess: () => {
          setEditingControllerId(null);
          toast.success("Controlador atualizado.");
        },
        onError: (error) =>
          toast.error(
            apiErrorMessage(error, "Não foi possível atualizar o controlador."),
          ),
      },
    );
  }

  function saveSensorWithConfirmation() {
    if (editingSensorId !== null) {
      const sensor = sensors.find((item) => item.id === editingSensorId);

      if (sensor && !hasSensorXmlChanges(sensor, sensorDraft)) {
        saveEditSensor();
        return;
      }
    }

    setResetConfirm({
      title: "Atualizar configuração do controlador?",
      description:
        "Salvar o sensor envia uma nova configuração ao controlador e pode reiniciá-lo.",
      confirmLabel: "Salvar e sincronizar",
      onConfirm: editingSensorId !== null ? saveEditSensor : addSensor,
    });
  }

  function handleResetConfirm() {
    const action = resetConfirm?.onConfirm;

    setResetConfirm(null);
    action?.();
  }

  function syncSelectedControllerXml() {
    if (!selected) return;

    syncControllerXml(selected.id, {
      onSuccess: (result) => {
        if (result.status === "unchanged") {
          toast.success("O controlador já está sincronizado.");
          return;
        }

        toast.success(
          `Controlador sincronizado. ${result.sensorsImported} sensores importados.`,
        );
      },
      onError: (error) =>
        toast.error(
          apiErrorMessage(error, "Não foi possível sincronizar o controlador."),
        ),
    });
  }

  function downloadSelectedControllerXml() {
    if (!selected) return;

    if (!selected.xmlConfig?.trim()) {
      toast.error("Nenhum XML sincronizado para este controlador.");
      return;
    }

    const blob = new Blob([selected.xmlConfig], {
      type: "application/xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = xmlDownloadFileName(selected);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    toast.success("Arquivo XML baixado.");
  }

  function xmlDownloadFileName(controller: Controller): string {
    const name = controller.name
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return name ? `WLConfig-${name}.xml` : "WLConfig.xml";
  }

  function closeSensorDialog() {
    setShowNewSensor(false);
    setEditingSensorId(null);
    setSensorDraft(emptySensor);
  }

  return {
    confirm,
    controllerDraft,
    controllers,
    editingController,
    editingControllerId,
    editingSensorId,
    isSensorDialogOpen,
    isError,
    isLoading,
    isSyncingControllerXml,
    resetConfirm,
    selected,
    selectedId,
    selectedSensors,
    sensorDraft,
    showNewController,
    addController,
    closeSensorDialog,
    handleConfirm,
    handleResetConfirm,
    downloadSelectedControllerXml,
    openNewControllerForm,
    openNewSensorDialog,
    saveEditController,
    setConfirm,
    setControllerDraft,
    setEditingControllerId,
    setResetConfirm,
    setSensorDraft,
    setSelectedId,
    setShowNewController,
    startEditSensor,
    saveSensor: saveSensorWithConfirmation,
    syncSelectedControllerXml,
  };
}

function isValidPollingInterval(pollingIntervalMs: number): boolean {
  return Number.isInteger(pollingIntervalMs) && pollingIntervalMs > 0;
}

function findConflictingRegisterAddress(
  registers: ReadonlyArray<Sensor["registers"][number]>,
  existingSensors: ReadonlyArray<Sensor>,
  editingSensorId?: number,
): number | undefined {
  const nextAddresses = new Set(registers.map((register) => register.address));

  for (const sensor of existingSensors) {
    if (editingSensorId !== undefined && sensor.id === editingSensorId) {
      continue;
    }

    for (const register of sensor.registers) {
      if (nextAddresses.has(register.address)) return register.address;
    }
  }

  return undefined;
}

function hasSensorXmlChanges(sensor: Sensor, draft: SensorDraft): boolean {
  if (sensor.nodeId !== draft.nodeId) return true;
  if (sensor.name.trim() !== draft.name.trim()) return true;

  return !areSensorRegistersXmlEqual(sensor.registers, draft.registers);
}

function areSensorRegistersXmlEqual(
  currentRegisters: Sensor["registers"],
  draftRegisters: SensorDraft["registers"],
): boolean {
  if (currentRegisters.length !== draftRegisters.length) return false;

  const current = [...currentRegisters].sort(compareRegistersForXml);
  const draft = [...draftRegisters].sort(compareRegistersForXml);

  return current.every((register, index) =>
    areSensorRegisterXmlFieldsEqual(register, draft[index]),
  );
}

function compareRegistersForXml(
  left: Sensor["registers"][number],
  right: Sensor["registers"][number],
): number {
  if (left.address !== right.address) return left.address - right.address;
  return left.name.localeCompare(right.name);
}

function areSensorRegisterXmlFieldsEqual(
  current: Sensor["registers"][number],
  draft: SensorDraft["registers"][number] | undefined,
): boolean {
  if (draft === undefined) return false;

  return (
    current.name.trim() === draft.name.trim() &&
    current.address === draft.address &&
    (current.scaleType ?? undefined) === (draft.scaleType ?? undefined) &&
    (current.scaleFactor ?? undefined) === (draft.scaleFactor ?? undefined) &&
    current.unit.trim() === draft.unit.trim() &&
    (current.isHealthCheck ?? false) === (draft.isHealthCheck ?? false)
  );
}
