"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { PWKManager } from "nosskey-sdk";
import type { PWKBlob } from "nosskey-sdk";
import type { UserAuth } from "@/types/discussion";
import { createNostrService } from "@/lib/nostr/nostr-service";
import { parseProfileEvent } from "@/lib/nostr/nostr-utils";
import { getNostrServiceConfig } from "@/lib/config/discussion-config";
import type { NostrEventDTO } from "@/lib/nostr/discussion-ndk-gateway";
import {
  createPasskeySession,
  type PasskeySession,
} from "@/lib/auth/passkey-session";
import { logger } from "@/utils/logger";

interface PWKEvent {
  kind: number;
  content: string;
  tags: string[][];
  created_at: number;
}

interface AuthContextType {
  user: UserAuth;
  login: () => Promise<void>;
  createAccount: (passkeyName?: string) => Promise<void>;
  logout: () => void;
  signEvent: (event: Record<string, unknown>) => Promise<NostrEventDTO>;
  refreshProfile: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
}

const PWK_STORAGE_KEY = "nosskey_pwk";
const SIGNING_KEY_CACHE_TIMEOUT_MS = 30 * 60 * 1000;

function formatLoginError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "ログインに失敗しました";
  }

  const normalizedMessage = `${error.name} ${error.message}`.toLowerCase();
  if (
    normalizedMessage.includes("notallowed") ||
    normalizedMessage.includes("not allowed") ||
    normalizedMessage.includes("abort") ||
    normalizedMessage.includes("cancel") ||
    normalizedMessage.includes("キャンセル")
  ) {
    return "パスキー認証がキャンセルされました。もう一度お試しください。";
  }
  if (normalizedMessage.includes("prf")) {
    return "この環境では必要なパスキー機能を利用できません。PRF対応ブラウザをご利用ください。";
  }

  return error.message || "ログインに失敗しました";
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserAuth>({
    pwk: null,
    pubkey: null,
    isLoggedIn: false,
    profile: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pwkManager] = useState(() => {
    const manager = new PWKManager();
    // 通常操作中の認証反復を抑えつつ、長時間の保持を避ける。
    manager.setCacheOptions({
      enabled: true,
      timeoutMs: SIGNING_KEY_CACHE_TIMEOUT_MS,
    });
    return manager;
  });
  const [nostrService] = useState(() =>
    createNostrService(getNostrServiceConfig())
  );
  const signingQueueRef = useRef<Promise<void>>(Promise.resolve());
  const passkeySessionRef = useRef<PasskeySession | null>(null);
  const passkeySessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const clearPasskeySession = () => {
    passkeySessionRef.current?.clear();
    passkeySessionRef.current = null;
    if (passkeySessionTimeoutRef.current) {
      clearTimeout(passkeySessionTimeoutRef.current);
      passkeySessionTimeoutRef.current = null;
    }
  };

  const storePasskeySession = (session: PasskeySession) => {
    clearPasskeySession();
    passkeySessionRef.current = session;
    passkeySessionTimeoutRef.current = setTimeout(() => {
      clearPasskeySession();
    }, SIGNING_KEY_CACHE_TIMEOUT_MS);
  };

  const loadProfile = useCallback(
    async (pubkey: string) => {
      try {
        const profileEvents = await nostrService.getProfile([pubkey]);
        const profileEvent = profileEvents[0];
        if (profileEvent) {
          const profile = parseProfileEvent(profileEvent);
          if (profile) {
            setUser((prev) => ({ ...prev, profile }));
          }
        }
      } catch (error) {
        logger.error("Failed to load profile:", error);
      }
    },
    [nostrService]
  );

  const loadStoredPWK = useCallback(async () => {
    try {
      const stored = localStorage.getItem(PWK_STORAGE_KEY);
      if (stored) {
        const pwk: PWKBlob = JSON.parse(stored);
        const pubkey = pwk.pubkey;

        setUser((prev) => ({
          ...prev,
          pwk,
          pubkey,
          isLoggedIn: true,
        }));

        await loadProfile(pubkey);
      }
    } catch (error) {
      logger.error("Failed to load stored PWK:", error);
      localStorage.removeItem(PWK_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, [loadProfile]);

  const login = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const passkeySession = await createPasskeySession();
      const pwk = passkeySession.pwk;
      if (!pwk) {
        throw new Error(
          "保存されたアカウント情報が見つかりません。新しくアカウントを作成してください。"
        );
      }

      const pubkey = pwk.pubkey;
      storePasskeySession(passkeySession);

      setUser({
        pwk,
        pubkey,
        isLoggedIn: true,
        profile: null,
      });

      await loadProfile(pubkey);
      localStorage.setItem(PWK_STORAGE_KEY, JSON.stringify(pwk));
    } catch (error) {
      clearPasskeySession();
      logger.error("Login failed:", error);
      const errorMessage = formatLoginError(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const createAccount = async (passkeyName?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      logger.log("🚀 Starting account creation with 2-step approach...");

      // Step 1: Create a passkey (displays browser's passkey UI)
      logger.log("📱 Step 1: Creating passkey...");
      const credentialId = await pwkManager.createPasskey({
        user: {
          name: passkeyName || `user_${Date.now()}`,
          displayName: passkeyName || "Nostr User",
        },
      });

      logger.log(
        "✅ Passkey created successfully, credentialId:",
        credentialId
      );

      // Step 2: Use PRF value directly as a Nostr key
      logger.log("🔑 Step 2: Using PRF value as Nostr key...");
      const pwk = await pwkManager.directPrfToNostrKey(credentialId, {
        username: passkeyName || "Anonymous User",
      });

      logger.log("✅ PWK created successfully:", {
        pubkey: pwk.pubkey,
        algorithm: pwk.alg,
        hasCredentialId: !!pwk.credentialId,
      });

      // Step 3: Set current PWK
      pwkManager.setCurrentPWK(pwk);

      // Step 4: Get public key for verification
      const publicKey = await pwkManager.getPublicKey();
      logger.log(`✅ Public key verified: ${publicKey}`);

      const pubkey = pwk.pubkey;
      clearPasskeySession();

      setUser({
        pwk,
        pubkey,
        isLoggedIn: true,
        profile: { pubkey },
      });

      localStorage.setItem(PWK_STORAGE_KEY, JSON.stringify(pwk));

      logger.log("🎉 Account creation completed successfully!");
    } catch (error) {
      logger.error("❌ Account creation failed:", error);
      logger.error("Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
      });

      // Provide more specific error messages
      let errorMessage = "アカウント作成に失敗しました";

      if (error instanceof Error) {
        const message = error.message.toLowerCase();

        if (message.includes("not supported") || message.includes("サポート")) {
          errorMessage = error.message;
        } else if (
          message.includes("user cancelled") ||
          message.includes("aborted") ||
          message.includes("キャンセル")
        ) {
          errorMessage =
            "パスキー作成がキャンセルされました。再度お試しください。";
        } else if (
          message.includes("not allowed") ||
          message.includes("credential") ||
          message.includes("許可")
        ) {
          errorMessage =
            "パスキーの作成が許可されませんでした。ブラウザの設定をご確認ください。";
        } else if (message.includes("timeout")) {
          errorMessage =
            "パスキー作成がタイムアウトしました。再度お試しください。";
        } else if (message.includes("network") || message.includes("fetch")) {
          errorMessage =
            "ネットワークエラーが発生しました。接続をご確認ください。";
        } else {
          errorMessage = error.message;
        }
      }

      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearPasskeySession();
    setUser({
      pwk: null,
      pubkey: null,
      isLoggedIn: false,
      profile: null,
    });

    pwkManager.clearStoredPWK();
    localStorage.removeItem(PWK_STORAGE_KEY);
    setError(null);
  };

  const signEvent = async (
    event: Record<string, unknown>
  ): Promise<NostrEventDTO> => {
    if (!user.pwk) {
      throw new Error("Not logged in");
    }

    const previousSignature = signingQueueRef.current;
    let releaseSignatureQueue: (() => void) | undefined;
    signingQueueRef.current = new Promise<void>((resolve) => {
      releaseSignatureQueue = resolve;
    });

    await previousSignature;
    try {
      const passkeySession = passkeySessionRef.current;
      const canReusePasskeySession =
        passkeySession?.pwk.credentialId === user.pwk.credentialId;
      const signedEvent = canReusePasskeySession
        ? await passkeySession.signEvent(event as unknown as PWKEvent)
        : ((await pwkManager.signEventWithPWK(
            event as unknown as PWKEvent,
            user.pwk
          )) as unknown as NostrEventDTO);
      return signedEvent;
    } catch (error) {
      logger.error("Failed to sign event:", error);
      throw error;
    } finally {
      releaseSignatureQueue?.();
    }
  };

  const refreshProfile = async () => {
    if (user.pubkey) {
      await loadProfile(user.pubkey);
    }
  };

  useEffect(() => {
    loadStoredPWK();
  }, [loadStoredPWK]);

  useEffect(
    () => () => {
      passkeySessionRef.current?.clear();
      if (passkeySessionTimeoutRef.current) {
        clearTimeout(passkeySessionTimeoutRef.current);
      }
    },
    []
  );

  const value: AuthContextType = {
    user,
    login,
    createAccount,
    logout,
    signEvent,
    refreshProfile,
    isLoading,
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function useRequireAuth(): UserAuth & { isLoggedIn: true } {
  const { user } = useAuth();

  if (!user.isLoggedIn) {
    throw new Error("Authentication required");
  }

  return user as UserAuth & { isLoggedIn: true };
}
