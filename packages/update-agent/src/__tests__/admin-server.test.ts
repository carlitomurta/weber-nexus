import test from "node:test";
import assert from "node:assert/strict";
import { startUpdateAgentAdminServer } from "../admin-server.js";

test("admin server exposes update status over local token channel", async () => {
  const adminServer = await startUpdateAgentAdminServer({
    token: "agent-token",
    getStatus: () => ({
      status: "update_available",
      current_version: "1.0.0",
      available_version: "1.0.1",
      channel: "stable",
      message: "Atualização disponível para instalação.",
      requires_action: true,
      checked_at_utc: "2026-08-03T12:00:00.000Z",
    }),
  });

  try {
    const response = await fetch(`${adminServer.url}/update/status`, {
      headers: {
        "x-nexus-agent-token": "agent-token",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "update_available",
      current_version: "1.0.0",
      available_version: "1.0.1",
      channel: "stable",
      message: "Atualização disponível para instalação.",
      requires_action: true,
      checked_at_utc: "2026-08-03T12:00:00.000Z",
    });
  } finally {
    await adminServer.close();
  }
});

test("admin server delegates install requests", async () => {
  const adminServer = await startUpdateAgentAdminServer({
    token: "agent-token",
    getStatus: () => ({
      status: "idle",
      current_version: "1.0.0",
      available_version: null,
      channel: "stable",
      message: "Nenhuma atualização disponível.",
      requires_action: false,
      checked_at_utc: "2026-08-03T12:00:00.000Z",
    }),
    install: () => ({
      accepted: true,
      message: "Instalação aceita pelo Nexus Update Agent.",
    }),
  });

  try {
    const response = await fetch(`${adminServer.url}/update/install`, {
      method: "POST",
      headers: {
        "x-nexus-agent-token": "agent-token",
      },
    });

    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), {
      accepted: true,
      message: "Instalação aceita pelo Nexus Update Agent.",
    });
  } finally {
    await adminServer.close();
  }
});

test("admin server rejects invalid token", async () => {
  const adminServer = await startUpdateAgentAdminServer({
    token: "agent-token",
    getStatus: () => ({
      status: "idle",
      current_version: "1.0.0",
      available_version: null,
      channel: "stable",
      message: "Nenhuma atualização disponível.",
      requires_action: false,
      checked_at_utc: "2026-08-03T12:00:00.000Z",
    }),
  });

  try {
    const response = await fetch(`${adminServer.url}/update/status`, {
      headers: {
        "x-nexus-agent-token": "invalid",
      },
    });

    assert.equal(response.status, 403);
  } finally {
    await adminServer.close();
  }
});
