import { spawnSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readlinkSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export const projectRoot = path.resolve(process.cwd());
export const port = 3100;
export const serverUrl = `http://127.0.0.1:${port}/`;
export const stateFile = path.join(projectRoot, ".jest", "transit-server.json");

export function pidsListeningOnPort(portNumber) {
  const inodes = new Set();
  const hexPort = portNumber.toString(16).padStart(4, "0");
  for (const table of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    if (!existsSync(table)) continue;
    for (const line of readFileSync(table, "utf8").split("\n").slice(1)) {
      const columns = line.trim().split(/\s+/);
      const localAddress = columns[1];
      if (!localAddress || !columns[9]) continue;
      const [, localPortHex] = localAddress.split(":");
      if (localPortHex.toLowerCase() !== hexPort) continue;
      if (columns[3] !== "0A") continue; // 0A = LISTEN
      // /proc/net/tcp(6) の列順は proc(5) が固定しており、inode は第10列
      inodes.add(columns[9]);
    }
  }
  if (inodes.size === 0) return [];
  const pids = [];
  for (const pidDir of readdirSync("/proc")) {
    if (!/^\d+$/.test(pidDir)) continue;
    const fdDir = `/proc/${pidDir}/fd`;
    let fds;
    try {
      fds = readdirSync(fdDir);
    } catch {
      continue;
    }
    for (const fd of fds) {
      let target;
      try {
        target = readlinkSync(`${fdDir}/${fd}`);
      } catch {
        continue;
      }
      const match = /^socket:\[(\d+)\]$/.exec(target);
      if (match && inodes.has(match[1])) pids.push(Number(pidDir));
    }
  }
  return pids;
}

async function probe(retries, intervalMs) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(serverUrl);
      if (response.ok) return true;
    } catch {
      // 未起動・接続中は張り付けて待つ
    }
    if (attempt + 1 < retries) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  return false;
}

function resolveDbPath(sqlitePath) {
  if (
    sqlitePath === ":memory:" ||
    path.isAbsolute(sqlitePath) ||
    /^[A-Za-z]:[\\/]/.test(sqlitePath)
  ) {
    return sqlitePath;
  }
  return path.join(projectRoot, sqlitePath);
}

export function ensureDatabaseSchema() {
  const configPath = path.join(projectRoot, "transit-config.json");
  if (!existsSync(configPath)) {
    throw new Error(
      "transit-config.json がありません。テストを実行できません。",
    );
  }

  let sqlitePath;
  try {
    sqlitePath = JSON.parse(readFileSync(configPath, "utf8")).sqlitePath;
  } catch {
    throw new Error("transit-config.json を読めませんでした。");
  }
  if (typeof sqlitePath !== "string" || !sqlitePath) {
    throw new Error(
      "transit-config.json の sqlitePath が不正です。テストを実行できません。",
    );
  }

  const dbFile = resolveDbPath(sqlitePath);
  if (dbFile === ":memory:" || existsSync(dbFile)) return;

  // Prismaはfile:パスの親ディレクトリを自前では作らない
  mkdirSync(path.dirname(dbFile), { recursive: true });

  const push = spawnSync(
    process.execPath,
    [
      path.join(projectRoot, "node_modules", "prisma", "build", "index.js"),
      "db",
      "push",
      "--config",
      path.join(projectRoot, "prisma.config.ts"),
    ],
    { cwd: projectRoot, stdio: "inherit" },
  );
  if (push.status !== 0) {
    throw new Error("テスト用データベースのスキーマ作成に失敗しました。");
  }
}

export default async function globalSetup() {
  if (await probe(1, 0)) {
    return;
  }

  ensureDatabaseSchema();

  if (!existsSync(path.join(projectRoot, ".next", "BUILD_ID"))) {
    const build = spawnSync("npm", ["run", "build"], {
      cwd: projectRoot,
      stdio: "inherit",
    });
    if (build.status !== 0) {
      throw new Error(
        "テスト用のproductionビルドが失敗しました。npm run build の出力を確認してください。",
      );
    }
  }

  const child = spawn(
    "node",
    ["node_modules/next/dist/bin/next", "start", "-p", String(port)],
    {
      cwd: projectRoot,
      stdio: ["ignore", "inherit", "inherit"],
    },
  );

  if (!(await probe(90, 1_000))) {
    child.kill("SIGKILL");
    throw new Error("テスト用の本番サーバが3100で応答しませんでした。");
  }

  mkdirSync(path.dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, JSON.stringify({ pid: child.pid }));
}
