import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/components/discussion/DiscussionManagementTabLayout", () => ({
  DiscussionManagementTabLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="management-layout">{children}</div>
  ),
}));

jest.mock("@/components/discussion/DiscussionTabLayout", () => ({
  DiscussionTabLayout: ({
    children,
    naddr,
  }: {
    children: React.ReactNode;
    naddr?: string;
  }) => (
    <div data-testid="discussion-layout" data-naddr={naddr}>
      {children}
    </div>
  ),
}));

import ModeratorLayout from "../layout";

describe("ModeratorLayout", () => {
  it("places management UI inside the single discussion metadata provider", () => {
    render(<ModeratorLayout>content</ModeratorLayout>);

    expect(screen.getByTestId("discussion-layout")).toContainElement(
      screen.getByTestId("management-layout"),
    );
  });
});
