import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DiscussionManagementShell } from "../DiscussionManagementShell";

let pathname = "/discussions";
const mockManagementProvider = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

jest.mock("../DiscussionManagementProvider", () => ({
  DiscussionManagementProvider: ({
    children,
    discussionListNaddr,
  }: {
    children: React.ReactNode;
    discussionListNaddr?: string;
  }) => {
    mockManagementProvider({ discussionListNaddr });
    return <div data-testid="management-provider">{children}</div>;
  },
}));

jest.mock("../DiscussionManagementTabLayout", () => ({
  DiscussionManagementTabLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="management-tab-layout">{children}</div>
  ),
}));

describe("DiscussionManagementShell", () => {
  beforeEach(() => {
    pathname = "/discussions";
    mockManagementProvider.mockClear();
  });

  it.each([
    "/discussions",
    "/discussions/manage",
    "/discussions/moderator",
  ])("uses the management provider as the route owner on %s", (route) => {
    pathname = route;
    render(
      <DiscussionManagementShell discussionListNaddr="naddr1list">
        <div data-testid="management-child">content</div>
      </DiscussionManagementShell>,
    );

    const provider = screen.getByTestId("management-provider");
    const tabLayout = screen.getByTestId("management-tab-layout");
    const child = screen.getByTestId("management-child");
    expect(provider).toContainElement(tabLayout);
    expect(tabLayout).toContainElement(child);
    expect(mockManagementProvider).toHaveBeenCalledWith({
      discussionListNaddr: "naddr1list",
    });
  });

  it("leaves individual discussion routes outside the management wrapper", () => {
    pathname = "/discussions/naddr1individual";
    render(
      <DiscussionManagementShell discussionListNaddr="naddr1list">
        <div data-testid="discussion-child">content</div>
      </DiscussionManagementShell>,
    );

    expect(screen.getByTestId("discussion-child")).toBeInTheDocument();
    expect(screen.queryByTestId("management-provider")).not.toBeInTheDocument();
    expect(screen.queryByTestId("management-tab-layout")).not.toBeInTheDocument();
  });
});
