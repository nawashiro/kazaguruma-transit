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

jest.mock("@/components/discussion/DiscussionDetailProvider", () => ({
  DiscussionDetailProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="discussion-detail-provider">{children}</div>
  ),
}));

describe("DiscussionLayout", () => {
  beforeEach(() => {
    authProviderMock.mockClear();
  });

  it("uses the detail provider for the shared route shell without legacy wrappers", () => {
    render(
      <DiscussionLayout>
        <div data-testid="discussion-child">child content</div>
      </DiscussionLayout>
    );

    const detailProvider = screen.getByTestId("discussion-detail-provider");
    expect(detailProvider).toContainElement(
      screen.getByTestId("discussion-tab-layout"),
    );
    expect(detailProvider).toContainElement(
      screen.getByTestId("discussion-child"),
    );
    expect(screen.queryByTestId("discussion-data-provider")).not.toBeInTheDocument();
    expect(screen.queryByTestId("discussion-content-provider")).not.toBeInTheDocument();
    expect(screen.queryByTestId("auth-provider")).not.toBeInTheDocument();
    expect(authProviderMock).not.toHaveBeenCalled();
  });
});
