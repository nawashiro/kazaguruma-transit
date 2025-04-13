import { authService } from "../auth-service";
import { kofiApiClient } from "../kofi-client";
import { mailtrapService } from "../mailtrap-client";
import { dataManager } from "../../db/data-manager";

// モックの設定
jest.mock("../kofi-client", () => ({
  kofiApiClient: {
    isActiveMember: jest.fn(),
    checkMembership: jest.fn(),
  },
}));

jest.mock("../mailtrap-client", () => ({
  mailtrapService: {
    sendVerificationCode: jest.fn(),
  },
}));

jest.mock("../../db/sqlite-manager", () => ({
  dataManager: {
    isVerifiedSupporter: jest.fn(),
    createOrUpdateSupporter: jest.fn(),
    verifySupporter: jest.fn(),
  },
}));

describe("AuthService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("startSupporterRegistration", () => {
    test("Ko-fiで支援者でない場合はリダイレクトURLを返す", async () => {
      // モックの設定
      (kofiApiClient.isActiveMember as jest.Mock).mockResolvedValue(false);

      const result = await authService.startSupporterRegistration(
        "test@example.com"
      );

      expect(kofiApiClient.isActiveMember).toHaveBeenCalledWith(
        "test@example.com"
      );
      expect(result).toEqual({
        success: false,
        message: expect.stringContaining("Ko-fiでの支援が確認できません"),
        redirect: expect.stringContaining("ko-fi.com/nawashiro/tiers"),
      });
    });

    test("確認コードを生成して送信する", async () => {
      // モックの設定
      (kofiApiClient.isActiveMember as jest.Mock).mockResolvedValue(true);
      (dataManager.createOrUpdateSupporter as jest.Mock).mockResolvedValue(
        true
      );
      (mailtrapService.sendVerificationCode as jest.Mock).mockResolvedValue(
        true
      );

      const result = await authService.startSupporterRegistration(
        "test@example.com"
      );

      expect(kofiApiClient.isActiveMember).toHaveBeenCalledWith(
        "test@example.com"
      );
      expect(dataManager.createOrUpdateSupporter).toHaveBeenCalled();
      expect(mailtrapService.sendVerificationCode).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: expect.stringContaining("確認コードを送信しました"),
      });
    });

    test("メール送信に失敗した場合", async () => {
      // モックの設定
      (kofiApiClient.isActiveMember as jest.Mock).mockResolvedValue(true);
      (dataManager.createOrUpdateSupporter as jest.Mock).mockResolvedValue(
        true
      );
      (mailtrapService.sendVerificationCode as jest.Mock).mockResolvedValue(
        false
      );

      const result = await authService.startSupporterRegistration(
        "test@example.com"
      );

      expect(result).toEqual({
        success: false,
        message: expect.stringContaining("確認コードの送信に失敗"),
      });
    });
  });

  describe("verifySupporterCode", () => {
    test("確認コードが正しい場合は成功を返す", async () => {
      // モックの設定
      (dataManager.verifySupporter as jest.Mock).mockResolvedValue(true);
      (kofiApiClient.isActiveMember as jest.Mock).mockResolvedValue(true);

      const result = await authService.verifySupporterCode(
        "test@example.com",
        "123456"
      );

      expect(dataManager.verifySupporter).toHaveBeenCalledWith(
        "test@example.com",
        "123456"
      );
      expect(result).toEqual({
        success: true,
        message: "認証に成功しました。支援ありがとうございます！",
        isSupporter: true,
        needsRefresh: true,
      });
    });

    test("確認コードが間違っている場合は失敗を返す", async () => {
      // モックの設定
      (dataManager.verifySupporter as jest.Mock).mockResolvedValue(false);

      const result = await authService.verifySupporterCode(
        "test@example.com",
        "123456"
      );

      expect(result).toEqual({
        success: false,
        message: "認証コードが無効か期限切れです",
      });
    });

    test("Ko-fiでの支援が確認できない場合でも確認コードが正しければ成功を返す", async () => {
      // モックの設定
      (dataManager.verifySupporter as jest.Mock).mockResolvedValue(true);
      (kofiApiClient.isActiveMember as jest.Mock).mockResolvedValue(false);

      const result = await authService.verifySupporterCode(
        "test@example.com",
        "123456"
      );

      expect(result).toEqual({
        success: true,
        message: "認証に成功しました。支援ありがとうございます！",
        isSupporter: false,
        needsRefresh: true,
      });
    });
  });

  describe("checkSupporterStatus", () => {
    test("Ko-fiとローカルDBの両方で認証済みの場合は支援者と判定", async () => {
      // モックの設定
      (dataManager.isVerifiedSupporter as jest.Mock).mockResolvedValue(true);
      (kofiApiClient.isActiveMember as jest.Mock).mockResolvedValue(true);

      const result = await authService.checkSupporterStatus("test@example.com");

      expect(dataManager.isVerifiedSupporter).toHaveBeenCalledWith(
        "test@example.com"
      );
      expect(kofiApiClient.isActiveMember).toHaveBeenCalledWith(
        "test@example.com"
      );
      expect(result).toEqual({
        isSupporter: true,
        isVerified: true,
        kofiStatus: true,
        message: expect.stringContaining("認証済みの支援者"),
      });
    });

    test("Ko-fiでの支援がない場合はリダイレクトURLを返す", async () => {
      // モックの設定
      (dataManager.isVerifiedSupporter as jest.Mock).mockResolvedValue(true);
      (kofiApiClient.isActiveMember as jest.Mock).mockResolvedValue(false);

      const result = await authService.checkSupporterStatus("test@example.com");

      expect(result).toEqual({
        isSupporter: false,
        isVerified: true,
        kofiStatus: false,
        message: expect.stringContaining("Ko-fiでの支援が確認できません"),
        redirect: expect.stringContaining("ko-fi.com/nawashiro/tiers"),
      });
    });

    test("メール認証が未完了の場合はその旨のメッセージを返す", async () => {
      // モックの設定
      (dataManager.isVerifiedSupporter as jest.Mock).mockResolvedValue(false);
      (kofiApiClient.isActiveMember as jest.Mock).mockResolvedValue(true);

      const result = await authService.checkSupporterStatus("test@example.com");

      expect(result).toEqual({
        isSupporter: false,
        isVerified: false,
        kofiStatus: true,
        message: expect.stringContaining(
          "メールアドレスの認証が完了していません"
        ),
      });
    });
  });
});
