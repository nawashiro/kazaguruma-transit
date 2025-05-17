import { render, screen, fireEvent } from "@testing-library/react";
import RateLimitModal from "../RateLimitModal";
import "@testing-library/jest-dom";

describe("RateLimitModal", () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    // 各テスト前にモック関数をリセット
    mockOnClose.mockClear();
  });

  test("モーダルが開いているときに表示され、閉じているときは表示されないこと", () => {
    // 閉じている状態のモーダル
    const { rerender } = render(
      <RateLimitModal isOpen={false} onClose={mockOnClose} />
    );
    expect(
      screen.queryByText("リクエスト制限に達しました")
    ).not.toBeInTheDocument();

    // 開いている状態のモーダル
    rerender(<RateLimitModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText("リクエスト制限に達しました")).toBeInTheDocument();
  });

  test("閉じるボタンをクリックするとonClose関数が呼ばれること", () => {
    render(<RateLimitModal isOpen={true} onClose={mockOnClose} />);

    const closeButton = screen.getByRole("button", { name: "閉じる" });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test("「閉じる」ボタンをクリックするとonClose関数が呼ばれること", () => {
    render(<RateLimitModal isOpen={true} onClose={mockOnClose} />);

    const closeButton = screen.getByRole("button", {
      name: "モーダルを閉じる",
    });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test("モーダルの背景をクリックするとonClose関数が呼ばれること", () => {
    render(<RateLimitModal isOpen={true} onClose={mockOnClose} />);

    // モーダルの背景要素を取得
    const backdrop = screen.getByRole("dialog").parentElement;
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  test("ESCキーを押すとonClose関数が呼ばれること", () => {
    render(<RateLimitModal isOpen={true} onClose={mockOnClose} />);

    // ESCキーイベントを発火
    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test("適切なWAI-ARIAロールと属性が設定されていること", () => {
    render(<RateLimitModal isOpen={true} onClose={mockOnClose} />);

    const dialog = screen.getByRole("dialog");

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "rate-limit-title");
    expect(dialog).toHaveAttribute(
      "aria-describedby",
      "rate-limit-description"
    );

    expect(screen.getByText("リクエスト制限に達しました")).toHaveAttribute(
      "id",
      "rate-limit-title"
    );
    expect(
      screen.getByText(/1時間あたり60リクエストの制限に達しました/)
    ).toHaveAttribute("id", "rate-limit-description");
  });
});
