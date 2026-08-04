import test from "node:test";
import assert from "node:assert/strict";
import {
  runRuntimeSupervisorAction,
  runtimeSupervisorCommands,
  type RuntimeSupervisorCommand,
} from "../supervisor.js";

test("runtimeSupervisorCommands uses systemd on Linux", () => {
  assert.deepEqual(runtimeSupervisorCommands("stop", "nexus-runtime", "linux"), [
    {
      command: "systemctl",
      args: ["stop", "nexus-runtime"],
    },
  ]);
});

test("runtimeSupervisorCommands uses service control on Windows", () => {
  assert.deepEqual(runtimeSupervisorCommands("restart", "NexusRuntime", "win32"), [
    {
      command: "sc.exe",
      args: ["stop", "NexusRuntime"],
    },
    {
      command: "sc.exe",
      args: ["start", "NexusRuntime"],
    },
  ]);
});

test("runRuntimeSupervisorAction delegates commands in order", async () => {
  const commands: RuntimeSupervisorCommand[] = [];

  await runRuntimeSupervisorAction({
    action: "restart",
    serviceName: "nexus-runtime",
    platform: "linux",
    runner: (command) => {
      commands.push(command);
      return Promise.resolve();
    },
  });

  assert.deepEqual(commands, [
    {
      command: "systemctl",
      args: ["restart", "nexus-runtime"],
    },
  ]);
});
