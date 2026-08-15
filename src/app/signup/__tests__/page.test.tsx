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

function loadSignupPageModule(): PageModule {
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
    throw new Error(`/signup public page could not be loaded: ${String(loadError)}`);
  }
  expect(isRecord(loaded)).toBe(true);
  if (!isRecord(loaded)) {
    throw new Error("/signup module did not expose a module object");
  }
  return loaded as PageModule;
}

function getSignupPage() {
  const pageModule = loadSignupPageModule();
  const page = pageModule.default;
  expect(typeof page).toBe("function");
  if (typeof page !== "function") {
    throw new Error("/signup default page export is missing");
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

function assertExplicitLabelAssociation(element: HTMLElement) {
  expect(element).toBeInstanceOf(HTMLInputElement);
  const input = element as HTMLInputElement;
  expect(input.id.trim()).not.toBe("");

  const label = Array.from(
    input.ownerDocument.querySelectorAll("label[for]"),
  ).find((candidate) => candidate.getAttribute("for") === input.id);
  expect(label).toBeDefined();
}

describe("/signup public page", () => {
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
    const Page = getSignupPage();
    const routeElement = Page({});

    expect(React.isValidElement(routeElement)).toBe(true);
    if (!React.isValidElement<{ fallback?: React.ReactNode }>(routeElement)) {
      throw new Error("/signup did not return a public React element");
    }
    expect(routeElement.type).toBe(React.Suspense);

    const fallback = routeElement.props.fallback;
    expect(React.isValidElement<{ role?: string }>(fallback)).toBe(true);
    if (!React.isValidElement<{ role?: string }>(fallback)) {
      throw new Error("/signup Suspense boundary has no public fallback element");
    }
    expect(fallback.props.role).toBe("status");
  });

  it("supports direct access with page metadata, one main/h1, fixed signup mode, and a normal login link", () => {
    const pageModule = loadSignupPageModule();
    const Page = getSignupPage();
    renderInHostMain(Page);

    expect(isRecord(pageModule.metadata)).toBe(true);
    if (!isRecord(pageModule.metadata)) {
      throw new Error("/signup metadata is not a public record");
    }
    expect(typeof pageModule.metadata.title).toBe("string");
    if (typeof pageModule.metadata.title !== "string") {
      throw new Error("/signup metadata.title is not a string");
    }
    expect(pageModule.metadata.title.trim()).not.toBe("");
    expect(pageModule.metadata.title).toMatch(/アカウント|Signup|サインアップ/i);
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: /アカウント|作成/i })).toBeInTheDocument();
    expect(screen.getByRole("form")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "パスキー名" })).toBeInTheDocument();
    const consentGroup = screen.getByRole("group", { name: /利用規約|プライバシー|同意/ });
    expect(consentGroup).toBeInstanceOf(HTMLFieldSetElement);
    const legend = consentGroup.querySelector("legend");
    expect(legend).not.toBeNull();
    expect(legend?.textContent?.trim()).toBeTruthy();
    assertExplicitLabelAssociation(screen.getByRole("textbox", { name: "パスキー名" }));
    assertExplicitLabelAssociation(screen.getByRole("checkbox", { name: /利用規約/ }));
    assertExplicitLabelAssociation(screen.getByRole("checkbox", { name: /プライバシー/ }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const loginLink = screen.getByRole("link", { name: /ログイン/ });
    expect(loginLink).toHaveAttribute("href", "/login");
  });

  it("calls createAccount once with the trimmed passkey name and retains inputs, consents, and Japanese failure after rejection", async () => {
    mockCreateAccount.mockRejectedValueOnce(new Error("cancelled"));
    const Page = getSignupPage();
    renderInHostMain(Page);

    const nameInput = screen.getByRole("textbox", { name: "パスキー名" });
    const terms = screen.getByRole("checkbox", { name: /利用規約/ });
    const privacy = screen.getByRole("checkbox", { name: /プライバシー/ });
    fireEvent.change(nameInput, { target: { value: " 共有端末 " } });
    fireEvent.click(terms);
    fireEvent.click(privacy);
    fireEvent.submit(screen.getByRole("form"));

    expect(mockCreateAccount).toHaveBeenCalledTimes(1);
    expect(mockCreateAccount).toHaveBeenCalledWith("共有端末");
    expect(await screen.findByRole("alert")).toHaveTextContent(/パスキー|作成|失敗/);
    expect(nameInput).toHaveValue(" 共有端末 ");
    expect(terms).toBeChecked();
    expect(privacy).toBeChecked();
  });

  it.each([
    ["/discussions/create?tab=recent", "/discussions/create?tab=recent"],
    ["//evil.example/path", "/"],
  ])("replaces only with the validated return target for %s", async (returnTo, expectedTarget) => {
    mockSearchParams = new URLSearchParams({ returnTo });
    const Page = getSignupPage();
    renderInHostMain(Page);

    fireEvent.submit(screen.getByRole("form"));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith(expectedTarget);
    const target = mockReplace.mock.calls[0][0] as string;
    expect(target).not.toMatch(/[?&](action|payload|draft)=/i);
  });

  it("does not replay a pending create action after authentication", async () => {
    mockSearchParams = new URLSearchParams(
      "returnTo=%2Fdiscussions%2Fcreate%3Faction%3Dcreate%26draft%3Dtitle",
    );
    const Page = getSignupPage();
    renderInHostMain(Page);

    fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));

    expect(mockReplace.mock.calls[0][0]).toBe("/");
    expect(mockReplace.mock.calls[0][0]).not.toContain("create");
    expect(mockReplace.mock.calls[0][0]).not.toContain("draft");
  });
});
