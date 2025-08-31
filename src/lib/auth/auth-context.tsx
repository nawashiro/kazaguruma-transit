"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { PWKManager } from "nosskey-sdk";
import type { PWKBlob } from "nosskey-sdk";
import type { UserAuth } from "@/types/discussion";
import { createNostrService } from "@/lib/nostr/nostr-service";
import { parseProfileEvent } from "@/lib/nostr/nostr-utils";
import { getNostrServiceConfig } from "@/lib/config/discussion-config";
import type { Event } from "nostr-tools";
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
  createAccount: (username?: string) => Promise<void>;
  logout: () => void;
  signEvent: (event: Record<string, unknown>) => Promise<Event>;
  refreshProfile: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
}

const PWK_STORAGE_KEY = "nosskey_pwk";

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
    // 秘密鍵を300秒間キャッシュする設定
    manager.setCacheOptions({
      enabled: true,
      timeoutMs: 300000, // 300秒 = 5分
    });
    return manager;
  });
  const [nostrService] = useState(() =>
    createNostrService(getNostrServiceConfig())
  );

  const loadProfile = useCallback(
    async (pubkey: string) => {
      try {
        const profileEvent = await nostrService.getProfile([pubkey]);
        if (profileEvent) {
          const profile = parseProfileEvent(profileEvent);
          setUser((prev) => ({ ...prev, profile }));
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
      const isPrfSupported = await pwkManager.isPrfSupported();
      if (!isPrfSupported) {
        throw new Error(
          "PRF拡張がサポートされていません。WebAuthnに対応したブラウザをご利用ください。"
        );
      }

      // 保存されたクレデンシャルIDを取得
      const pwk = await pwkManager.directPrfToNostrKey();
      if (!pwk) {
        throw new Error(
          "保存されたアカウント情報が見つかりません。新しくアカウントを作成してください。"
        );
      }

      const pubkey = pwk.pubkey;

      setUser({
        pwk,
        pubkey,
        isLoggedIn: true,
        profile: null,
      });

      await loadProfile(pubkey);
      localStorage.setItem(PWK_STORAGE_KEY, JSON.stringify(pwk));
    } catch (error) {
      logger.error("Login failed:", error);
      setError(
        error instanceof Error ? error.message : "ログインに失敗しました"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const createAccount = async (username?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      logger.log("🚀 Starting account creation with 2-step approach...");

      // Step 1: Create a passkey (displays browser's passkey UI)
      logger.log("📱 Step 1: Creating passkey...");
      const credentialId = await pwkManager.createPasskey({
        user: {
          name: username || `user_${Date.now()}`,
          displayName: username || "Nostr User",
        },
      });

      logger.log(
        "✅ Passkey created successfully, credentialId:",
        credentialId
      );

      // Step 2: Use PRF value directly as a Nostr key
      logger.log("🔑 Step 2: Using PRF value as Nostr key...");
      const pwk = await pwkManager.directPrfToNostrKey(credentialId, {
        username: username || "Anonymous User",
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

      // Step 5: Publish profile
      logger.log("📤 Publishing profile...");
      await publishProfile(username || "Anonymous User", pwk);
      logger.log("✅ Profile published successfully");

      setUser({
        pwk,
        pubkey,
        isLoggedIn: true,
        profile: { pubkey, name: username },
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
    } finally {
      setIsLoading(false);
    }
  };

  const publishProfile = async (name: string, pwk: PWKBlob) => {
    try {
      const profileEvent = {
        kind: 0,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ name }),
      };

      const signedEvent = (await pwkManager.signEventWithPWK(
        profileEvent,
        pwk
      )) as unknown as Event;
      await nostrService.publishSignedEvent(signedEvent);
    } catch (error) {
      logger.error("Failed to publish profile:", error);
    }
  };

  const logout = () => {
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

  const signEvent = async (event: Record<string, unknown>): Promise<Event> => {
    if (!user.pwk) {
      throw new Error("Not logged in");
    }

    try {
      const signedEvent = (await pwkManager.signEventWithPWK(
        event as unknown as PWKEvent,
        user.pwk
      )) as unknown as Event;
      return signedEvent;
    } catch (error) {
      logger.error("Failed to sign event:", error);
      throw error;
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
