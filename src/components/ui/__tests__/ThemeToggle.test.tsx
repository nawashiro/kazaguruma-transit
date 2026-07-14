import { fireEvent, render, screen } from "@testing-library/react";
import ThemeToggle from "../ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: () => ({ matches: false }),
    });
  });

  it("テーマ切替に名前と44pxの操作領域を持つ", () => {
    render(<ThemeToggle />);

    const toggle = screen.getByRole("checkbox", { name: "ダークモードに切り替え" });
    expect(toggle).toHaveClass("toggle", "theme-controller");
    expect(toggle.parentElement).toHaveClass("min-h-[44px]", "min-w-[44px]");
    fireEvent.click(toggle);
    expect(toggle).toHaveAccessibleName("ライトモードに切り替え");
  });
});
