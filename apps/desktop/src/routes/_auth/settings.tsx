import { StatusPill } from "@/components/shared/StatusPill";
import {
  getSensorMeta,
  controllers as seedControllers,
  type Controller,
  type Sensor,
  type SensorType,
} from "@/lib/mock-data";
import { createFileRoute } from "@tanstack/react-router";
import {
  Cpu,
  Plus,
  Radio,
  Save,
  Settings2,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_auth/settings")({
  head: () => ({ meta: [{ title: "Administração · Sentinel" }] }),
  component: AdminPage,
});

type Draft = {
  name: string;
  model: Controller["model"];
  site: string;
  ipAddress: string;
};

type SensorDraft = {
  name: string;
  type: SensorType;
  location: string;
  registerAddress: string;
  pollingInterval: number;
};

const SENSOR_TYPES: SensorType[] = ["QM30VT2", "QM30VT3", "M12FTH4Q"];

const emptyController: Draft = {
  name: "",
  model: "DXM700",
  site: "",
  ipAddress: "",
};
const emptySensor: SensorDraft = {
  name: "",
  type: "QM30VT2",
  location: "",
  registerAddress: "40001",
  pollingInterval: 5,
};

function AdminPage() {
  const [controllers, setControllers] = useState<Controller[]>(seedControllers);
  const [selectedId, setSelectedId] = useState<string | null>(
    seedControllers[0]?.id ?? null,
  );
  const [showNewController, setShowNewController] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyController);
  const [sensorDraft, setSensorDraft] = useState<SensorDraft>(emptySensor);
  const [showNewSensor, setShowNewSensor] = useState(false);

  const selected = controllers.find((c) => c.id === selectedId) ?? null;

  function addController() {
    if (!draft.name.trim() || !draft.ipAddress.trim()) return;
    const id = `dxm-${Math.random().toString(36).slice(2, 6)}`;
    const created: Controller = {
      id,
      name: draft.name.trim(),
      model: draft.model,
      site: draft.site.trim() || "—",
      status: "online",
      uptime: "0d 00h",
      ipAddress: draft.ipAddress.trim(),
      sensors: [],
    };
    setControllers((prev) => [...prev, created]);
    setSelectedId(id);
    setDraft(emptyController);
    setShowNewController(false);
  }

  function removeController(id: string) {
    setControllers((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function addSensor() {
    if (!selected || !sensorDraft.name.trim()) return;
    const meta = getSensorMeta(sensorDraft.type);
    const newSensor: Sensor = {
      id: `s-${Math.random().toString(36).slice(2, 6)}`,
      name: sensorDraft.name.trim(),
      type: sensorDraft.type,
      status: "online",
      location: sensorDraft.location.trim() || "—",
      battery: 100,
      lastSeen: "agora",
      readings:
        sensorDraft.type === "M12FTH4Q"
          ? { humidity: 0, temperature: 0 }
          : { velocityRms: 0, temperature: 0 },
    };
    setControllers((prev) =>
      prev.map((c) =>
        c.id === selected.id ? { ...c, sensors: [...c.sensors, newSensor] } : c,
      ),
    );
    setSensorDraft({
      ...emptySensor,
      registerAddress: nextRegister(selected, meta.label),
    });
    setShowNewSensor(false);
  }

  function removeSensor(sid: string) {
    if (!selected) return;
    setControllers((prev) =>
      prev.map((c) =>
        c.id === selected.id
          ? { ...c, sensors: c.sensors.filter((s) => s.id !== sid) }
          : c,
      ),
    );
  }

  return (
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
            Gerencie controladores Banner DXM e configure os registros dos
            sensores conectados.
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
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {c.sensors.length} sensores
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeController(c.id);
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
                  <StatusPill status={selected.status} />
                </div>
              </div>

              <div className="border border-border rounded-lg bg-card/60 overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings2 className="size-3.5 text-muted-foreground" />
                    <div className="text-[10px] font-mono tracking-[0.16em] uppercase text-muted-foreground">
                      Sensores e registros · {selected.sensors.length}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSensorDraft({
                        ...emptySensor,
                        registerAddress: nextRegister(selected),
                      });
                      setShowNewSensor(true);
                    }}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-xs bg-primary/15 text-primary hover:bg-primary/25"
                  >
                    <Plus className="size-3" /> Adicionar sensor
                  </button>
                </div>

                {showNewSensor && (
                  <NewSensorForm
                    draft={sensorDraft}
                    setDraft={setSensorDraft}
                    onSave={addSensor}
                    onCancel={() => setShowNewSensor(false)}
                  />
                )}

                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground border-b border-border">
                      <th className="text-left px-4 py-2 font-normal">Nome</th>
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
                    {selected.sensors.map((s, i) => (
                      <tr
                        key={s.id}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{s.name}</div>
                          <div className="text-[10px] font-mono text-muted-foreground">
                            {getSensorMeta(s.type).label}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs">
                          {s.type}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {s.location}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs">
                          {40001 + i * 4}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => removeSensor(s.id)}
                            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {selected.sensors.length === 0 && !showNewSensor && (
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
  );
}

function nextRegister(c: Controller, _label?: string) {
  return String(40001 + c.sensors.length * 4);
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

function NewControllerForm({
  draft,
  setDraft,
  onSave,
  onCancel,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
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
  draft,
  setDraft,
  onSave,
  onCancel,
}: {
  draft: SensorDraft;
  setDraft: (d: SensorDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="p-4 border-b border-border bg-muted/20 space-y-3">
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
          <select
            className={inputCls}
            value={draft.type}
            onChange={(e) =>
              setDraft({ ...draft, type: e.target.value as SensorType })
            }
          >
            {SENSOR_TYPES.map((t) => (
              <option key={t} value={t}>
                {t} · {getSensorMeta(t).label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Localização">
          <input
            className={inputCls}
            placeholder="Mancal superior"
            value={draft.location}
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
          />
        </Field>
        <Field label="Registro Modbus inicial">
          <input
            className={inputCls + " font-mono"}
            placeholder="40001"
            value={draft.registerAddress}
            onChange={(e) =>
              setDraft({ ...draft, registerAddress: e.target.value })
            }
          />
        </Field>
        <Field label="Intervalo de leitura (s)">
          <input
            type="number"
            min={1}
            className={inputCls + " font-mono"}
            value={draft.pollingInterval}
            onChange={(e) =>
              setDraft({
                ...draft,
                pollingInterval: Number(e.target.value) || 1,
              })
            }
          />
        </Field>
      </div>
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
