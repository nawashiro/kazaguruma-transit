import { seckeySigner } from "@rx-nostr/crypto";
import { createPasskeySession } from "../passkey-session";

const getPublicKeyMock = jest.fn().mockResolvedValue("pubkey");
const signEventMock = jest.fn().mockResolvedValue({ id: "signed-event" });

jest.mock("@rx-nostr/crypto", () => ({
  seckeySigner: jest.fn(() => ({
    getPublicKey: getPublicKeyMock,
    signEvent: signEventMock,
  })),
}));

describe("createPasskeySession", () => {
  const credentialGetMock = jest.fn();

  beforeEach(() => {
    credentialGetMock.mockReset();
    getPublicKeyMock.mockClear();
    signEventMock.mockClear();
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: { get: credentialGetMock },
    });
  });

  it("reuses the login authentication result for subsequent signatures", async () => {
    const rawId = new Uint8Array([1, 2, 3]);
    const prfSecret = new Uint8Array(32).fill(7);
    credentialGetMock.mockResolvedValue({
      rawId: rawId.buffer,
      getClientExtensionResults: () => ({
        prf: { results: { first: prfSecret.buffer } },
      }),
    });

    const session = await createPasskeySession();
    await session.signEvent({ kind: 1, content: "first", tags: [], created_at: 1 });
    await session.signEvent({ kind: 1, content: "second", tags: [], created_at: 2 });

    expect(credentialGetMock).toHaveBeenCalledTimes(1);
    expect(session.pwk).toMatchObject({
      v: 1,
      alg: "prf-direct",
      credentialId: "010203",
      pubkey: "pubkey",
    });
    expect(seckeySigner).toHaveBeenCalledTimes(3);
    expect(signEventMock).toHaveBeenCalledTimes(2);
    session.clear();
  });

  it("destroys its in-memory key when cleared", async () => {
    const prfSecret = new Uint8Array(32).fill(9);
    credentialGetMock.mockResolvedValue({
      rawId: new Uint8Array([4, 5, 6]).buffer,
      getClientExtensionResults: () => ({
        prf: { results: { first: prfSecret.buffer } },
      }),
    });
    const session = await createPasskeySession();

    session.clear();

    await expect(
      session.signEvent({ kind: 1, content: "after clear", tags: [], created_at: 1 })
    ).rejects.toThrow("Passkey session has expired");
  });

  it("destroys the derived key when session creation fails", async () => {
    const prfSecret = new Uint8Array(32).fill(11);
    credentialGetMock.mockResolvedValue({
      rawId: new Uint8Array([7, 8, 9]).buffer,
      getClientExtensionResults: () => ({
        prf: { results: { first: prfSecret.buffer } },
      }),
    });
    getPublicKeyMock.mockRejectedValueOnce(new Error("invalid key"));

    await expect(createPasskeySession()).rejects.toThrow("invalid key");
    expect([...prfSecret]).toEqual(new Array(32).fill(0));
  });
});
