import { spawn } from "node:child_process";
import type { UpdateAgentAdminStatus } from "./admin-server.js";

export type SystemNotification = {
  title: string;
  body: string;
};

export type SystemNotificationCommand = {
  command: string;
  args: string[];
};

export type SystemNotificationRunner = (
  command: SystemNotificationCommand,
) => Promise<void>;

export type NotifyUpdateAvailableOptions = {
  status: UpdateAgentAdminStatus;
  platform?: NodeJS.Platform;
  runner?: SystemNotificationRunner;
};

export async function notifyUpdateAvailable(
  options: NotifyUpdateAvailableOptions,
): Promise<boolean> {
  if (!options.status.requires_action || !options.status.available_version) {
    return false;
  }

  const command = systemNotificationCommand(
    {
      title: "Atualização do Nexus disponível",
      body: options.status.message,
    },
    options.platform ?? process.platform,
  );

  if (!command) {
    return false;
  }

  await (options.runner ?? spawnNotificationCommand)(command);
  return true;
}

export function systemNotificationCommand(
  notification: SystemNotification,
  platform: NodeJS.Platform = process.platform,
): SystemNotificationCommand | null {
  if (platform === "linux") {
    return {
      command: "notify-send",
      args: [notification.title, notification.body],
    };
  }

  if (platform === "win32") {
    return {
      command: "powershell.exe",
      args: [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        [
          "$wshell = New-Object -ComObject WScript.Shell",
          `$wshell.Popup(${quotePowerShell(notification.body)}, 0, ${quotePowerShell(
            notification.title,
          )}, 64) | Out-Null`,
        ].join("; "),
      ],
    };
  }

  return null;
}

function spawnNotificationCommand(
  command: SystemNotificationCommand,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command.command, command.args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

function quotePowerShell(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
