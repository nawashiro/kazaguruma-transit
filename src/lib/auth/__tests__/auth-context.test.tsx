import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../auth-context";

const publishSignedEventMock = jest.fn().mockResolvedValue(true);
const createPasskeyMock = jest.fn().mockResolvedValue("credential-id");
const isPrfSupportedMock = jest.fn().mockResolvedValue(true);
const setCacheOptionsMock = jest.fn();
const directPrfToNostrKeyMock = jest
  .fn()
  .mockResolvedValue({ pubkey: "pubkey", alg: "test", credentialId: "credential-id" });
const signEventWithPWKMock = jest.fn().mockResolvedValue({ id: "signed-event" });

jest.mock("nosskey-sdk", () => ({
  PWKManager: class {
    setCacheOptions = setCacheOptionsMock;
    isPrfSupported = isPrfSupportedMock;
    createPasskey = createPasskeyMock;
    directPrfToNostrKey = directPrfToNostrKeyMock;
    setCurrentPWK() {}
    getPublicKey = jest.fn().mockResolvedValue("pubkey");
    signEventWithPWK = signEventWithPWKMock;
    clearStoredPWK() {}
  },
}));

jest.mock("@/lib/config/discussion-config", () => ({
  getNostrServiceConfig: () => ({ relays: [], defaultTimeout: 500 }),
}));

jest.mock("@/lib/nostr/nostr-service", () => ({
  createNostrService: () => ({
    getProfile: jest.fn().mockResolvedValue([]),
    publishSignedEvent: publishSignedEventMock,
  }),
}));

function TestConsumer() {
  const { createAccount, login, signEvent, user } = useAuth();
  return (
    <>
      <output>{user.isLoggedIn ? "ログイン済み" : "未ログイン"}</output>
      <button onClick={() => void createAccount("端末用パスキー")}>作成</button>
      <button onClick={() => void login()}>ログイン</button>
      <button onClick={() => void signEvent({ kind: 1, content: "test" })}>
        署名
      </button>
    </>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    publishSignedEventMock.mockClear();
    createPasskeyMock.mockClear();
    isPrfSupportedMock.mockClear();
    setCacheOptionsMock.mockClear();
    directPrfToNostrKeyMock.mockClear();
    signEventWithPWKMock.mockReset();
    signEventWithPWKMock.mockResolvedValue({ id: "signed-event" });
  });

  it("does not publish a profile event", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "作成" })).toBeInTheDocument()
    );
    expect(publishSignedEventMock).not.toHaveBeenCalled();
  });

  it("logs in with one credential operation instead of authenticating to preflight PRF support", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await screen.findByText("ログイン済み");
    expect(isPrfSupportedMock).not.toHaveBeenCalled();
    expect(directPrfToNostrKeyMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the signing key cached for a normal interaction session", () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(setCacheOptionsMock).toHaveBeenCalledWith({
      enabled: true,
      timeoutMs: 30 * 60 * 1000,
    });
  });

  it("serializes concurrent signatures so an empty SDK cache is not unlocked twice", async () => {
    localStorage.setItem(
      "nosskey_pwk",
      JSON.stringify({
        pubkey: "pubkey",
        alg: "prf-direct",
        credentialId: "credential-id",
      })
    );
    let resolveFirstSignature: ((value: { id: string }) => void) | undefined;
    signEventWithPWKMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstSignature = resolve;
          })
      )
      .mockResolvedValueOnce({ id: "second-signed-event" });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    await screen.findByText("ログイン済み");

    fireEvent.click(screen.getByRole("button", { name: "署名" }));
    fireEvent.click(screen.getByRole("button", { name: "署名" }));

    await waitFor(() => expect(signEventWithPWKMock).toHaveBeenCalledTimes(1));
    resolveFirstSignature?.({ id: "first-signed-event" });
    await waitFor(() => expect(signEventWithPWKMock).toHaveBeenCalledTimes(2));
  });
});
