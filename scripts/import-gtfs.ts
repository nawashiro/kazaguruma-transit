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
    const tempDir = path.join(process.cwd(), ".temp");
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
