import { useState } from "react";

import { Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import type { SensorRegister } from "../../../types/sensors.type";
import { Field, inputCls } from "./form-controls";
import {
  firstNodeRegisterAddress,
  lastNodeRegisterAddress,
  nextRegisterAddress,
} from "./sensor-registers";
import type { SensorDraft } from "./settings.type";

interface SensorDialogProps {
  title: string;
  draft: SensorDraft;
  setDraft: (draft: SensorDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}

interface SensorFieldsProps {
  draft: SensorDraft;
  setDraft: (draft: SensorDraft) => void;
  onNodeIdChange: (nodeId: number) => void;
}

interface RegisterEditorProps {
  draft: SensorDraft;
  registerDraft: SensorRegister;
  setRegisterDraft: (register: SensorRegister) => void;
  onAddRegister: () => void;
  onRemoveRegister: (address: number) => void;
}

interface RegisterRowProps {
  register: SensorRegister;
  onRemoveRegister: (address: number) => void;
}

export function SensorDialog({
  title,
  draft,
  setDraft,
  onSave,
  onCancel,
}: SensorDialogProps) {
  const [registerDraft, setRegisterDraft] = useState<SensorRegister>({
    name: "",
    address: nextRegisterAddress(draft.nodeId, draft.registers),
    unit: "",
    isHealthCheck: false,
  });

  function updateNodeId(nodeId: number) {
    const registers = draft.registers.map((register, index) => ({
      ...register,
      address: firstNodeRegisterAddress(nodeId) + index,
    }));

    setDraft({
      ...draft,
      nodeId,
      registers,
    });
    setRegisterDraft({
      ...registerDraft,
      address: nextRegisterAddress(nodeId, registers),
    });
  }

  function addRegister() {
    if (!registerDraft.name.trim()) {
      toast.error("Informe o nome do registro.");
      return;
    }

    const firstAddress = firstNodeRegisterAddress(draft.nodeId);
    const lastAddress = lastNodeRegisterAddress(draft.nodeId);

    if (
      !Number.isInteger(registerDraft.address) ||
      registerDraft.address < firstAddress ||
      registerDraft.address > lastAddress
    ) {
      toast.error(
        `O endereço deve ficar entre ${firstAddress} e ${lastAddress}.`,
      );
      return;
    }

    if (
      !registerDraft.isHealthCheck &&
      (registerDraft.scaleType !== undefined ||
        registerDraft.scaleFactor !== undefined) &&
      (registerDraft.scaleType === undefined ||
        !["multiply", "divide"].includes(registerDraft.scaleType) ||
        registerDraft.scaleFactor === undefined ||
        !Number.isFinite(registerDraft.scaleFactor) ||
        registerDraft.scaleFactor <= 0)
    ) {
      toast.error("Informe um fator de escala válido.");
      return;
    }

    if (
      draft.registers.some(
        (register) => register.address === registerDraft.address,
      )
    ) {
      toast.error("Este endereço já foi adicionado.");
      return;
    }

    const registers = [
      ...draft.registers,
      {
        name: registerDraft.name.trim(),
        address: registerDraft.address,
        scaleType: registerDraft.isHealthCheck
          ? undefined
          : registerDraft.scaleType,
        scaleFactor: registerDraft.isHealthCheck
          ? undefined
          : registerDraft.scaleFactor,
        unit: registerDraft.isHealthCheck ? "" : registerDraft.unit.trim(),
        isHealthCheck: registerDraft.isHealthCheck,
      },
    ].sort((a, b) => a.address - b.address);

    setDraft({
      ...draft,
      registers,
    });
    setRegisterDraft({
      name: "",
      address: nextRegisterAddress(draft.nodeId, registers),
      scaleType: undefined,
      scaleFactor: undefined,
      unit: registerDraft.unit,
      isHealthCheck: false,
    });
  }

  function removeRegister(address: number) {
    setDraft({
      ...draft,
      registers: draft.registers.filter(
        (register) => register.address !== address,
      ),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
            {title}
          </div>
          <button
            onClick={onCancel}
            className="inline-flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <SensorFields
            draft={draft}
            setDraft={setDraft}
            onNodeIdChange={updateNodeId}
          />
          <Field label="Descrição">
            <input
              className={inputCls}
              placeholder="Ex.: Vibração e temperatura do conjunto"
              value={draft.description ?? ""}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
            />
          </Field>
          <RegisterEditor
            draft={draft}
            registerDraft={registerDraft}
            setRegisterDraft={setRegisterDraft}
            onAddRegister={addRegister}
            onRemoveRegister={removeRegister}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            onClick={onCancel}
            className="inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs text-muted-foreground hover:bg-muted"
          >
            <X className="size-3" /> Cancelar
          </button>
          <button
            onClick={onSave}
            className="inline-flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
          >
            <Save className="size-3" /> Salvar sensor
          </button>
        </div>
      </div>
    </div>
  );
}

function SensorFields({ draft, setDraft, onNodeIdChange }: SensorFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome do sensor">
          <input
            autoFocus
            className={inputCls}
            placeholder="Ex.: Bomba Hidráulica 01"
            value={draft.name}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
          />
        </Field>
        <Field label="Modelo do sensor">
          <input
            className={inputCls}
            placeholder="Ex.: QM30VT2"
            value={draft.model ?? ""}
            onChange={(event) =>
              setDraft({ ...draft, model: event.target.value })
            }
          />
        </Field>
      </div>
      <div className="grid grid-cols-[minmax(9rem,1.2fr)_minmax(0,1.8fr)] gap-3">
        <Field label="ID do sensor">
          <input
            type="number"
            min={1}
            className={`${inputCls} font-mono`}
            value={draft.nodeId}
            onChange={(event) =>
              onNodeIdChange(Number(event.target.value) || 0)
            }
          />
        </Field>
        <Field label="Localização">
          <input
            className={inputCls}
            placeholder="Mancal superior"
            value={draft.location ?? ""}
            onChange={(event) =>
              setDraft({ ...draft, location: event.target.value })
            }
          />
        </Field>
      </div>
    </>
  );
}

function RegisterEditor({
  draft,
  registerDraft,
  setRegisterDraft,
  onAddRegister,
  onRemoveRegister,
}: RegisterEditorProps) {
  const scaleEnabled =
    !registerDraft.isHealthCheck &&
    registerDraft.scaleType !== undefined &&
    registerDraft.scaleFactor !== undefined;

  return (
    <div className="space-y-2 rounded border border-border bg-background/70 p-3">
      <div className="grid grid-cols-[1.3fr_0.75fr_1fr_0.75fr_auto] items-end gap-2">
        <Field label="Nome do registro">
          <input
            className={inputCls}
            placeholder="Velocidade"
            value={registerDraft.name}
            onChange={(event) =>
              setRegisterDraft({ ...registerDraft, name: event.target.value })
            }
          />
        </Field>
        <Field label="Endereço">
          <input
            type="number"
            className={`${inputCls} font-mono`}
            value={registerDraft.address}
            onChange={(event) =>
              setRegisterDraft({
                ...registerDraft,
                address: Number(event.target.value) || 0,
              })
            }
          />
        </Field>
        <Field label="Unidade">
          <input
            className={`${inputCls} font-mono disabled:cursor-not-allowed disabled:opacity-50`}
            disabled={registerDraft.isHealthCheck}
            placeholder="mm/s"
            value={registerDraft.unit}
            onChange={(event) =>
              setRegisterDraft({ ...registerDraft, unit: event.target.value })
            }
          />
        </Field>
        <label className="flex h-9 items-center gap-2 rounded border border-border bg-background px-2.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={registerDraft.isHealthCheck ?? false}
            onChange={(event) =>
              setRegisterDraft({
                ...registerDraft,
                isHealthCheck: event.target.checked,
                scaleType: undefined,
                scaleFactor: undefined,
                unit: event.target.checked ? "" : registerDraft.unit,
              })
            }
          />
          Status
        </label>
        <button
          onClick={onAddRegister}
          className="inline-flex h-9 items-center justify-center rounded bg-primary px-2.5 text-primary-foreground hover:bg-primary/90"
          aria-label="Adicionar registro"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      <details className="rounded border border-border bg-muted/20 px-3 py-2">
        <summary className="cursor-pointer text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
          Escala
        </summary>
        <div className="mt-3 grid grid-cols-[0.75fr_1fr_1fr] items-end gap-2">
          <label className="flex h-9 items-center gap-2 rounded border border-border bg-background px-2.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              disabled={registerDraft.isHealthCheck}
              checked={scaleEnabled}
              onChange={(event) =>
                setRegisterDraft({
                  ...registerDraft,
                  scaleType: event.target.checked ? "multiply" : undefined,
                  scaleFactor: event.target.checked ? 1 : undefined,
                })
              }
            />
            Aplicar escala
          </label>
          <Field label="Tipo de escala">
            <select
              className={`${inputCls} disabled:cursor-not-allowed disabled:opacity-50`}
              disabled={!scaleEnabled || registerDraft.isHealthCheck}
              value={registerDraft.scaleType ?? "multiply"}
              onChange={(event) =>
                setRegisterDraft({
                  ...registerDraft,
                  scaleType: event.target.value as SensorRegister["scaleType"],
                })
              }
            >
              <option value="multiply">Multiplicar</option>
              <option value="divide">Dividir</option>
            </select>
          </Field>
          <Field label="Multiplicador">
            <input
              type="number"
              step="0.001"
              disabled={!scaleEnabled || registerDraft.isHealthCheck}
              className={`${inputCls} font-mono disabled:cursor-not-allowed disabled:opacity-50`}
              value={registerDraft.scaleFactor ?? 1}
              onChange={(event) =>
                setRegisterDraft({
                  ...registerDraft,
                  scaleFactor: Number(event.target.value) || 0,
                })
              }
            />
          </Field>
        </div>
      </details>

      {draft.registers.length > 0 ? (
        <div className="divide-y divide-border rounded border border-border">
          {draft.registers.map((register) => (
            <RegisterRow
              key={`${register.name}-${register.address}`}
              register={register}
              onRemoveRegister={onRemoveRegister}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RegisterRow({ register, onRemoveRegister }: RegisterRowProps) {
  const scaleLabel =
    register.scaleType && register.scaleFactor
      ? `${register.scaleType === "divide" ? "Dividir" : "Multiplicar"} ${
          register.scaleFactor
        }`
      : "Sem escala";

  return (
    <div className="grid grid-cols-[1.3fr_0.75fr_1fr_0.75fr_auto] items-center gap-2 px-2 py-1.5 text-xs">
      <span className="font-medium">{register.name}</span>
      <span className="font-mono text-muted-foreground">
        {register.address}
      </span>
      <span className="text-muted-foreground">
        {register.isHealthCheck ? "Status" : scaleLabel}
      </span>
      <span className="font-mono text-muted-foreground">
        {register.isHealthCheck ? "-" : register.unit}
      </span>
      <button
        onClick={() => onRemoveRegister(register.address)}
        className="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label="Remover registro"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
