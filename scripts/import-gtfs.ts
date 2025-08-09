import { PrismaClient } from "@prisma/client";
import { importGtfs } from "gtfs";
import fs from "fs";
import path from "path";
import { loadConfig } from "../src/lib/config/config";

const prisma = new PrismaClient();

/**
 * GTFSデータをインポートしてPrismaを使ってデータベースを再構築します
 */
async function importGtfsData() {
  try {
    console.log("GTFSデータのインポートを開始します...");

    // 設定ファイルを読み込む
    const config = loadConfig();
    console.log(`設定を読み込みました: ${JSON.stringify(config, null, 2)}`);

    // 必要なディレクトリを作成
    const tempDir = path.join(process.cwd(), "prisma", ".temp");
    if (!fs.existsSync(tempDir)) {
      console.log(`ディレクトリを作成: ${tempDir}`);
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // データベースディレクトリが存在することを確認
    const dbDir = path.dirname(path.join(process.cwd(), config.sqlitePath));
    if (!fs.existsSync(dbDir)) {
      console.log(`データベースディレクトリを作成します: ${dbDir}`);
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // データベースファイルが既に存在する場合のチェック
    const dbPath = path.join(process.cwd(), config.sqlitePath);
    if (fs.existsSync(dbPath)) {
      console.log(`既存のデータベースファイルを確認: ${dbPath}`);

      try {
        // 既存のデータをチェック
        const existingCount = await prisma.agency.count();
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
            return;
          }
        }
      }
    }

    // importGtfsを使用してデータをインポート
    console.log("GTFSデータをインポートしています...");
    await importGtfs(config);
    console.log("GTFSデータのインポートが完了しました");

    console.log("データベースとの接続をテストしています...");
    // Prismaを使用してデータが正しくインポートされたか確認
    const agencyCount = await prisma.agency.count();
    const routeCount = await prisma.route.count();
    const stopCount = await prisma.stop.count();
    const tripCount = await prisma.trip.count();

    console.log(`
      インポート結果:
      - エージェンシー: ${agencyCount}件
      - ルート: ${routeCount}件
      - バス停: ${stopCount}件
      - トリップ: ${tripCount}件
    `);

    if (
      agencyCount === 0 &&
      routeCount === 0 &&
      stopCount === 0 &&
      tripCount === 0
    ) {
      console.warn(
        "データがインポートされていないか、Prismaスキーマがテーブル名と一致していない可能性があります。"
      );
    } else {
      console.log(
        "インポートが正常に完了し、Prismaからデータにアクセスできることを確認しました。"
      );
    }
  } catch (error) {
    console.error("GTFSデータのインポート中にエラーが発生しました:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプトを実行
importGtfsData()
  .then(() => {
    console.log("スクリプトの実行が完了しました");
    process.exit(0);
  })
  .catch((error) => {
    console.error("スクリプトの実行中にエラーが発生しました:", error);
    process.exit(1);
  });
