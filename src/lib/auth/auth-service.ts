import { sqliteManager } from "../db/sqlite-manager";
import { mailtrapService } from "./mailtrap-client";
import { kofiApiClient } from "./kofi-client";
import { logger } from "../../utils/logger";
import crypto from "crypto";

// 設定
const VERIFICATION_CODE_LENGTH = 6;
const VERIFICATION_CODE_EXPIRY = 10 * 60 * 1000; // 10分
const KOFI_TIER_PAGE_URL =
  process.env.KOFI_TIER_PAGE_URL || "https://ko-fi.com/nawashiro/tiers";

/**
 * 認証関連のサービス
 */
export class AuthService {
  /**
   * ランダムな確認コードを生成
   */
  private generateVerificationCode(length = VERIFICATION_CODE_LENGTH): string {
    // 数字のみの確認コードを生成
    return crypto.randomInt(10 ** (length - 1), 10 ** length).toString();
  }

  /**
   * 支援者登録プロセスを開始（メール送信）
   */
  async startSupporterRegistration(email: string): Promise<{
    success: boolean;
    message: string;
    redirect?: string;
  }> {
    try {
      // まずKo-fiで支援者かどうか確認
      const isActiveMember = await kofiApiClient.isActiveMember(email);

      if (!isActiveMember) {
        return {
          success: false,
          message:
            "Ko-fiでの支援が確認できませんでした。支援者になるにはKo-fiでの登録が必要です。",
          redirect: KOFI_TIER_PAGE_URL,
        };
      }

      // 認証済みかどうかのチェックを削除し、常に新しい確認コードを発行する

      // 確認コードを生成
      const code = this.generateVerificationCode();
      const codeExpires = Date.now() + VERIFICATION_CODE_EXPIRY;

      // 支援者データを登録/更新
      await sqliteManager.createOrUpdateSupporter({
        email,
        verificationCode: code,
        codeExpires,
        verified: false, // 再認証が必要なので一時的にfalseに設定
      });

      // メール送信 - ログからコードを削除
      logger.log(`[AuthService] メール送信開始: ${email}`);
      const emailSent = await mailtrapService.sendVerificationCode(email, code);

      if (emailSent) {
        logger.log(`[AuthService] メール送信成功: ${email}`);
        return {
          success: true,
          message: "確認コードを送信しました。メールをご確認ください",
        };
      } else {
        logger.error(`[AuthService] メール送信失敗: ${email}`);
        return {
          success: false,
          message:
            "確認コードの送信に失敗しました。管理者にお問い合わせください。",
        };
      }
    } catch (error) {
      logger.error("[AuthService] 支援者登録エラー:", error);
      return {
        success: false,
        message: "支援者登録処理中にエラーが発生しました",
      };
    }
  }

  /**
   * 支援者認証コードを検証する
   */
  async verifySupporterCode(
    email: string,
    code: string
  ): Promise<{
    success: boolean;
    message: string;
    isSupporter?: boolean;
    needsRefresh?: boolean;
  }> {
    try {
      // コードの検証
      const isValid = await sqliteManager.verifySupporter(email, code);

      if (isValid) {
        // Ko-fiでの支援状態も確認
        const kofiStatus = await this.checkKofiMembershipStatus(email);

        return {
          success: true,
          message: "認証に成功しました。支援ありがとうございます！",
          isSupporter: kofiStatus.isActive,
          needsRefresh: true, // 画面更新が必要であることを示すフラグ
        };
      }

      return {
        success: false,
        message: "認証コードが無効か期限切れです",
      };
    } catch (error) {
      logger.error("[AuthService] 支援者コード検証エラー:", error);
      return {
        success: false,
        message: "認証処理中にエラーが発生しました",
      };
    }
  }

  /**
   * メールアドレスの支援者状態を確認
   * Ko-fiとローカルDBの両方で確認
   */
  async checkSupporterStatus(email: string): Promise<{
    isSupporter: boolean;
    isVerified: boolean;
    kofiStatus: boolean;
    message: string;
    redirect?: string;
  }> {
    try {
      // ローカルDBで認証済みかを確認
      const isVerified = await sqliteManager.isVerifiedSupporter(email);

      // Ko-fiでアクティブな支援者かを確認
      const isKofiMember = await kofiApiClient.isActiveMember(email);

      // 両方の条件を満たすときのみ支援者と判定
      const isSupporter = isVerified && isKofiMember;

      let message = "";
      let redirect = undefined;

      if (!isKofiMember) {
        message =
          "Ko-fiでの支援が確認できません。支援者特典を利用するにはKo-fiでの支援が必要です。";
        redirect = KOFI_TIER_PAGE_URL;
      } else if (!isVerified) {
        message =
          "メールアドレスの認証が完了していません。認証を完了してください。";
      } else {
        message = "認証済みの支援者です";
      }

      return {
        isSupporter,
        isVerified,
        kofiStatus: isKofiMember,
        message,
        redirect,
      };
    } catch (error) {
      logger.error("[AuthService] 支援者状態チェックエラー:", error);
      // エラーが発生した場合は安全側に倒して制限を適用する（支援者ではないと扱う）
      return {
        isSupporter: false,
        isVerified: false,
        kofiStatus: false,
        message:
          "支援者状態の確認中にエラーが発生しました。制限が適用されます。",
      };
    }
  }

  /**
   * Ko-fiでの支援状態のみを確認
   */
  async checkKofiMembershipStatus(email: string): Promise<{
    isActive: boolean;
    message: string;
    redirect?: string;
  }> {
    try {
      const isActive = await kofiApiClient.isActiveMember(email);

      if (isActive) {
        return {
          isActive: true,
          message: "Ko-fiでの支援が確認できました。",
        };
      } else {
        return {
          isActive: false,
          message:
            "Ko-fiでの支援が確認できません。支援者特典を利用するにはKo-fiでの支援が必要です。",
          redirect: KOFI_TIER_PAGE_URL,
        };
      }
    } catch (error) {
      logger.error("[AuthService] Ko-fi支援状態チェックエラー:", error);
      return {
        isActive: false,
        message: "Ko-fiでの支援状態確認中にエラーが発生しました。",
      };
    }
  }
}

// シングルトンインスタンス
export const authService = new AuthService();
