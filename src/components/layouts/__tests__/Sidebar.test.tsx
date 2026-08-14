import { fireEvent, render, screen, within } from "@testing-library/react";
import Sidebar from "../Sidebar";

describe("Sidebar", () => {
  const getSidebarNavigation = () =>
    screen.getByRole("navigation", { name: "サイトナビゲーション" });

  it("サイトナビゲーションという名前のnavランドマークを公開すること", () => {
    render(<Sidebar toggleSidebar={jest.fn()} koFiUsername="nawashiro" />);

    expect(getSidebarNavigation()).toBeInTheDocument();
  });

  it("nav内でmenuとmenuitemのARIAロールを公開しないこと", () => {
    render(<Sidebar toggleSidebar={jest.fn()} koFiUsername="nawashiro" />);

    const navigation = getSidebarNavigation();
    const navigationQueries = within(navigation);

    expect(navigationQueries.queryByRole("menu")).not.toBeInTheDocument();
    expect(navigationQueries.queryByRole("menuitem")).not.toBeInTheDocument();
  });

  it("nav内のすべてのulがliを直接の子要素に持つこと", () => {
    render(<Sidebar toggleSidebar={jest.fn()} koFiUsername="nawashiro" />);

    const navigation = getSidebarNavigation();
    const lists = navigation.querySelectorAll("ul");

    expect(lists.length).toBeGreaterThan(0);

    lists.forEach((list) => {
      expect(Array.from(list.children).every((child) => child.tagName === "LI")).toBe(
        true,
      );
    });
  });

  it("ホームをネイティブなリンクとして公開し、クリックでSidebarを閉じること", () => {
    const toggleSidebar = jest.fn();
    render(<Sidebar toggleSidebar={toggleSidebar} koFiUsername="nawashiro" />);

    const homeLink = within(getSidebarNavigation()).getByRole("link", {
      name: "ホーム",
    });

    expect(homeLink.tagName).toBe("A");
    expect(homeLink).toHaveAttribute("href", "/");
    expect(homeLink.getAttribute("href")).toBeTruthy();

    fireEvent.click(homeLink);

    expect(toggleSidebar).toHaveBeenCalledTimes(1);
  });

  it("サイトマップへの導線を表示しないこと", () => {
    render(<Sidebar toggleSidebar={jest.fn()} koFiUsername="nawashiro" />);

    expect(
      within(getSidebarNavigation()).queryByRole("link", { name: "サイトマップ" }),
    ).not.toBeInTheDocument();
  });

  it("FUNDING.ymlのユーザー名を開発者支援ページへのnative linkに使用すること", () => {
    render(<Sidebar toggleSidebar={jest.fn()} koFiUsername="example" />);

    expect(
      within(getSidebarNavigation()).getByRole("link", {
        name: "開発者を支援する",
      }),
    ).toHaveAttribute("href", "https://ko-fi.com/example/");
  });

  it("更新情報をGitHub Releasesへのnative linkにすること", () => {
    render(<Sidebar toggleSidebar={jest.fn()} koFiUsername={null} />);

    expect(
      within(getSidebarNavigation()).getByRole("link", { name: "更新情報" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/nawashiro/kazaguruma-transit/releases",
    );
  });

  it("FUNDING.ymlにko_fiがなければ開発者支援ページを表示しないこと", () => {
    render(<Sidebar toggleSidebar={jest.fn()} koFiUsername={null} />);

    expect(
      within(getSidebarNavigation()).queryByRole("link", {
        name: "開発者を支援する",
      }),
    ).not.toBeInTheDocument();
  });
});
