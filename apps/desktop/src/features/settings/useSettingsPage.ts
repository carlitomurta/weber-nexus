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
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { ControllerWrite } from "../../../types/controllers.type";
import type { Sensor, SensorWrite } from "../../../types/sensors.type";
import { buildSensorPayload, normalizeSensorRegister } from "./sensor-registers";
import {
  emptyController,
  emptySensor,
  type DeleteConfirmation,
  type SensorDraft,
} from "./types";

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

  const { data: controllers = [] } = useControllers();
  const { data: sensors = [] } = useSensors();

  const { mutate: createController } = useCreateController({
    onSuccess: (id) => {
      setSelectedId(id);
      setControllerDraft(emptyController);
      setShowNewController(false);
    },
  });

  const { mutate: deleteController } = useDeleteController();
  const { mutate: updateController } = useUpdateController();
  const { mutate: createSensor } = useCreateSensor();
  const { mutate: updateSensor } = useUpdateSensor();
  const { mutate: deleteSensor } = useDeleteSensor();

  const selected = controllers.find((controller) => controller.id === selectedId)
    ?? null;
  const editingController =
    controllers.find((controller) => controller.id === editingControllerId) ??
    null;
  const selectedSensors = selected
    ? sensors.filter((sensor) => sensor.controllerId === selected.id)
    : [];
  const isSensorDialogOpen = showNewSensor || editingSensorId !== null;

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
    if (
      !controllerDraft.name.trim() ||
      !controllerDraft.ipAddress.trim()
    ) {
      toast.error("Informe nome e endereço IP do controlador.");
      return;
    }

    createController(
      {
        name: controllerDraft.name.trim(),
        model: controllerDraft.model.trim(),
        ipAddress: controllerDraft.ipAddress.trim(),
        site: controllerDraft.site.trim(),
        port: controllerDraft.port,
        pollingIntervalMs: controllerDraft.pollingIntervalMs,
      },
      {
        onSuccess: () => toast.success("Controlador criado."),
        onError: () => toast.error("Não foi possível criar o controlador."),
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
      onError: () => toast.error("Não foi possível atualizar o sensor."),
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
      onError: () => toast.error("Não foi possível remover o sensor."),
    });
  }

  function handleConfirm() {
    if (!confirm) return;

    if (confirm.kind === "controller") {
      removeController(confirm.id);
    } else {
      removeSensor(confirm.id);
    }

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
    selected,
    selectedId,
    selectedSensors,
    sensorDraft,
    showNewController,
    addController,
    closeSensorDialog,
    handleConfirm,
    openNewControllerForm,
    openNewSensorDialog,
    saveEditController,
    setConfirm,
    setControllerDraft,
    setEditingControllerId,
    setSensorDraft,
    setSelectedId,
    setShowNewController,
    startEditSensor,
    saveSensor: editingSensorId !== null ? saveEditSensor : addSensor,
  };
}
