import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import DiscussionLayout from "../layout";

const authProviderMock = jest.fn(
  ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  )
);

jest.mock("next/navigation", () => ({
  useParams: () => ({ naddr: "naddr-test" }),
}));

jest.mock("@/lib/auth/auth-context", () => ({
  AuthProvider: (props: { children: React.ReactNode }) => authProviderMock(props),
}));

jest.mock("@/components/discussion/DiscussionTabLayout", () => ({
  DiscussionTabLayout: ({
    baseHref,
    children,
  }: {
    baseHref: string;
    children: React.ReactNode;
  }) => (
    <div data-testid="discussion-tab-layout" data-base-href={baseHref}>
      {children}
    </div>
  ),
}));

jest.mock("@/components/discussion/DiscussionContentDataProvider", () => ({
  DiscussionContentDataProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="discussion-content-provider">{children}</div>
  ),
}));

jest.mock("@/components/discussion/DiscussionDataProvider", () => ({
  DiscussionDataProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="discussion-data-provider">{children}</div>
  ),
}));

describe("DiscussionLayout", () => {
  beforeEach(() => {
    authProviderMock.mockClear();
  });

  it("does not nest an additional AuthProvider under app root", () => {
    render(
      <DiscussionLayout>
        <div>child content</div>
      </DiscussionLayout>
    );

    expect(screen.getByTestId("discussion-data-provider")).toContainElement(
      screen.getByTestId("discussion-tab-layout"),
    );
    expect(screen.getByTestId("discussion-data-provider")).toContainElement(
      screen.getByTestId("discussion-content-provider"),
    );
    expect(screen.queryByTestId("auth-provider")).not.toBeInTheDocument();
    expect(authProviderMock).not.toHaveBeenCalled();
  });
});
