import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const port = process.env.PORT ?? '4000';
const endpointTimeoutMs = Number(process.env.NEXUS_RUNTIME_STOP_TIMEOUT_MS ?? 3000);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, '../../..');

try {
  const response = await requestRuntimeStop();

  if (response) {
    const body = await response.text();
    console.log(body || 'Runtime parando.');
    process.exit(response.ok ? 0 : 1);
  }

  const stopped = await stopUnresponsiveDevelopmentRuntime();

  if (stopped) {
    console.log('Runtime de desenvolvimento parado.');
    process.exit(0);
  }

  console.log('Runtime não está em execução.');
  process.exit(0);
} catch (error) {
  console.error(error?.message ?? 'Falha ao parar runtime.');
  process.exit(1);
}

async function requestRuntimeStop() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), endpointTimeoutMs);

  try {
    return await fetch(`http://127.0.0.1:${port}/runtime/stop`, {
      method: 'POST',
      signal: controller.signal,
    });
  } catch (error) {
    const code = error?.cause?.code ?? error?.code;

    if (code === 'ECONNREFUSED') return undefined;
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
      return undefined;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function stopUnresponsiveDevelopmentRuntime() {
  if (process.platform === 'win32') {
    return stopWindowsDevelopmentRuntime();
  }

  const processes = await listUnixProcesses();
  const targetPids = developmentRuntimePids(processes);

  if (targetPids.length === 0) return false;

  for (const pid of targetPids.sort((left, right) => right - left)) {
    signalProcess(pid, 'SIGTERM');
  }

  await sleep(1500);

  for (const pid of targetPids.filter(isProcessAlive)) {
    signalProcess(pid, 'SIGKILL');
  }

  await sleep(250);
  return true;
}

async function listUnixProcesses() {
  const { stdout } = await execFileAsync('ps', ['-eo', 'pid=,ppid=,command=']);

  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(\d+)\s+(.+)$/);

      if (!match) return undefined;

      return {
        pid: Number(match[1]),
        ppid: Number(match[2]),
        command: match[3],
      };
    })
    .filter(Boolean);
}

function developmentRuntimePids(processes) {
  const byParent = new Map();
  const roots = new Set();

  for (const processInfo of processes) {
    const children = byParent.get(processInfo.ppid) ?? [];
    children.push(processInfo.pid);
    byParent.set(processInfo.ppid, children);

    if (isDevelopmentRuntimeProcess(processInfo.command)) {
      roots.add(processInfo.pid);
    }
  }

  const pids = new Set(roots);
  const queue = [...roots];

  while (queue.length > 0) {
    const pid = queue.shift();

    for (const childPid of byParent.get(pid) ?? []) {
      if (pids.has(childPid)) continue;

      pids.add(childPid);
      queue.push(childPid);
    }
  }

  return [...pids].filter((pid) => pid !== process.pid);
}

function isDevelopmentRuntimeProcess(command) {
  const normalizedWorkspace = workspaceRoot.replaceAll('\\', '/');
  const normalizedCommand = command.replaceAll('\\', '/');

  if (normalizedCommand.includes('workspace @weber-nexus/runtime dev')) {
    return true;
  }

  return (
    normalizedCommand.includes(normalizedWorkspace) &&
    (normalizedCommand.includes('/apps/runtime/dist/') ||
      normalizedCommand.includes('/node_modules/@nestjs/cli/'))
  );
}

async function stopWindowsDevelopmentRuntime() {
  const { stdout } = await execFileAsync('wmic', [
    'process',
    'where',
    "commandline like '%@weber-nexus/runtime dev%'",
    'get',
    'processid',
    '/value',
  ]);
  const pids = stdout
    .split(/\r?\n/)
    .map((line) => line.match(/^ProcessId=(\d+)$/)?.[1])
    .filter(Boolean)
    .map(Number);

  if (pids.length === 0) return false;

  for (const pid of pids) {
    await execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F']);
  }

  return true;
}

function sleep(durationMs) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function signalProcess(pid, signal) {
  try {
    process.kill(pid, signal);
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error;
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
