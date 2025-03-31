import { NextApiRequest, NextApiResponse } from "next";
import { authService } from "../../../lib/auth/auth-service";
import { logger } from "../../../utils/logger";
import { withRateLimit } from "../../../lib/api/rate-limit-middleware";

/**
 * 支援者関連のAPI
 * POST: メールアドレス登録と確認コード送信
 * PUT: 確認コードの検証
 * GET: 支援者ステータスの確認
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // メソッドに応じた処理
    switch (req.method) {
      case "POST":
        return await handleRegistration(req, res);
      case "PUT":
        return await handleVerification(req, res);
      case "GET":
        return await handleStatusCheck(req, res);
      default:
        return res.status(405).json({
          success: false,
          error: "Method Not Allowed",
        });
    }
  } catch (error) {
    logger.error("[API] 支援者API処理エラー:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
}

/**
 * POST: メールアドレス登録と確認コード送信
 */
async function handleRegistration(req: NextApiRequest, res: NextApiResponse) {
  const { email } = req.body;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({
      success: false,
      error: "有効なメールアドレスを入力してください",
    });
  }

  const result = await authService.startSupporterRegistration(email);
  return res.status(result.success ? 200 : 400).json(result);
}

/**
 * PUT: 確認コードの検証
 */
async function handleVerification(req: NextApiRequest, res: NextApiResponse) {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({
      success: false,
      error: "メールアドレスと確認コードが必要です",
    });
  }

  const result = await authService.verifySupporterCode(email, code);

  // 認証が成功したらクッキーを設定
  if (result.success) {
    res.setHeader(
      "Set-Cookie",
      `supporter_email=${email}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000`
    ); // 1年間有効
  }

  return res.status(result.success ? 200 : 400).json(result);
}

/**
 * GET: 支援者ステータスの確認
 */
async function handleStatusCheck(req: NextApiRequest, res: NextApiResponse) {
  const { email } = req.query;

  if (!email || typeof email !== "string") {
    return res.status(400).json({
      success: false,
      error: "メールアドレスが必要です",
    });
  }

  const result = await authService.checkSupporterStatus(email);
  return res.status(200).json({
    success: true,
    ...result,
  });
}

// レート制限を適用してエクスポート
export default withRateLimit(handler);
