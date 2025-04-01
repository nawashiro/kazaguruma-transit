// GTFSインポートをテストするシンプルなスクリプト
import { importGtfs, openDb, closeDb } from "gtfs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testImport() {
  try {
    console.log("インポートテスト開始");

    // 既存のDBファイルを削除
    const dbPath = path.join(process.cwd(), ".temp/gtfs/gtfs.db");
    if (fs.existsSync(dbPath)) {
      console.log(`既存のDBファイルを削除: ${dbPath}`);
      fs.unlinkSync(dbPath);
    }

    // GTFSファイルを直接指定した設定を作成
    const config = {
      sqlitePath: ".temp/gtfs/gtfs.db",
      agencies: [
        {
          agency_key: "chiyoda",
          path: "./public/gtfs/chiyoda_fixed_20250401.zip",
        },
      ],
      verbose: true,
      ignoreDuplicates: true,
      ignoreMissingGTFSDates: true,
    };

    console.log("設定:", JSON.stringify(config, null, 2));

    // .tempディレクトリが存在するか確認、なければ作成
    const tempDir = path.join(process.cwd(), ".temp");
    const gtfsDir = path.join(tempDir, "gtfs");

    if (!fs.existsSync(tempDir)) {
      console.log(`.tempディレクトリを作成`);
      fs.mkdirSync(tempDir);
    }

    if (!fs.existsSync(gtfsDir)) {
      console.log(`.temp/gtfsディレクトリを作成`);
      fs.mkdirSync(gtfsDir);
    }

    console.log("GTFSデータのインポート開始");
    const importResult = await importGtfs(config);
    console.log("インポート結果:", importResult);

    // データベースファイルの確認
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      console.log(`DBファイルが存在します: ${dbPath}`);
      console.log(`サイズ: ${stats.size} バイト`);
    } else {
      console.error(`DBファイルが見つかりません: ${dbPath}`);
    }

    // データベースを開いて閉じることも試してみる
    console.log("データベースを開きます");
    const db = await openDb(config);
    console.log("データベースを閉じます");
    await closeDb(db);

    console.log("インポートテスト完了");
  } catch (error) {
    console.error("エラーが発生しました:", error);
  }
}

testImport();
