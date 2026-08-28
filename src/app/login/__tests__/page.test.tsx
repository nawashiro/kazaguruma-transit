import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockReplace = jest.fn();
const mockLogin = jest.fn<Promise<void>, []>();
const mockCreateAccount = jest.fn<Promise<void>, [string?]>();
const mockUseAuth = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

type PageModule = {
  default?: unknown;
  metadata?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function loadLoginPageModule(): PageModule {
  let loaded: unknown;
  let loadError: unknown = null;

  try {
    // Keep the planned route boundary collectible until the page is implemented.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded public-boundary loader
    loaded = require("../page");
  } catch (error) {
    loadError = error;
  }

  expect(loadError).toBeNull();
  if (loadError !== null) {
    throw new Error(`/login public page could not be loaded: ${String(loadError)}`);
  }
  expect(isRecord(loaded)).toBe(true);
  if (!isRecord(loaded)) {
    throw new Error("/login module did not expose a module object");
  }
  return loaded as PageModule;
}

function getLoginPage() {
  const pageModule = loadLoginPageModule();
  const page = pageModule.default;
  expect(typeof page).toBe("function");
  if (typeof page !== "function") {
    throw new Error("/login default page export is missing");
  }
  return page as React.FunctionComponent;
}

function renderInHostMain(Page: React.FunctionComponent) {
  return render(
    <main id="main-content">
      <Page />
    </main>,
  );
}

describe("/login public page", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockLogin.mockReset();
    mockCreateAccount.mockReset();
    mockSearchParams = new URLSearchParams();
    mockLogin.mockResolvedValue(undefined);
    mockCreateAccount.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: { isLoggedIn: false, pubkey: null },
      login: mockLogin,
      createAccount: mockCreateAccount,
    });
  });

  it("wraps the route in a Suspense boundary with a status fallback for static rendering", () => {
    const Page = getLoginPage();
    const routeElement = Page({});

    expect(React.isValidElement(routeElement)).toBe(true);
    if (!React.isValidElement<{ fallback?: React.ReactNode }>(routeElement)) {
      throw new Error("/login did not return a public React element");
    }
    expect(routeElement.type).toBe(React.Suspense);

    const fallback = routeElement.props.fallback;
    expect(React.isValidElement<{ role?: string }>(fallback)).toBe(true);
    if (!React.isValidElement<{ role?: string }>(fallback)) {
      throw new Error("/login Suspense boundary has no public fallback element");
    }
    expect(fallback.props.role).toBe("status");
  });

  it("supports direct access with page metadata, one main/h1, fixed login mode, and a normal signup link", () => {
    const pageModule = loadLoginPageModule();
    const Page = getLoginPage();
    renderInHostMain(Page);

    expect(isRecord(pageModule.metadata)).toBe(true);
    if (!isRecord(pageModule.metadata)) {
      throw new Error("/login metadata is not a public record");
    }
    expect(typeof pageModule.metadata.title).toBe("string");
    if (typeof pageModule.metadata.title !== "string") {
      throw new Error("/login metadata.title is not a string");
    }
    expect(pageModule.metadata.title.trim()).not.toBe("");
    expect(pageModule.metadata.title).toMatch(/ログイン|Login/i);
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: /ログイン/i })).toBeInTheDocument();
    expect(screen.getByRole("form")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ログイン" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const signupLink = screen.getByRole("link", { name: /アカウント作成|新規登録|サインアップ/ });
    expect(signupLink).toHaveAttribute("href", "/signup");
  });

  it("preserves a safe returnTo on the login page's signup switch link", () => {
    const returnTo = "/settings?tab=profile";
    mockSearchParams = new URLSearchParams({ returnTo });
    const Page = getLoginPage();
    renderInHostMain(Page);

    const signupLink = screen.getByRole("link", { name: "アカウント作成" });
    const href = signupLink.getAttribute("href");
    expect(href).not.toBeNull();
    if (href === null) {
      throw new Error("/login signup switch link did not expose href");
    }

    const target = new URL(href, "https://kazaguruma.invalid");
    expect(target.pathname).toBe("/signup");
    expect(target.searchParams.get("returnTo")).toBe(returnTo);
    expect([...target.searchParams.keys()]).toEqual(["returnTo"]);
  });

  it("calls the existing login operation once and keeps a rejected passkey attempt on the page with Japanese alert", async () => {
    mockLogin.mockRejectedValueOnce(new Error("NotAllowedError"));
    const Page = getLoginPage();
    renderInHostMain(Page);

    fireEvent.submit(screen.getByRole("form"));

    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("alert")).toHaveTextContent(/パスキー|認証|失敗/);
    expect(screen.getByRole("heading", { level: 1, name: /ログイン/i })).toBeInTheDocument();
  });

  it("renders the login reason as a soft informational status message", () => {
    const reason = "投稿するにはログインが必要です。";
    mockSearchParams = new URLSearchParams({ reason });
    const Page = getLoginPage();
    renderInHostMain(Page);

    const reasonNotice = screen.getByRole("status");
    expect(reasonNotice).toHaveTextContent(reason);
    expect(reasonNotice).toHaveAttribute("aria-live", "polite");
    expect(reasonNotice).toHaveClass(
      "alert",
      "alert-info",
      "alert-soft",
      "text-base-content!",
    );
  });

  it.each([
    ["/discussions/create?tab=recent", "/discussions/create?tab=recent"],
    ["https://evil.example/steal?action=post", "/"],
  ])("replaces only with the validated return target for %s", async (returnTo, expectedTarget) => {
    mockSearchParams = new URLSearchParams({ returnTo });
    const Page = getLoginPage();
    renderInHostMain(Page);

    fireEvent.submit(screen.getByRole("form"));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith(expectedTarget);
    const target = mockReplace.mock.calls[0][0] as string;
    expect(target).not.toMatch(/[?&](action|payload|draft)=/i);
  });

  it("does not replay action-like state after authentication", async () => {
    mockSearchParams = new URLSearchParams(
      "returnTo=%2Fdiscussions%2Fcreate%3Faction%3Dpost%26payload%3Dbody%26draft%3D1",
    );
    const Page = getLoginPage();
    renderInHostMain(Page);

    fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));

    expect(mockReplace.mock.calls[0][0]).toBe("/");
    expect(mockReplace.mock.calls[0][0]).not.toContain("post");
    expect(mockReplace.mock.calls[0][0]).not.toContain("payload");
    expect(mockReplace.mock.calls[0][0]).not.toContain("draft");
  });
});
