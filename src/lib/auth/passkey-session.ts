import { seckeySigner } from "@rx-nostr/crypto";
import { bytesToHex } from "nosskey-sdk";
import type { PWKBlob } from "nosskey-sdk";
import type { NostrEventDTO } from "@/lib/nostr/discussion-ndk-gateway";

const PRF_EVALUATION_INPUT = new TextEncoder().encode("nostr-pwk");

interface PasskeySessionEvent {
  kind: number;
  content: string;
  tags?: string[][];
  created_at?: number;
  pubkey?: string;
}

/** A memory-only signing session derived from one passkey authentication. */
export interface PasskeySession {
  pwk: PWKBlob;
  signEvent: (event: PasskeySessionEvent) => Promise<NostrEventDTO>;
  clear: () => void;
}

interface PrfCredential extends Credential {
  rawId: ArrayBuffer;
  getClientExtensionResults: () => {
    prf?: { results?: { first?: ArrayBuffer } };
  };
}

/**
 * Authenticates once and retains the derived Nostr key only in memory.
 * The caller must invoke `clear()` when the session expires or logs out.
 */
export async function createPasskeySession(): Promise<PasskeySession> {
  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [],
      userVerification: "required",
      extensions: {
        prf: { eval: { first: PRF_EVALUATION_INPUT } },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PrfCredential | null;

  if (!credential) {
    throw new Error("Authentication failed");
  }

  const prfResult = credential.getClientExtensionResults().prf?.results?.first;
  if (!prfResult) {
    throw new Error("PRF secret not available");
  }

  const secretKey = new Uint8Array(prfResult);
  if (secretKey.every((byte) => byte === 0)) {
    secretKey.fill(0);
    throw new Error("Invalid PRF output: all zeros");
  }

  try {
    const credentialId = bytesToHex(new Uint8Array(credential.rawId));
    const publicKey = await seckeySigner(bytesToHex(secretKey)).getPublicKey();
    const pwk: PWKBlob = {
      v: 1,
      alg: "prf-direct",
      credentialId,
      pubkey: publicKey,
    };
    let isCleared = false;

    return {
      pwk,
      async signEvent(event) {
        if (isCleared) {
          throw new Error("Passkey session has expired");
        }
        const signedEvent = await seckeySigner(bytesToHex(secretKey)).signEvent(event);
        return signedEvent as unknown as NostrEventDTO;
      },
      clear() {
        if (isCleared) return;
        secretKey.fill(0);
        isCleared = true;
      },
    };
  } catch (error) {
    secretKey.fill(0);
    throw error;
  }
}
