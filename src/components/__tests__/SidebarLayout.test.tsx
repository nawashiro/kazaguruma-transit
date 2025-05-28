import { render, screen } from "@testing-library/react";
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
});
