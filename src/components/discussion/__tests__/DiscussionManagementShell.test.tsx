import { render, screen } from "@testing-library/react";
import { DiscussionManagementShell } from "../DiscussionManagementShell";

let pathname = "/discussions";

jest.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

jest.mock("@/components/discussion/DiscussionTabLayout", () => ({
  DiscussionTabLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="metadata-provider">{children}</div>
  ),
}));

jest.mock("@/components/discussion/DiscussionManagementDataProvider", () => ({
  DiscussionManagementDataProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="moderation-provider">{children}</div>
  ),
}));

describe("DiscussionManagementShell", () => {
  it.each([
    "/discussions",
    "/discussions/manage",
    "/discussions/moderator",
  ])("shares providers on %s", (route) => {
    pathname = route;
    render(
      <DiscussionManagementShell discussionListNaddr="naddr1list">
        content
      </DiscussionManagementShell>,
    );

    expect(screen.getByTestId("metadata-provider")).toContainElement(
      screen.getByTestId("moderation-provider"),
    );
  });

  it("does not replace the provider for an individual discussion", () => {
    pathname = "/discussions/naddr1individual";
    render(
      <DiscussionManagementShell discussionListNaddr="naddr1list">
        content
      </DiscussionManagementShell>,
    );

    expect(screen.queryByTestId("metadata-provider")).not.toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });
});
