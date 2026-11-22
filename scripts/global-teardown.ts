import { rmSync, readFileSync } from "node:fs";
import {
  port,
  stateFile,
  pidsListeningOnPort,
} from "./global-setup";

async function waitUntilDown(freeDeadline: number): Promise<boolean> {
  while (Date.now() < freeDeadline) {
    if (pidsListeningOnPort(port).length === 0) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

export default async function globalTeardown(): Promise<void> {
  let state: { pid: number };
  try {
    state = JSON.parse(readFileSync(stateFile, "utf8")) as { pid: number };
  } catch {
    return;
  }
  rmSync(stateFile, { force: true });

  try {
    process.kill(state.pid, "SIGTERM");
  } catch {
    // 既に終わっている
  }

  if (await waitUntilDown(Date.now() + 10_000)) return;

  try {
    process.kill(state.pid, "SIGKILL");
  } catch {
    // 既に終わっている
  }

  for (const pid of pidsListeningOnPort(port)) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // 既に終わっている
    }
  }

  if (!(await waitUntilDown(Date.now() + 5_000))) {
    throw new Error(`テスト後に${port}ポートのサーバが解放できませんでした。`);
  }
}
