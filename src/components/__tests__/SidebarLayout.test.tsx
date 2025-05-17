import { render, screen, fireEvent } from "@testing-library/react";
import SidebarLayout from "../SidebarLayout";
import "@testing-library/jest-dom";

// モックコンポーネント
jest.mock("../Sidebar", () => {
  return function MockSidebar() {
    return <div data-testid="mock-sidebar">モックサイドバー</div>;
  };
});

describe("SidebarLayout", () => {
  test("子コンポーネントがレンダリングされること", () => {
    render(
      <SidebarLayout>
        <div data-testid="test-children">テストコンテンツ</div>
      </SidebarLayout>
    );

    expect(screen.getByTestId("test-children")).toBeInTheDocument();
  });

  test("サイドバーがレンダリングされること", () => {
    render(
      <SidebarLayout>
        <div>テストコンテンツ</div>
      </SidebarLayout>
    );

    expect(screen.getByTestId("mock-sidebar")).toBeInTheDocument();
  });

  test("スキップリンクが存在すること", () => {
    render(
      <SidebarLayout>
        <div>テストコンテンツ</div>
      </SidebarLayout>
    );

    const skipLink = screen.getByTestId("skip-to-content");
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute("href", "#main-content");
  });

  test("スキップリンクがクリックされたときにメインコンテンツにフォーカスが移動すること", () => {
    render(
      <SidebarLayout>
        <div>テストコンテンツ</div>
      </SidebarLayout>
    );

    const skipLink = screen.getByTestId("skip-to-content");
    const mainContent = screen.getByRole("main");

    // フォーカス移動の監視
    const focusSpy = jest.spyOn(mainContent, "focus");

    // スキップリンクをクリック
    fireEvent.click(skipLink);

    // メインコンテンツにフォーカスが移動したことを確認
    expect(focusSpy).toHaveBeenCalled();
  });
});
