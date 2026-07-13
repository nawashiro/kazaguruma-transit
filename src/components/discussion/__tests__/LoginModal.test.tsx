import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LoginModal } from "../LoginModal";

const createAccountMock = jest.fn().mockResolvedValue(undefined);

jest.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    login: jest.fn(),
    createAccount: createAccountMock,
    error: null,
  }),
}));

describe("LoginModal", () => {
  beforeEach(() => {
    createAccountMock.mockClear();
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
});
