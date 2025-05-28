import { render, screen, fireEvent, act } from "@testing-library/react";
import FirstVisitGuideModal from "../common/FirstVisitGuideModal";
import "@testing-library/jest-dom";
import { isFirstVisit } from "../../utils/visitTracker";
import { useRouter } from "next/navigation";

// モック
jest.mock("../../utils/visitTracker", () => ({
  isFirstVisit: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    log: jest.fn(),
  },
}));

jest.mock("@/lib/analytics/useGA", () => ({
  sendEvent: jest.fn(),
}));

describe("FirstVisitGuideModal", () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
    // 初期状態では初回訪問として扱う
    (isFirstVisit as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  test("初回訪問時は1.5秒後にモーダルが表示されること", async () => {
    render(<FirstVisitGuideModal />);

    // 初期状態では表示されない
    expect(screen.queryByTestId("first-visit-modal")).not.toBeInTheDocument();

    // 1.5秒後に表示される
    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(screen.getByTestId("first-visit-modal")).toBeInTheDocument();
  });

  test("初回訪問でない場合はモーダルが表示されないこと", () => {
    (isFirstVisit as jest.Mock).mockReturnValue(false);

    render(<FirstVisitGuideModal />);

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(screen.queryByTestId("first-visit-modal")).not.toBeInTheDocument();
  });

  test("「後で見る」ボタンをクリックするとモーダルが閉じること", () => {
    render(<FirstVisitGuideModal />);

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    const closeButton = screen.getByTestId("close-guide-modal");
    fireEvent.click(closeButton);

    expect(screen.queryByTestId("first-visit-modal")).not.toBeInTheDocument();
  });

  test("「使い方を見る」ボタンをクリックするとガイドページに遷移すること", () => {
    render(<FirstVisitGuideModal />);

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    const guideButton = screen.getByTestId("go-to-guide");
    fireEvent.click(guideButton);

    expect(mockPush).toHaveBeenCalledWith("/beginners-guide");
    expect(screen.queryByTestId("first-visit-modal")).not.toBeInTheDocument();
  });

  test("ESCキーを押すとモーダルが閉じること", () => {
    render(<FirstVisitGuideModal />);

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(screen.getByTestId("first-visit-modal")).toBeInTheDocument();

    // ESCキーイベントを発火
    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });

    expect(screen.queryByTestId("first-visit-modal")).not.toBeInTheDocument();
  });

  test("適切なWAI-ARIAロールと属性が設定されていること", () => {
    render(<FirstVisitGuideModal />);

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    const dialog = screen.getByRole("dialog");

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "modal-title");
    expect(dialog).toHaveAttribute("aria-describedby", "modal-description");

    expect(screen.getByText("風ぐるまは初めてですか？")).toHaveAttribute(
      "id",
      "modal-title"
    );
    expect(
      screen.getByText("風ぐるまの使い方や基本情報を確認してみませんか？")
    ).toHaveAttribute("id", "modal-description");
  });
});
