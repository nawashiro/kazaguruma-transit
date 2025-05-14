import { isFirstVisit, resetVisitCount, getVisitCount } from "../visitTracker";

// モックストレージを作成
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => {
      return store[key] || null;
    },
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

// windowオブジェクトにモックを設定
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("訪問管理ユーティリティのテスト", () => {
  beforeEach(() => {
    // 各テスト前にストレージをクリア
    localStorageMock.clear();
  });

  test("初めての訪問ではtrueを返す", () => {
    // localStorage が空の状態
    expect(isFirstVisit()).toBe(true);
    // ローカルストレージに値が設定される
    expect(localStorage.getItem("visitCount")).toBe("1");
  });

  test("2回目以降の訪問ではfalseを返す", () => {
    // 一度訪問済み
    localStorage.setItem("visitCount", "1");

    // 2回目の訪問
    expect(isFirstVisit()).toBe(false);
    // 訪問カウントが増加する
    expect(localStorage.getItem("visitCount")).toBe("2");

    // 3回目の訪問
    expect(isFirstVisit()).toBe(false);
    // 訪問カウントが増加する
    expect(localStorage.getItem("visitCount")).toBe("3");
  });

  test("resetVisitCount関数が訪問カウントをリセットする", () => {
    // 訪問カウントを設定
    localStorage.setItem("visitCount", "5");

    // リセット実行
    resetVisitCount();

    // 訪問カウントが削除される
    expect(localStorage.getItem("visitCount")).toBe(null);
  });

  test("getVisitCount関数が正しい訪問カウントを返す", () => {
    // 未訪問
    expect(getVisitCount()).toBe(0);

    // 訪問カウントを設定
    localStorage.setItem("visitCount", "7");
    expect(getVisitCount()).toBe(7);
  });
});
