// データベースディレクトリを確保するシンプルなスクリプト
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { importGtfs } from "gtfs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 設定ファイルを読み込む関数
function loadConfig() {
  try {
    const configPath = path.join(process.cwd(), "transit-config.json");
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    console.error("設定ファイルの読み込みに失敗しました:", error);
    throw new Error("設定ファイルの読み込みに失敗しました");
  }
}

// 必要なディレクトリを作成する関数
async function ensureDirectories() {
  try {
    console.log("データベースディレクトリのセットアップを開始");

    // 必要なディレクトリパスを定義
    const dirs = [
      path.join(process.cwd(), ".temp"),
      path.join(process.cwd(), ".temp/gtfs"),
    ];

    // 各ディレクトリの存在を確認し、なければ作成
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        console.log(`ディレクトリを作成: ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
      } else {
        console.log(`ディレクトリは既に存在します: ${dir}`);
      }
    }

    // GTFSデータベースファイルが存在するかチェック
    const dbPath = path.join(process.cwd(), ".temp/gtfs/gtfs.db");
    let needsImport = false;

    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      console.log(`DBファイルが存在します: ${dbPath}`);
      console.log(`サイズ: ${stats.size} バイト`);

      // ファイルサイズが0または小さすぎる場合は削除して再作成
      if (stats.size < 1000) {
        console.log(`DBファイルが小さすぎます。ファイルを削除します。`);
        fs.unlinkSync(dbPath);
        needsImport = true;
      }
    } else {
      console.log(`DBファイルはまだ存在しません: ${dbPath}`);
      needsImport = true;
    }

    // 必要な場合はインポートを実行
    if (needsImport) {
      console.log("GTFSデータのインポートを実行します");
      try {
        // 設定を読み込み
        const config = loadConfig();
        console.log("設定:", JSON.stringify(config, null, 2));

        // インポート実行
        const importResult = await importGtfs(config);
        console.log("インポート結果:", importResult);

        // インポート結果確認
        if (fs.existsSync(dbPath)) {
          const stats = fs.statSync(dbPath);
          console.log(`インポート後のDBファイル: ${dbPath}`);
          console.log(`サイズ: ${stats.size} バイト`);
        }
      } catch (error) {
        console.error("GTFSデータのインポート中にエラーが発生しました:", error);
      }
    }

    console.log("データベースディレクトリのセットアップ完了");
  } catch (error) {
    console.error("ディレクトリ作成中にエラーが発生しました:", error);
  }
}

ensureDirectories();
