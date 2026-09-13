import { PrismaClient, Prisma } from "@prisma/client";
import {
  getPrismaDatasourceUrl,
  loadConfig,
} from "../config/config";

/**
 * グローバルPrismaインスタンスの型定義
 * Next.jsの開発環境でホットリロード時に複数のインスタンスが作成されるのを防ぐ
 */
const globalForPrisma = global as unknown as { prisma: PrismaClient };

/**
 * Prismaクライアント設定
 * 開発環境では詳細なログを有効化
 */
const prismaClientOptions = {
  log:
    process.env.NODE_ENV === "development"
      ? (["query", "error", "warn"] as Prisma.LogLevel[])
      : (["error"] as Prisma.LogLevel[]),
} satisfies Prisma.PrismaClientOptions;

function createPrismaClient(): PrismaClient {
  const config = loadConfig();

  return new PrismaClient({
    ...prismaClientOptions,
    datasourceUrl: getPrismaDatasourceUrl(config.sqlitePath),
  });
}

// シングルトンインスタンスを作成または再利用
export const prisma =
  globalForPrisma.prisma || createPrismaClient();

// 開発環境のみ、グローバル変数にインスタンスを保存
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
