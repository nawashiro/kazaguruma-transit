import { PrismaClient } from "@prisma/client";
import { importGtfs } from "gtfs";
import fs from "fs";
import path from "path";
import {
  getPrismaDatasourceUrl,
  loadConfig,
} from "../src/lib/config/config";
import {
  redactSensitiveUrlQueryParameters,
  sanitizeGtfsLogError,
} from "./gtfs-log-sanitizer";

/**
 * GTFSデータをインポートしてPrismaを使ってデータベースを再構築します
 */
async function importGtfsData() {
  let prismaClient: PrismaClient | undefined;

  try {
    console.log("GTFSデータのインポートを開始します...");

    // 設定ファイルを読み込む
    const config = loadConfig();
    const client = new PrismaClient({
      datasourceUrl: getPrismaDatasourceUrl(config.sqlitePath),
    });
    prismaClient = client;

    console.log("設定を読み込みました:", {
      sqlitePath: config.sqlitePath,
      agencyCount: config.agencies.length,
      verbose: config.verbose,
    });

    // 必要なディレクトリを作成
    const tempDir = path.join(process.cwd(), "prisma", ".temp");
    if (!fs.existsSync(tempDir)) {
      console.log(`ディレクトリを作成: ${tempDir}`);
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // データベースディレクトリが存在することを確認
    const dbDir = path.dirname(config.sqlitePath);
    if (!fs.existsSync(dbDir)) {
      console.log(`データベースディレクトリを作成します: ${dbDir}`);
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // データベースファイルが既に存在する場合のチェック
    const dbPath = config.sqlitePath;
    if (fs.existsSync(dbPath)) {
      console.log(`既存のデータベースファイルを確認: ${dbPath}`);

      try {
        // 既存のデータをチェック
        const existingCount = await client.agency.count();
        if (existingCount > 0) {
          console.log(
            `データベースには既に${existingCount}件のエージェンシーデータが存在します。`
          );
          console.log(
            "既存のデータを使用します。再インポートが必要な場合は、データベースファイルを削除してください。"
          );
          return;
        }
      } catch {
        console.log(
          "データベースへの接続に失敗しました。データを再インポートします。"
        );
      }
    }

    // GFTSファイルの存在確認（pathが設定されている場合のみ）
    if (config.agencies.some((agency) => agency.path)) {
      for (const agency of config.agencies) {
        if (agency.path) {
          const gtfsFilePath = path.join(process.cwd(), agency.path);
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

    // importGtfsを使用してデータをインポート
    console.log("GTFSデータをインポートしています...");
    await importGtfs({
      ...config,
      logFunction: (message) => {
        console.log(redactSensitiveUrlQueryParameters(message));
      },
    });
    console.log("GTFSデータのインポートが完了しました");

    console.log("データベースとの接続をテストしています...");
    // Prismaを使用してデータが正しくインポートされたか確認
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
    } else {
      console.log(
        "インポートが正常に完了し、Prismaからデータにアクセスできることを確認しました。"
      );
    }
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

// スクリプトを実行
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
