/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, act } from "@testing-library/react";
import FirstVisitGuideModal from "../FirstVisitGuideModal";
import { isFirstVisit } from "../../../utils/visitTracker";
import { logger } from "../../../utils/logger";
import * as nextNavigation from "next/navigation";

// モジュールのモック
jest.mock("../../../utils/visitTracker", () => ({
  isFirstVisit: jest.fn(),
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    log: jest.fn(),
  },
}));

// next/navigationのuseRouterをモック
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Googleアナリティクスの型定義
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

describe("FirstVisitGuideModal", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    window.gtag = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("初回訪問の場合にモーダルが表示される", async () => {
    // 初回訪問としてモック
    (isFirstVisit as jest.Mock).mockReturnValue(true);

    render(<FirstVisitGuideModal />);

    // タイマーが実行されるまでモーダルは表示されない
    expect(screen.queryByTestId("first-visit-modal")).not.toBeInTheDocument();

    // タイマーを進める
    await act(async () => {
      jest.advanceTimersByTime(1600);
    });

    // モーダルが表示される
    expect(screen.getByTestId("first-visit-modal")).toBeInTheDocument();
    expect(screen.getByText("風ぐるまは初めてですか？")).toBeInTheDocument();
    expect(logger.log).toHaveBeenCalledWith(
      "初回訪問ポップアップが表示されました"
    );
  });

  test("初回訪問でない場合にモーダルが表示されない", async () => {
    // 初回訪問でないとしてモック
    (isFirstVisit as jest.Mock).mockReturnValue(false);

    render(<FirstVisitGuideModal />);

    // タイマーを進める
    await act(async () => {
      jest.advanceTimersByTime(1600);
    });

    // モーダルは表示されない
    expect(screen.queryByTestId("first-visit-modal")).not.toBeInTheDocument();
  });

  test("「後で見る」ボタンをクリックするとモーダルが閉じる", async () => {
    // 初回訪問としてモック
    (isFirstVisit as jest.Mock).mockReturnValue(true);

    render(<FirstVisitGuideModal />);

    // タイマーを進める
    await act(async () => {
      jest.advanceTimersByTime(1600);
    });

    // モーダルが表示される
    expect(screen.getByTestId("first-visit-modal")).toBeInTheDocument();

    // 「後で見る」ボタンをクリック
    fireEvent.click(screen.getByTestId("close-guide-modal"));

    // モーダルが閉じる
    expect(screen.queryByTestId("first-visit-modal")).not.toBeInTheDocument();
    expect(logger.log).toHaveBeenCalledWith(
      "初回訪問ポップアップが閉じられました"
    );
    expect(window.gtag).toHaveBeenCalledWith("event", "guide_popup_close", {
      event_category: "engagement",
      event_label: "beginners_guide_popup_dismissed",
    });
  });

  test("右上の閉じるボタンをクリックするとモーダルが閉じる", async () => {
    // 初回訪問としてモック
    (isFirstVisit as jest.Mock).mockReturnValue(true);

    render(<FirstVisitGuideModal />);

    // タイマーを進める
    await act(async () => {
      jest.advanceTimersByTime(1600);
    });

    // モーダルが表示される
    expect(screen.getByTestId("first-visit-modal")).toBeInTheDocument();

    // 閉じるボタン(SVGアイコン)をクリック
    fireEvent.click(screen.getByLabelText("閉じる"));

    // モーダルが閉じる
    expect(screen.queryByTestId("first-visit-modal")).not.toBeInTheDocument();
    expect(logger.log).toHaveBeenCalledWith(
      "初回訪問ポップアップが閉じられました"
    );
    expect(window.gtag).toHaveBeenCalledWith("event", "guide_popup_close", {
      event_category: "engagement",
      event_label: "beginners_guide_popup_dismissed",
    });
  });

  test("「使い方を見る」ボタンをクリックするとガイドページへ移動する", async () => {
    // 初回訪問としてモック
    (isFirstVisit as jest.Mock).mockReturnValue(true);

    const mockRouter = {
      push: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    };
    jest.spyOn(nextNavigation, "useRouter").mockReturnValue(mockRouter);

    render(<FirstVisitGuideModal />);

    // タイマーを進める
    await act(async () => {
      jest.advanceTimersByTime(1600);
    });

    // 「使い方を見る」ボタンをクリック
    fireEvent.click(screen.getByTestId("go-to-guide"));

    // モーダルが閉じる
    expect(screen.queryByTestId("first-visit-modal")).not.toBeInTheDocument();

    // ガイドページへの遷移が呼び出される
    expect(mockRouter.push).toHaveBeenCalledWith("/beginners-guide");
    expect(logger.log).toHaveBeenCalledWith(
      "初回訪問ポップアップからガイドページへ移動します"
    );
    expect(window.gtag).toHaveBeenCalledWith("event", "guide_popup_click", {
      event_category: "engagement",
      event_label: "beginners_guide_popup_navigation",
    });
  });

  test("モーダルのスタイル属性が正しく設定されている", async () => {
    // 初回訪問としてモック
    (isFirstVisit as jest.Mock).mockReturnValue(true);

    render(<FirstVisitGuideModal />);

    // タイマーを進める
    await act(async () => {
      jest.advanceTimersByTime(1600);
    });

    // 新しいデザインの属性を確認
    const modal = screen.getByTestId("first-visit-modal");
    expect(modal).toHaveClass("fixed bottom-0 left-0 right-0");
    expect(modal).toHaveClass("animate-slideUp");
  });
});
