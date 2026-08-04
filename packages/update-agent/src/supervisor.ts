import { spawn } from "node:child_process";

export type RuntimeSupervisorAction = "start" | "stop" | "restart";

export type RuntimeSupervisorCommand = {
  command: string;
  args: string[];
};

export type RuntimeSupervisorRunner = (
  command: RuntimeSupervisorCommand,
) => Promise<void>;

export type RuntimeSupervisorOptions = {
  action: RuntimeSupervisorAction;
  serviceName?: string;
  platform?: NodeJS.Platform;
  runner?: RuntimeSupervisorRunner;
};

const DEFAULT_SERVICE_NAME = "nexus-runtime";

export async function runRuntimeSupervisorAction(
  options: RuntimeSupervisorOptions,
): Promise<void> {
  const commands = runtimeSupervisorCommands(
    options.action,
    options.serviceName ?? DEFAULT_SERVICE_NAME,
    options.platform ?? process.platform,
  );
  const runner = options.runner ?? spawnSupervisorCommand;

  for (const command of commands) {
    await runner(command);
  }
}

export function runtimeSupervisorCommands(
  action: RuntimeSupervisorAction,
  serviceName = DEFAULT_SERVICE_NAME,
  platform: NodeJS.Platform = process.platform,
): RuntimeSupervisorCommand[] {
  if (platform === "win32") {
    if (action === "restart") {
      return [
        { command: "sc.exe", args: ["stop", serviceName] },
        { command: "sc.exe", args: ["start", serviceName] },
      ];
    }

    return [{ command: "sc.exe", args: [action, serviceName] }];
  }

  if (platform === "linux") {
    return [{ command: "systemctl", args: [action, serviceName] }];
  }

  throw new Error(
    `Supervisor de Runtime não suportado para plataforma ${platform}.`,
  );
}

function spawnSupervisorCommand(command: RuntimeSupervisorCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command.command, command.args, {
      stdio: "ignore",
      windowsHide: true,
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `Comando do supervisor falhou: ${command.command} ${command.args.join(
            " ",
          )}`,
        ),
      );
    });
  });
}
