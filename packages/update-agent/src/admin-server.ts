import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { NexusUpdateChannel } from "./types.js";

export type UpdateAgentAdminStatusName =
  | "idle"
  | "checking"
  | "update_available"
  | "downloading"
  | "downloaded"
  | "ready_to_install"
  | "installing"
  | "healthy"
  | "maintenance"
  | "failed";

export type UpdateAgentAdminStatus = {
  status: UpdateAgentAdminStatusName;
  current_version: string;
  available_version: string | null;
  channel: NexusUpdateChannel;
  message: string;
  requires_action: boolean;
  checked_at_utc: string;
};

export type UpdateAgentInstallResult = {
  accepted: boolean;
  message: string;
};

export type UpdateAgentAdminServerOptions = {
  host?: "127.0.0.1";
  port?: number;
  token?: string;
  getStatus: () => Promise<UpdateAgentAdminStatus> | UpdateAgentAdminStatus;
  install?: () => Promise<UpdateAgentInstallResult> | UpdateAgentInstallResult;
};

export type UpdateAgentAdminServer = {
  server: Server;
  url: string;
  close: () => Promise<void>;
};

export async function startUpdateAgentAdminServer(
  options: UpdateAgentAdminServerOptions,
): Promise<UpdateAgentAdminServer> {
  if (process.env.NODE_ENV === "production" && !options.token) {
    throw new Error(
      "Token do canal administrativo do Nexus Update Agent deve ser configurado em produção.",
    );
  }

  const host = options.host ?? "127.0.0.1";
  const server = createServer((request, response) => {
    void handleRequest(request, response, options);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address() as AddressInfo;

  return {
    server,
    url: `http://${host}:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
  };
}

async function handleRequest(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  options: UpdateAgentAdminServerOptions,
): Promise<void> {
  if (!isLocalAddress(request.socket.remoteAddress)) {
    writeJson(response, 403, {
      message:
        "Canal administrativo do Nexus Update Agent aceita apenas conexões locais.",
    });
    return;
  }

  if (!hasValidToken(request, options.token)) {
    writeJson(response, 403, {
      message: "Token do Nexus Update Agent inválido.",
    });
    return;
  }

  try {
    if (request.method === "GET" && request.url === "/update/status") {
      writeJson(response, 200, await options.getStatus());
      return;
    }

    if (request.method === "POST" && request.url === "/update/install") {
      writeJson(
        response,
        202,
        options.install
          ? await options.install()
          : {
              accepted: false,
              message:
                "Instalação não configurada neste Nexus Update Agent.",
            },
      );
      return;
    }

    writeJson(response, 404, {
      message: "Endpoint administrativo não encontrado.",
    });
  } catch (error) {
    writeJson(response, 500, {
      message:
        error instanceof Error
          ? `Falha no Nexus Update Agent: ${error.message}`
          : "Falha no Nexus Update Agent.",
    });
  }
}

function hasValidToken(
  request: IncomingMessage,
  configuredToken: string | undefined,
): boolean {
  if (!configuredToken) {
    return process.env.NODE_ENV !== "production";
  }

  return request.headers["x-nexus-agent-token"] === configuredToken;
}

function isLocalAddress(address: string | undefined): boolean {
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1"
  );
}

function writeJson(
  response: import("node:http").ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}
