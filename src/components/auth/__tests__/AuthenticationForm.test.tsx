import React, { type ComponentType } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

type AuthenticationMode = "login" | "signup";
type AuthenticationFormProps = { mode: AuthenticationMode };
type AuthenticationFormComponent = ComponentType<AuthenticationFormProps>;

type AuthContextMock = {
  login: jest.Mock<Promise<void>, []>;
  createAccount: jest.Mock<Promise<void>, [string?]>;
  error: string | null;
};

const mockAuth: AuthContextMock = {
  login: jest.fn<Promise<void>, []>(),
  createAccount: jest.fn<Promise<void>, [string?]>(),
  error: null,
};

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => mockAuth,
}));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function loadAuthenticationForm(): AuthenticationFormComponent {
  let loaded: unknown;
  let loadError: unknown = null;

  try {
    // Guarded runtime loading keeps the planned public boundary collectible
    // before the production component exists; it is not a production stub.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded public-boundary loader
    loaded = require("../AuthenticationForm");
  } catch (error) {
    loadError = error;
  }

  expect(loadError).toBeNull();
  if (loadError !== null) {
    throw new Error(`AuthenticationForm public module could not be loaded: ${String(loadError)}`);
  }

  expect(isRecord(loaded)).toBe(true);
  if (!isRecord(loaded)) {
    throw new Error("AuthenticationForm module did not expose an object");
  }

  const component = loaded.AuthenticationForm;
  expect(typeof component).toBe("function");
  if (typeof component !== "function") {
    throw new Error("AuthenticationForm named export is missing");
  }

  return component as AuthenticationFormComponent;
}

