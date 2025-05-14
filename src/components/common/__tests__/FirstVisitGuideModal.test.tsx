/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import FirstVisitGuideModal from "../FirstVisitGuideModal";
import { isFirstVisit } from "../../../utils/visitTracker";
import { logger } from "../../../utils/logger";

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
jest.mock("next/navigation", () => {
  const push = jest.fn();
  return {
    useRouter: () => ({
      push,
    }),
  };
});

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
    expect(window.gtag).toHaveBeenCalledWith("event", "Guide_popup_close", {
      event_category: "Engagement",
      event_label: "Beginners_guide_popup_dismissed",
      non_interaction: undefined,
      value: undefined,
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
    expect(window.gtag).toHaveBeenCalledWith("event", "Guide_popup_close", {
      event_category: "Engagement",
      event_label: "Beginners_guide_popup_dismissed",
      non_interaction: undefined,
      value: undefined,
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
