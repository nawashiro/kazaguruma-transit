import { render, screen } from "@testing-library/react";
import Sidebar from "../Sidebar";

describe("Sidebar", () => {
  const originalKoFiTierPageUrl = process.env.NEXT_PUBLIC_KOFI_TIER_PAGE_URL;

  afterEach(() => {
    if (originalKoFiTierPageUrl === undefined) {
      delete process.env.NEXT_PUBLIC_KOFI_TIER_PAGE_URL;
      return;
    }

    process.env.NEXT_PUBLIC_KOFI_TIER_PAGE_URL = originalKoFiTierPageUrl;
  });

  it("サイトマップへの導線を表示しないこと", () => {
    render(<Sidebar toggleSidebar={jest.fn()} />);

    expect(
      screen.queryByRole("menuitem", { name: "サイトマップ" }),
    ).not.toBeInTheDocument();
  });

  it("開発者支援ページに環境変数で設定したURLを使用すること", () => {
    process.env.NEXT_PUBLIC_KOFI_TIER_PAGE_URL =
      "https://ko-fi.com/example/tiers";

    render(<Sidebar toggleSidebar={jest.fn()} />);

    expect(
      screen.getByRole("menuitem", { name: "開発者を支援する" }),
    ).toHaveAttribute("href", "https://ko-fi.com/example/tiers");
  });
});
