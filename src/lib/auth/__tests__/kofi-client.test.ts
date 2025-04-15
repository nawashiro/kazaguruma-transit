import { KofiApiClient, KofiMembershipInfo } from "../kofi-client";
import fetchMock from "jest-fetch-mock";

// 環境変数のモック
const originalEnv = process.env;
beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv, KOFI_API_KEY: "test-api-key" };
});

afterEach(() => {
  process.env = originalEnv;
});

// フェッチモックの設定
fetchMock.enableMocks();

describe("KofiApiClient", () => {
  let kofiClient: KofiApiClient;
  const TEST_API_KEY = "test-api-key";

  // テスト用にAPIキーを設定したKo-fi APIクライアントを拡張
  class TestKofiApiClient extends KofiApiClient {
    constructor() {
      super();
      this.setApiKey(TEST_API_KEY);
    }
  }

  beforeEach(() => {
    fetchMock.resetMocks();
    kofiClient = new TestKofiApiClient();
  });

  describe("checkMembership", () => {
    test("アクティブなメンバーシップを正しく取得できる", async () => {
      // 有効なメンバーシップレスポンスをモック
      const mockResponse: KofiMembershipInfo = {
        email: "test@example.com",
        tier_name: "Basic",
        is_active: true,
        from_name: "Test User",
        amount: 10.0,
        last_payment_date: "2025-03-29T02:59:14Z",
        message_id: "unique-message-id",
        kofi_transaction_id: "transaction-id",
        type: "Donation",
        is_subscription_payment: false,
      };

      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

      const result = await kofiClient.checkMembership("test@example.com");

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/membership/test%40example.com/coffee"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-API-Key": "test-api-key",
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    test("非アクティブなメンバーシップを正しく取得できる", async () => {
      // 非アクティブなメンバーシップレスポンスをモック
      const mockResponse: KofiMembershipInfo = {
        email: "test@example.com",
        tier_name: "Basic",
        is_active: false,
        from_name: null,
        amount: null,
        last_payment_date: null,
        message_id: null,
        kofi_transaction_id: null,
        type: null,
        is_subscription_payment: null,
      };

      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

      const result = await kofiClient.checkMembership("test@example.com");

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-API-Key": "test-api-key",
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    test("APIエラーが発生した場合はnullを返す", async () => {
      // APIエラーをシミュレート
      fetchMock.mockRejectOnce(new Error("API Error"));

      const result = await kofiClient.checkMembership("test@example.com");

      expect(result).toBeNull();
    });

    test("HTTPエラーが発生した場合はnullを返す", async () => {
      // HTTP 404エラーをシミュレート
      fetchMock.mockResponseOnce(JSON.stringify({ error: "Not found" }), {
        status: 404,
      });

      const result = await kofiClient.checkMembership("test@example.com");

      expect(result).toBeNull();
    });
  });

  describe("isActiveMember", () => {
    test("アクティブなメンバーの場合はtrueを返す", async () => {
      // アクティブなメンバーシップレスポンスをモック
      const mockResponse: KofiMembershipInfo = {
        email: "test@example.com",
        tier_name: "Basic",
        is_active: true,
        from_name: "Test User",
        amount: 10.0,
        last_payment_date: "2025-03-29T02:59:14Z",
        message_id: "unique-message-id",
        kofi_transaction_id: "transaction-id",
        type: "Donation",
        is_subscription_payment: false,
      };

      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

      const result = await kofiClient.isActiveMember("test@example.com");

      expect(result).toBe(true);
    });

    test("非アクティブなメンバーの場合はfalseを返す", async () => {
      // 非アクティブなメンバーシップレスポンスをモック
      const mockResponse: KofiMembershipInfo = {
        email: "test@example.com",
        tier_name: "Basic",
        is_active: false,
        from_name: null,
        amount: null,
        last_payment_date: null,
        message_id: null,
        kofi_transaction_id: null,
        type: null,
        is_subscription_payment: null,
      };

      fetchMock.mockResponseOnce(JSON.stringify(mockResponse));

      const result = await kofiClient.isActiveMember("test@example.com");

      expect(result).toBe(false);
    });

    test("APIエラーが発生した場合はfalseを返す", async () => {
      // APIエラーをシミュレート
      fetchMock.mockRejectOnce(new Error("API Error"));

      const result = await kofiClient.isActiveMember("test@example.com");

      expect(result).toBe(false);
    });
  });
});
