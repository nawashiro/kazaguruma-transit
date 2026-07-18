import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/components/discussion/DiscussionManagementTabLayout", () => ({
  DiscussionManagementTabLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="management-layout">{children}</div>
  ),
}));

import ModeratorLayout from "../layout";

describe("ModeratorLayout", () => {
  it("uses the management tabs without creating a second metadata provider", () => {
    render(<ModeratorLayout>content</ModeratorLayout>);

    expect(screen.getByTestId("management-layout")).toHaveTextContent("content");
    expect(screen.queryByTestId("discussion-layout")).not.toBeInTheDocument();
  });
});
