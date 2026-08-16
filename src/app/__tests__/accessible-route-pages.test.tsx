import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import LoginPage, { metadata as loginMetadata } from "@/app/login/page";
import SignupPage, { metadata as signupMetadata } from "@/app/signup/page";
import RateLimitPage, { metadata as rateLimitMetadata } from "@/app/rate-limit/page";
import LocationDetailPage, {
  generateMetadata as locationDetailGenerateMetadata,
} from "@/app/location-detail/[id]/page";
import LocationDetailLoading from "@/app/location-detail/[id]/loading";
import type {
  KeyLocation,
  KeyLocationCategory,
  KeyLocationsDataResult,
} from "@/utils/addressLoader";

const mockUseAuth = jest.fn();
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockLoadKeyLocationsDataResult = jest.fn<
  Promise<KeyLocationsDataResult>,
  []
>();
let mockSearchParams = new URLSearchParams();

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
  }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock("@/utils/addressLoader", () => {
  const actual = jest.requireActual("@/utils/addressLoader");
  return {
    ...actual,
    loadKeyLocationsDataResult: () => mockLoadKeyLocationsDataResult(),
  };
});

const primaryLocation: KeyLocation = {
  id: "kanda-library-日本",
  name: "神田図書館",
  lat: 35.694,
  lng: 139.768,
  area: "神田",
  description: "地域の図書館です",
  imageUri: "https://example.test/kanda-library.jpg",
  uri: "https://example.test/kanda-library",
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

const locationCategories: KeyLocationCategory[] = [
  {
    category: "公共施設",
    "category:en": "public-facilities",
    locations: [primaryLocation],
  },
];

function titleText(metadata: unknown): string {
  if (typeof metadata !== "object" || metadata === null) return "";
  const title = (metadata as { title?: unknown }).title;
  if (typeof title === "string") return title;
  if (typeof title === "object" && title !== null) {
    const defaultTitle = (title as { default?: unknown }).default;
    if (typeof defaultTitle === "string") return defaultTitle;
  }
  return "";
}

function renderInHostMain(element: React.ReactElement) {
  return render(<main id="main-content">{element}</main>);
}

function assertSingleProductionMainAndHeading(container: HTMLElement) {
  const mains = container.querySelectorAll("main");
  const headings = container.querySelectorAll("h1");

  expect(mains).toHaveLength(1);
  expect(mains[0]).toHaveAttribute("id", "main-content");
  expect(headings).toHaveLength(1);
}

function assertNativeLinks(container: HTMLElement) {
  const links = Array.from(container.querySelectorAll("a[href]"));

  expect(links.length).toBeGreaterThan(0);
  links.forEach((link) => {
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")?.trim()).toBeTruthy();
  });
}

function assertExplicitLabelAssociation(input: HTMLElement) {
  expect(input.tagName).toBe("INPUT");
  expect(input.id.trim()).not.toBe("");

  const label = Array.from(
    input.ownerDocument.querySelectorAll("label[for]"),
  ).find((candidate) => candidate.getAttribute("for") === input.id);
  expect(label).toBeDefined();
}

async function renderLocationDetail(id: string) {
  const element = await LocationDetailPage({
    params: Promise.resolve({ id }),
  });

  if (!React.isValidElement(element)) {
    throw new Error("/location-detail/[id] did not render a public React element");
  }

  return renderInHostMain(element);
}

describe("専用ページの共通 semantic/a11y 契約", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockRouterPush.mockReset();
    mockRouterReplace.mockReset();
    mockSearchParams = new URLSearchParams();
    mockUseAuth.mockReturnValue({
      user: { isLoggedIn: false, pubkey: null },
      login: jest.fn().mockResolvedValue(undefined),
      createAccount: jest.fn().mockResolvedValue(undefined),
    });
    mockLoadKeyLocationsDataResult.mockReset();
    mockLoadKeyLocationsDataResult.mockResolvedValue({
      status: "success",
      categories: locationCategories,
    });
  });

  it("exports non-empty purpose-bearing metadata for every public page module", async () => {
    const locationDetailMetadata = await locationDetailGenerateMetadata({
      params: Promise.resolve({ id: primaryLocation.id }),
    });

    expect(titleText(loginMetadata)).toMatch(/ログイン/i);
    expect(titleText(signupMetadata)).toMatch(/アカウント|作成|signup/i);
    expect(titleText(locationDetailMetadata)).toMatch(/場所|詳細/i);
    expect(titleText(rateLimitMetadata)).toMatch(/リクエスト|制限/i);

    [
      loginMetadata,
      signupMetadata,
      locationDetailMetadata,
      rateLimitMetadata,
    ].forEach((metadata) => {
      expect(titleText(metadata).trim()).not.toBe("");
    });
  });

  it("renders Login as one host main/h1 with native form, button, and signup link", () => {
    const view = renderInHostMain(<LoginPage />);

    assertSingleProductionMainAndHeading(view.container);
    expect(screen.getByRole("heading", { level: 1, name: "ログイン" })).toBeInTheDocument();
    expect(screen.getByRole("form").tagName).toBe("FORM");
    expect(screen.getByRole("button", { name: "ログイン" }).tagName).toBe("BUTTON");
    const signupLink = screen.getByRole("link", { name: "アカウント作成" });
    expect(signupLink).not.toHaveClass("link-primary");
    expect(signupLink).not.toHaveClass("text-primary");
    assertNativeLinks(view.container);
  });

  it("renders Signup as one host main/h1 with native form, labels, fieldset, and legend", () => {
    const view = renderInHostMain(<SignupPage />);

    assertSingleProductionMainAndHeading(view.container);
    expect(
      screen.getByRole("heading", { level: 1, name: "アカウント作成" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("form").tagName).toBe("FORM");

    const passkeyName = screen.getByRole("textbox", { name: "パスキー名" });
    const terms = screen.getByRole("checkbox", { name: /利用規約/ });
    const privacy = screen.getByRole("checkbox", { name: /プライバシー/ });
    assertExplicitLabelAssociation(passkeyName);
    assertExplicitLabelAssociation(terms);
    assertExplicitLabelAssociation(privacy);

    const consentGroup = screen.getByRole("group", { name: /利用規約|同意/ });
    expect(consentGroup.tagName).toBe("FIELDSET");
    expect(consentGroup.querySelector("legend")?.textContent?.trim()).toBeTruthy();
    assertNativeLinks(view.container);
  });

  it("renders a valid location detail through the public Promise params boundary", async () => {
    const view = await renderLocationDetail(primaryLocation.id);

    assertSingleProductionMainAndHeading(view.container);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      primaryLocation.name,
    );
    const destinationLink = screen.getByRole("link", { name: "ここへ行く" });
    expect(destinationLink.tagName).toBe("A");
    expect(destinationLink.getAttribute("href")?.trim()).toBeTruthy();
    assertNativeLinks(view.container);
  });

  it("renders an invalid location detail as one main/h1 with a Japanese alert and return link", async () => {
    mockLoadKeyLocationsDataResult.mockResolvedValue({
      status: "success",
      categories: [],
    });

    const view = await renderLocationDetail("unknown-location");

    assertSingleProductionMainAndHeading(view.container);
    expect(screen.getByRole("alert")).toHaveTextContent(/見つかりません|場所/);
    expect(screen.getByRole("alert").tagName).toBe("DIV");
    assertNativeLinks(view.container);
  });

  it("renders the public loading state with one h1 and a Japanese status", () => {
    const view = renderInHostMain(<LocationDetailLoading />);

    assertSingleProductionMainAndHeading(view.container);
    expect(screen.getByRole("status")).toHaveTextContent(/読み込み中/);
    expect(screen.getByRole("status").tagName).toBe("P");
  });

  it("renders Rate Limit through the public Promise searchParams boundary with native return navigation", async () => {
    const element = await RateLimitPage({
      searchParams: Promise.resolve({ source: "locations" }),
    });
    const view = renderInHostMain(element);

    assertSingleProductionMainAndHeading(view.container);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "リクエスト制限に達しました",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "発生元の画面へ戻る" }).tagName).toBe("A");
    expect(screen.getByRole("link", { name: "発生元の画面へ戻る" })).toHaveAttribute(
      "href",
      "/locations",
    );
    assertNativeLinks(view.container);
  });
});
