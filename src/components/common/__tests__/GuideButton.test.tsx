import { render, screen, fireEvent } from "@testing-library/react";
import GuideButton from "../GuideButton";
import { logger } from "../../../utils/logger";

// Googleアナリティクスとロガーのモック
jest.mock("../../../utils/logger", () => ({
  logger: {
    log: jest.fn(),
  },
}));

// Next.jsのLinkコンポーネントをモック
jest.mock("next/link", () => {
  return ({ children, onClick, ...rest }: any) => {
    return (
      <a
        onClick={(e) => {
          e.preventDefault();
          if (onClick) onClick(e);
        }}
        {...rest}
      >
        {children}
      </a>
    );
  };
});

// Googleアナリティクスの型定義
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

describe("GuideButton", () => {
  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();

    // windowにgtagモックを追加
    window.gtag = jest.fn();
  });

  test("ボタンが正しくレンダリングされる", () => {
    render(<GuideButton />);

    // ボタンのテキストと属性を確認
    const button = screen.getByTestId("guide-button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("href", "/beginners-guide");
    expect(button).toHaveTextContent("風ぐるまの使い方を見る（初心者ガイド）");
  });

  test("クリック時にイベントが記録される", () => {
    render(<GuideButton />);

    // ボタンをクリック
    const button = screen.getByTestId("guide-button");
    fireEvent.click(button);

    // ロガーが呼び出されたことを確認
    expect(logger.log).toHaveBeenCalledWith(
      "初心者ガイドボタンがクリックされました"
    );

    // Googleアナリティクスが呼び出されたことを確認
    expect(window.gtag).toHaveBeenCalledWith("event", "guide_button_click", {
      event_category: "engagement",
      event_label: "beginners_guide_navigation",
    });
  });

  test("アクセシビリティ要件を満たしている", () => {
    render(<GuideButton />);

    // aria-labelが設定されていることを確認
    const button = screen.getByTestId("guide-button");
    expect(button).toHaveAttribute("aria-label", "初心者ガイドを見る");
  });
});
