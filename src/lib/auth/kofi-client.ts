import { logger } from "../../utils/logger";

// Ko-fiの独自API定数
const KOFI_API_BASE_URL =
  process.env.KOFI_API_BASE_URL || "http://localhost:3001/api";
const KOFI_TIER_NAME = process.env.KOFI_TIER_NAME || "Basic";
const KOFI_API_KEY = process.env.KOFI_API_KEY || "";

// メンバーシップ情報のインターフェース
export interface KofiMembershipInfo {
  email: string;
  tier_name: string;
  is_active: boolean;
  from_name: string | null;
  amount: number | null;
  last_payment_date: string | null;
  message_id: string | null;
  kofi_transaction_id: string | null;
  type: string | null;
  is_subscription_payment: boolean | null;
}

/**
 * Ko-fi APIクライアント
 */
export class KofiApiClient {
  private apiKey: string = KOFI_API_KEY;

  /**
   * APIキーを設定
   * @param key APIキー
   */
  setApiKey(key: string): void {
    this.apiKey = key;
  }

  /**
   * メンバーシップ状態を確認
   * @param email 確認するメールアドレス
   * @returns メンバーシップ情報
   */
  async checkMembership(email: string): Promise<KofiMembershipInfo | null> {
    try {
      logger.log(`[KofiApiClient] メンバーシップ確認: ${email}`);

      const encodedEmail = encodeURIComponent(email);
      const encodedTier = encodeURIComponent(KOFI_TIER_NAME);
      const url = `${KOFI_API_BASE_URL}/membership/${encodedEmail}/${encodedTier}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.apiKey,
        },
      });

      if (!response.ok) {
        logger.error(
          `[KofiApiClient] API応答エラー: ${response.status} ${response.statusText}`
        );
        return null;
      }

      const data = (await response.json()) as KofiMembershipInfo;
      logger.log(`[KofiApiClient] メンバーシップ確認結果:`, data);

      return data;
    } catch (error) {
      logger.error("[KofiApiClient] メンバーシップ確認エラー:", error);
      return null;
    }
  }

  /**
   * メンバーシップが有効かどうかを確認
   * @param email 確認するメールアドレス
   * @returns 有効なメンバーシップを持っているかどうか
   */
  async isActiveMember(email: string): Promise<boolean> {
    try {
      const membershipInfo = await this.checkMembership(email);
      return !!membershipInfo?.is_active;
    } catch (error) {
      logger.error("[KofiApiClient] メンバーシップ状態確認エラー:", error);
      return false;
    }
  }
}

// シングルトンインスタンス
export const kofiApiClient = new KofiApiClient();
