import { MailtrapClient } from "mailtrap";
import { logger } from "../../utils/logger";

// .envから環境変数を読み込む
const MAILTRAP_TOKEN = process.env.MAILTRAP_TOKEN || "";

/**
 * Mailtrapのクライアントラッパー
 */
export class MailtrapService {
  private client: MailtrapClient;
  private sender = {
    email: "hello@demomailtrap.co",
    name: "風ぐるま乗換案内",
  };

  constructor() {
    this.client = new MailtrapClient({ token: MAILTRAP_TOKEN });
  }

  /**
   * 確認コードをメールで送信
   */
  async sendVerificationCode(email: string, code: string): Promise<boolean> {
    try {
      logger.log(`[MailtrapService] メール送信: ${email}`);

      const response = await this.client.send({
        from: this.sender,
        to: [{ email }],
        subject: "【風ぐるま乗換案内】確認コード",
        text: `
風ぐるま乗換案内をご利用いただきありがとうございます。

以下の確認コードを入力して、支援者認証を完了してください：

${code}

このコードは30分間有効です。
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
  <p>このコードは30分間有効です。</p>
  <p style="color: #6b7280; font-size: 12px;">※このメールには返信できません。</p>
</div>
        `,
        category: "Verification",
      });

      logger.log(`[MailtrapService] メール送信結果:`, response);
      return true;
    } catch (error) {
      logger.error("[MailtrapService] メール送信エラー:", error);
      return false;
    }
  }
}

// シングルトンインスタンス
export const mailtrapService = new MailtrapService();
