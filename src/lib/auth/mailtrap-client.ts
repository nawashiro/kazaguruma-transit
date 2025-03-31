import { logger } from "../../utils/logger";
import * as nodemailer from "nodemailer";

// .envから環境変数を読み込む
const MAILTRAP_FROM_EMAIL =
  process.env.MAILTRAP_FROM_EMAIL || "hello@example.com";
const MAILTRAP_FROM_NAME =
  process.env.MAILTRAP_FROM_NAME || "風ぐるま乗換案内【非公式】";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// SMTP設定
const SMTP_HOST = IS_PRODUCTION
  ? "live.smtp.mailtrap.io" // プロダクション用SMTP
  : "sandbox.smtp.mailtrap.io"; // テスト用SMTP
const SMTP_PORT = IS_PRODUCTION ? 587 : 2525;
const SMTP_USER = process.env.MAILTRAP_USER || "";
const SMTP_PASS = process.env.MAILTRAP_PASS || "";

/**
 * メール送信サービス
 */
export class MailtrapService {
  private transporter: nodemailer.Transporter;
  private sender = {
    name: MAILTRAP_FROM_NAME,
    address: MAILTRAP_FROM_EMAIL,
  };

  constructor() {
    try {
      // 認証情報の確認
      if (!SMTP_USER || !SMTP_PASS) {
        logger.error("[MailtrapService] SMTP認証情報が設定されていません");
      }

      // Nodemailerトランスポーターの初期化
      this.transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: false, // TLS接続
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });

      logger.log("[MailtrapService] 初期化完了");
    } catch (error) {
      logger.error("[MailtrapService] 初期化エラー:", error);
      throw error;
    }
  }

  /**
   * 確認コードをメールで送信
   */
  async sendVerificationCode(email: string, code: string): Promise<boolean> {
    try {
      logger.log(`[MailtrapService] メール送信準備: ${email}`);

      // メールオプション設定
      const mailOptions = {
        from: this.sender,
        to: email,
        subject: "【風ぐるま乗換案内】確認コード",
        text: `
風ぐるま乗換案内をご利用いただきありがとうございます。

以下の確認コードを入力して、支援者認証を完了してください：

${code}

このコードは10分間有効です。
※このメールには返信できません。
        `,
        html: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #3b82f6;">風ぐるま乗換案内</h2>
  <p>風ぐるま乗換案内をご利用いただきありがとうございます。</p>
  <p>以下の確認コードを入力して、支援者認証を完了してください：</p>
  <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
    <span style="font-size: 24px; font-weight: bold; letter-spacing: 3px;">${code}</span>
  </div>
  <p>このコードは10分間有効です。</p>
  <p style="color: #6b7280; font-size: 12px;">※このメールには返信できません。</p>
  <p style="color: #6b7280; font-size: 12px;">※このサービスは非公式のもので、千代田区とは関係ありません</p>
</div>
        `,
      };

      // 送信処理
      const info = await this.transporter.sendMail(mailOptions);
      logger.log(`[MailtrapService] メール送信成功: ${email}`);
      return true;
    } catch (error) {
      logger.error("[MailtrapService] メール送信エラー:", error);
      if (error instanceof Error) {
        logger.error(`[MailtrapService] エラーメッセージ: ${error.message}`);
      }
      return false;
    }
  }
}

// シングルトンインスタンス
export const mailtrapService = new MailtrapService();
