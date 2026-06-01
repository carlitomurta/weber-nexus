import { login } from "@/lib/auth";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Database, Lock, Radio, Server, User } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Entrar" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setSubmitting(true);
    setTimeout(() => {
      login(
        formData.get("usuario") ? String(formData.get("usuario")) : "operador",
      );
      navigate({ to: "/dashboard" });
      setSubmitting(false);
    }, 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-0 border border-border rounded-lg overflow-hidden bg-card/70 backdrop-blur shadow-2xl">
        {/* Left panel */}
        <div className="p-10 border-r border-border bg-background/40 hidden lg:flex flex-col justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded bg-primary grid place-items-center text-primary-foreground">
              <Radio className="size-4" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">NEXUS</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Webercom tecnologia
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl font-semibold leading-tight">
              Inteligência preditiva
              <br />
              <span className="text-primary">de ponta.</span>
            </h1>
            <p className="text-sm text-muted-foreground max-w-sm">
              Análise offline para fluxos de trabalho industriais. Transmicao de
              dados em tempo real, insights preditivos e controle local para
              ambientes desconectados.
            </p>
          </div>

          <div className="space-y-2 font-mono text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-success animate-pulse" />
              Planta: AMBEV-01
            </div>
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-success" />4
              controladores · 11 sensores
            </div>
          </div>
        </div>

        {/* Right panel */}
        <form onSubmit={onSubmit} className="p-10 space-y-5">
          <div className="space-y-1">
            <div className="text-[11px] font-mono tracking-[0.2em] text-primary uppercase">
              Autenticação
            </div>
            <h2 className="text-2xl font-semibold">
              Conectar ao banco de dados
            </h2>
            <p className="text-sm text-muted-foreground">
              Faça login com suas credenciais de operador para validar o acesso
              ao armazenamento.
            </p>
          </div>

          <Field
            icon={Server}
            label="InfluxDB host"
            defaultValue="localhost:8086"
          />
          <Field
            icon={Database}
            label="Bucket"
            defaultValue="nexus_telemetry"
          />
          <Field icon={User} label="Usuário" defaultValue="operador" />
          <Field
            icon={Lock}
            label="Senha"
            type="password"
            defaultValue="admin"
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded bg-primary text-primary-foreground font-medium text-sm hover:brightness-110 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <span className="size-3 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                Validando…
              </>
            ) : (
              "Conectar e entrar"
            )}
          </button>

          <div className="text-[12px] text-muted-foreground font-mono text-center">
            Modo local · nenhuma informação é transmitida externamente.
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  type = "text",
  defaultValue,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-mono">
        {label}
      </span>
      <div className="flex items-center gap-2 h-10 px-3 rounded border border-input bg-background/60 focus-within:border-primary transition-colors">
        <Icon className="size-3.5 text-muted-foreground" />
        <input
          name={label.toLowerCase()}
          type={type}
          defaultValue={defaultValue}
          className="flex-1 bg-transparent outline-none text-sm"
        />
      </div>
    </label>
  );
}
