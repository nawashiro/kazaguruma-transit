import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../auth-context";

const publishSignedEventMock = jest.fn().mockResolvedValue(true);
const createPasskeyMock = jest.fn().mockResolvedValue("credential-id");
const directPrfToNostrKeyMock = jest
  .fn()
  .mockResolvedValue({ pubkey: "pubkey", alg: "test", credentialId: "credential-id" });

jest.mock("nosskey-sdk", () => ({
  PWKManager: class {
    setCacheOptions() {}
    isPrfSupported = jest.fn().mockResolvedValue(true);
    createPasskey = createPasskeyMock;
    directPrfToNostrKey = directPrfToNostrKeyMock;
    setCurrentPWK() {}
    getPublicKey = jest.fn().mockResolvedValue("pubkey");
    signEventWithPWK = jest.fn();
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
  const { createAccount } = useAuth();
  return <button onClick={() => void createAccount("端末用パスキー")}>作成</button>;
}

describe("AuthProvider account creation", () => {
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
});
