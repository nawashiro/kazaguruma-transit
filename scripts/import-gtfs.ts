import type { PrismaClient } from "../src/generated/prisma/client";
import { createPrismaClient } from "../src/lib/db/create-prisma-client";
import { importGtfs } from "gtfs";
import fs from "fs";
import path from "path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/lib/config/config";
import {
  redactSensitiveUrlQueryParameters,
  sanitizeGtfsLogError,
} from "./gtfs-log-sanitizer";

async function importGtfsData() {
  let prismaClient: PrismaClient | undefined;

  try {
    console.log("GTFSデータのインポートを開始します...");

    const config = loadConfig();

    console.log("設定を読み込みました:", {
      sqlitePath: config.sqlitePath,
      agencyCount: config.agencies.length,
      verbose: config.verbose,
    });

    if (config.agencies.some((agency) => agency.path)) {
      for (const agency of config.agencies) {
        if (agency.path) {
          const gtfsFilePath = path.resolve(process.cwd(), agency.path);
          if (!fs.existsSync(gtfsFilePath)) {
            console.error(
              `エラー: GTFSデータファイルが見つかりません: ${gtfsFilePath}`
            );
            console.error(
              `${path.dirname(
                gtfsFilePath
              )}ディレクトリに必要なGTFSデータファイルを配置してください。`
            );
            throw new Error(
              `GTFSデータファイルが見つかりません: ${gtfsFilePath}`
            );
          }
        }
      }
    }

    for (const suffix of ["", "-wal", "-shm", "-journal"]) {
      fs.rmSync(config.sqlitePath + suffix, { force: true });
    }
    fs.mkdirSync(path.dirname(config.sqlitePath), { recursive: true });
    const schema = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url)),
        "db",
        "push",
        "--config",
        fileURLToPath(new URL("../prisma.config.ts", import.meta.url)),
      ],
      { encoding: "utf8" },
    );
    if (schema.error) throw schema.error;
    if (schema.status !== 0) {
      throw new Error(redactSensitiveUrlQueryParameters(
        `Prismaスキーマの作成に失敗しました: ${schema.stdout}\n${schema.stderr}`,
      ));
    }
    const client = createPrismaClient(config.sqlitePath);
    prismaClient = client;

    console.log("GTFSデータをインポートしています...");
    await importGtfs({
      ...config,
      logFunction: (message) => {
        console.log(redactSensitiveUrlQueryParameters(message));
      },
    });
    console.log("GTFSデータのインポートが完了しました");

    console.log("データベースとの接続をテストしています...");
    const agencyCount = await client.agency.count();
    const routeCount = await client.route.count();
    const stopCount = await client.stop.count();
    const tripCount = await client.trip.count();
    const stopTimeCount = await client.stopTime.count();
    const calendarCount = await client.calendar.count();
    const calendarDateCount = await client.calendarDate.count();

    console.log(`
      インポート結果:
      - エージェンシー: ${agencyCount}件
      - ルート: ${routeCount}件
      - バス停: ${stopCount}件
      - トリップ: ${tripCount}件
      - ストップタイム: ${stopTimeCount}件
      - カレンダー: ${calendarCount}件
      - カレンダー日付: ${calendarDateCount}件
    `);

    const requiredEntityCounts: Array<[string, number]> = [
      ["エージェンシー", agencyCount],
      ["ルート", routeCount],
      ["バス停", stopCount],
      ["トリップ", tripCount],
      ["ストップタイム", stopTimeCount],
      ["サービス情報", calendarCount + calendarDateCount],
    ];
    const missingRequiredEntities = requiredEntityCounts
      .filter(([, count]) => count === 0)
      .map(([entity]) => entity);

    if (missingRequiredEntities.length > 0) {
      console.warn(
        "データがインポートされていないか、Prismaスキーマがテーブル名と一致していない可能性があります。"
      );
      throw new Error(
        `必須のGTFSデータが不足しています: ${missingRequiredEntities.join("、")}`
      );
    }
    await client.$transaction(async (tx) => {
      await tx.rateLimit.create({
        data: { ip: "cache-validation", count: 0, last_access: BigInt(0) },
      });
      await tx.rateLimit.findUniqueOrThrow({ where: { ip: "cache-validation" } });
      await tx.rateLimit.delete({ where: { ip: "cache-validation" } });
    });
    console.log(
      "インポートが正常に完了し、Prismaからデータにアクセスできることを確認しました。"
    );
  } catch (error) {
    console.error(
      "GTFSデータのインポート中にエラーが発生しました:",
      sanitizeGtfsLogError(error),
    );
    throw error;
  } finally {
    await prismaClient?.$disconnect();
  }
}

importGtfsData()
  .then(() => {
    console.log("スクリプトの実行が完了しました");
    process.exit(0);
  })
  .catch((error) => {
    console.error(
      "スクリプトの実行中にエラーが発生しました:",
      sanitizeGtfsLogError(error),
    );
    process.exit(1);
  });
