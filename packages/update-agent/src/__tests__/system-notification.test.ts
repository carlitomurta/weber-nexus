import test from "node:test";
import assert from "node:assert/strict";
import {
  notifyUpdateAvailable,
  systemNotificationCommand,
  type SystemNotificationCommand,
} from "../system-notification.js";

test("systemNotificationCommand creates Linux notify-send command", () => {
  assert.deepEqual(
    systemNotificationCommand(
      {
        title: "Atualização do Nexus disponível",
        body: "Atualização disponível para instalação.",
      },
      "linux",
    ),
    {
      command: "notify-send",
      args: [
        "Atualização do Nexus disponível",
        "Atualização disponível para instalação.",
      ],
    },
  );
});

test("notifyUpdateAvailable runs notification only when action is required", async () => {
  const commands: SystemNotificationCommand[] = [];

  const notified = await notifyUpdateAvailable({
    platform: "linux",
    status: {
      status: "update_available",
      current_version: "1.0.0",
      available_version: "1.0.1",
      channel: "stable",
      message: "Atualização disponível para instalação.",
      requires_action: true,
      checked_at_utc: "2026-08-03T12:00:00.000Z",
    },
    runner: (command) => {
      commands.push(command);
      return Promise.resolve();
    },
  });

  assert.equal(notified, true);
  assert.equal(commands.length, 1);
});

test("notifyUpdateAvailable skips idle status", async () => {
  const notified = await notifyUpdateAvailable({
    platform: "linux",
    status: {
      status: "idle",
      current_version: "1.0.0",
      available_version: null,
      channel: "stable",
      message: "Nenhuma atualização disponível.",
      requires_action: false,
      checked_at_utc: "2026-08-03T12:00:00.000Z",
    },
  });

  assert.equal(notified, false);
});
