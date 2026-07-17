import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LoginModal } from "../LoginModal";

const createAccountMock = jest.fn().mockResolvedValue(undefined);
const loginMock = jest.fn().mockResolvedValue(undefined);

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    login: loginMock,
    createAccount: createAccountMock,
    error: null,
  }),
}));

describe("LoginModal", () => {
  beforeEach(() => {
    createAccountMock.mockClear();
    loginMock.mockReset();
    loginMock.mockResolvedValue(undefined);
  });

  it("asks for a passkey name instead of a user name", () => {
    render(<LoginModal isOpen onClose={jest.fn()} />);

    expect(screen.getByLabelText("パスキー名")).toBeInTheDocument();
    expect(screen.queryByLabelText("ユーザー名")).not.toBeInTheDocument();
  });

  it("passes the entered passkey name to account creation", async () => {
    render(<LoginModal isOpen onClose={jest.fn()} />);

    fireEvent.change(screen.getByLabelText("パスキー名"), {
      target: { value: "端末用パスキー" },
    });
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "アカウント作成" }));
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(createAccountMock).toHaveBeenCalledWith("端末用パスキー")
    );
  });

  it("keeps the modal open when login fails", async () => {
    const onClose = jest.fn();
    loginMock.mockRejectedValueOnce(new Error("認証がキャンセルされました"));
    render(<LoginModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole("tab", { name: "ログインを開く" }));

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "ログイン" }).closest("form")!);
    });

    expect(loginMock).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("prevents duplicate login submissions before React commits loading state", async () => {
    let resolveLogin: (() => void) | undefined;
    loginMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveLogin = resolve;
        })
    );
    render(<LoginModal isOpen onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "ログインを開く" }));
    const form = screen.getByRole("button", { name: "ログイン" }).closest("form")!;

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(loginMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveLogin?.();
      await Promise.resolve();
    });
  });
});
