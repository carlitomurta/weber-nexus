import { type ComponentType, type SubmitEvent, useState } from "react";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { isAxiosError } from "axios";
import { Lock, Mail } from "lucide-react";

import { AppLogo } from "@/components/shared/AppLogo";
import { useLogin } from "@/hooks/react-query/useLogin";
import { login } from "@/lib/auth";
import { loginInputSchema } from "../../types/auth.type";

interface FieldProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
}

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Entrar" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const [validationError, setValidationError] = useState<string | null>(null);

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const credentials = loginInputSchema.safeParse({
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });

    if (!credentials.success) {
      setValidationError("Informe e-mail e senha válidos.");
      return;
    }

    try {
      setValidationError(null);
      const data = await loginMutation.mutateAsync(credentials.data);
      login(data.user);
      navigate({ to: "/dashboard" });
    } catch {
      setValidationError(null);
    }
  };

  const errorMessage =
    validationError ?? getLoginErrorMessage(loginMutation.error);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-0 border border-border rounded-lg overflow-hidden bg-card/70 backdrop-blur shadow-2xl">
        <div className="p-10 border-r border-border bg-background/40 hidden lg:flex flex-col justify-between">
          <AppLogo />

          <div className="space-y-4">
            <h1 className="text-3xl font-semibold leading-tight">
              Inteligência preditiva
              <br />
              <span className="text-primary">de ponta.</span>
            </h1>
            <p className="text-sm text-muted-foreground max-w-sm">
              Análise offline para fluxos de trabalho industriais. Transmissão
              de dados em tempo real, insights preditivos e controle local para
              ambientes desconectados.
            </p>
          </div>

          <div className="space-y-2 font-mono text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-success animate-pulse" />
              Planta: AMBEV-01
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="p-10 space-y-5">
          <AppLogo className="lg:hidden" />

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
            icon={Mail}
            label="E-mail"
            name="email"
            defaultValue="admin@admin.com"
          />
          <Field
            icon={Lock}
            label="Senha"
            name="password"
            type="password"
            defaultValue="12345678"
          />

          {errorMessage ? (
            <div className="rounded border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
              {errorMessage}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full h-11 rounded bg-primary text-primary-foreground font-medium text-sm hover:brightness-110 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loginMutation.isPending ? (
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
  name,
  type = "text",
  defaultValue,
}: FieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-mono">
        {label}
      </span>
      <div className="flex items-center gap-2 h-10 px-3 rounded border border-input bg-background/60 focus-within:border-primary transition-colors">
        <Icon className="size-3.5 text-muted-foreground" />
        <input
          name={name}
          type={type}
          defaultValue={defaultValue}
          required
          className="flex-1 bg-transparent outline-none text-sm"
        />
      </div>
    </label>
  );
}

function getLoginErrorMessage(error: unknown) {
  if (!error) {
    return null;
  }

  if (isAxiosError(error) && error.response?.status === 401) {
    return "E-mail ou senha inválidos.";
  }

  return "Não foi possível conectar ao runtime.";
}
