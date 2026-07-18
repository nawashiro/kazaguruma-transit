import { render, screen } from "@testing-library/react";
import Sidebar from "../Sidebar";

describe("Sidebar", () => {
  it("サイトマップへの導線を表示しないこと", () => {
    render(<Sidebar toggleSidebar={jest.fn()} koFiUsername="nawashiro" />);

    expect(
      screen.queryByRole("menuitem", { name: "サイトマップ" }),
    ).not.toBeInTheDocument();
  });

  it("FUNDING.ymlのユーザー名を開発者支援ページに使用すること", () => {
    render(<Sidebar toggleSidebar={jest.fn()} koFiUsername="example" />);

    expect(
      screen.getByRole("menuitem", { name: "開発者を支援する" }),
    ).toHaveAttribute("href", "https://ko-fi.com/example/");
  });

  it("更新情報をGitHub Releasesへリンクすること", () => {
    render(<Sidebar toggleSidebar={jest.fn()} koFiUsername={null} />);

    expect(screen.getByRole("menuitem", { name: "更新情報" })).toHaveAttribute(
      "href",
      "https://github.com/nawashiro/kazaguruma-transit/releases",
    );
  });

  it("FUNDING.ymlにko_fiがなければ開発者支援ページを表示しないこと", () => {
    render(<Sidebar toggleSidebar={jest.fn()} koFiUsername={null} />);

    expect(
      screen.queryByRole("menuitem", { name: "開発者を支援する" }),
    ).not.toBeInTheDocument();
  });
});