function renderForm(mode: AuthenticationMode) {
  const AuthenticationForm = loadAuthenticationForm();
  const heading = mode === "login" ? "ログイン" : "アカウント作成";

  return render(
    <section aria-labelledby="auth-page-heading">
      <h1 id="auth-page-heading">{heading}</h1>
      <AuthenticationForm mode={mode} />
    </section>,
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

function assertSignupSemanticControls() {
  const consentGroup = screen.getByRole("group", { name: /利用規約|同意/ });
  expect(consentGroup).toBeInstanceOf(HTMLFieldSetElement);
  const legend = consentGroup.querySelector("legend");
  expect(legend).not.toBeNull();
  expect(legend?.textContent?.trim()).toBeTruthy();

  assertExplicitLabelAssociation(
    screen.getByRole("textbox", { name: "パスキー名" }),
  );
  assertExplicitLabelAssociation(
    screen.getByRole("checkbox", { name: /利用規約/ }),
  );
  assertExplicitLabelAssociation(
    screen.getByRole("checkbox", { name: /プライバシー/ }),
  );
}

describe("AuthenticationForm public boundary", () => {
  beforeEach(() => {
    mockAuth.login.mockReset();
    mockAuth.createAccount.mockReset();
    mockAuth.error = null;
    mockAuth.login.mockResolvedValue(undefined);
    mockAuth.createAccount.mockResolvedValue(undefined);
  });

  it.each([
    ["login", "ログイン"],
    ["signup", "アカウント作成"],
  ] as const)("renders a fixed %s mode as a native form", (mode, heading) => {
    const { container } = renderForm(mode);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
    expect(screen.getByRole("form")).toBeInstanceOf(HTMLFormElement);
    expect(container.querySelector("dialog")).toBeNull();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(container.querySelector(".modal-backdrop")).toBeNull();
    expect(container.querySelector("[aria-modal='true']")).toBeNull();
  });

  it("exposes explicit login controls and reports a rejected attempt locally", async () => {
    mockAuth.login.mockRejectedValueOnce(new Error("NotAllowedError"));
    renderForm("login");

    const form = screen.getByRole("form");
    expect(screen.getByRole("button", { name: "ログイン" })).toBeInTheDocument();

    fireEvent.submit(form);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/ログイン|認証|パスキー/);
    expect(alert).toHaveClass("alert-soft", "text-base-content!");
    expect(mockAuth.login).toHaveBeenCalledTimes(1);
  });

  it("prevents duplicate login submissions while the passkey attempt is pending", async () => {
    let resolveLogin!: () => void;
    mockAuth.login.mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveLogin = resolve;
      }),
    );
    renderForm("login");

    const form = screen.getByRole("form");
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(mockAuth.login).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /ログイン/ })).toBeDisabled();

    resolveLogin();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /ログイン/ })).not.toBeDisabled(),
    );
  });

  it("prevents duplicate signup submissions while account creation is pending", async () => {
    let resolveCreateAccount!: () => void;
    mockAuth.createAccount.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCreateAccount = resolve;
        }),
    );
    renderForm("signup");

    fireEvent.change(screen.getByRole("textbox", { name: "パスキー名" }), {
      target: { value: "共有端末" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /利用規約/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /プライバシー/ }));

    const form = screen.getByRole("form");
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(mockAuth.createAccount).toHaveBeenCalledTimes(1);
    const submitButton = screen.getByRole("button", { name: /アカウント作成|作成/ });
    expect(submitButton).toBeDisabled();

    resolveCreateAccount();
    await waitFor(() => expect(submitButton).not.toBeDisabled());
  });

  it.each([
    ["name", "パスキー名を入力してください。"],
    ["terms", "利用規約への同意が必要です。"],
    ["privacy", "プライバシーポリシーへの同意が必要です。"],
  ] as const)(
    "reports the field-specific Japanese validation error for an empty signup %s",
    async (control, expectedMessage) => {
      renderForm("signup");

      const invalidControl =
        control === "name"
          ? screen.getByRole("textbox", { name: "パスキー名" })
          : control === "terms"
            ? screen.getByRole("checkbox", { name: /利用規約/ })
            : screen.getByRole("checkbox", { name: /プライバシー/ });
      fireEvent.invalid(invalidControl);

      expect(await screen.findByRole("alert")).toHaveTextContent(expectedMessage);
    },
  );

  it("reports unsupported passkey availability in Japanese without clearing signup input state", async () => {
    mockAuth.createAccount.mockRejectedValueOnce(new Error("NotSupportedError"));
    renderForm("signup");

    const nameInput = screen.getByRole("textbox", { name: "パスキー名" });
    const terms = screen.getByRole("checkbox", { name: /利用規約/ });
    const privacy = screen.getByRole("checkbox", { name: /プライバシー/ });
    fireEvent.change(nameInput, { target: { value: "共有端末" } });
    fireEvent.click(terms);
    fireEvent.click(privacy);
    fireEvent.submit(screen.getByRole("form"));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/サポート|対応|利用できません/);
    expect(alert).toHaveClass("alert-soft", "text-base-content!");
    expect(nameInput).toHaveValue("共有端末");
    expect(terms).toBeChecked();
    expect(privacy).toBeChecked();
  });

  it("labels signup name and both consents, passes a trimmed name once, and retains them after failure", async () => {
    mockAuth.createAccount.mockRejectedValueOnce(new Error("cancelled"));
    renderForm("signup");

    const nameInput = screen.getByRole("textbox", { name: "パスキー名" });
    const terms = screen.getByRole("checkbox", { name: /利用規約/ });
    const privacy = screen.getByRole("checkbox", { name: /プライバシー/ });
    assertSignupSemanticControls();

    fireEvent.change(nameInput, { target: { value: " 端末用パスキー " } });
    fireEvent.click(terms);
    fireEvent.click(privacy);
    fireEvent.submit(screen.getByRole("form"));

    await screen.findByRole("alert");
    expect(mockAuth.createAccount).toHaveBeenCalledTimes(1);
    expect(mockAuth.createAccount).toHaveBeenCalledWith("端末用パスキー");
    expect(nameInput).toHaveValue(" 端末用パスキー ");
    expect(terms).toBeChecked();
    expect(privacy).toBeChecked();
  });
});
