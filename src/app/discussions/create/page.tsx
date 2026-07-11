"use client";

export const dynamic = "force-dynamic";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import {
  isDiscussionsEnabled,
  getNostrServiceConfig,
} from "@/lib/config/discussion-config";
import { LoginModal } from "@/components/discussion/LoginModal";
import { createNostrService } from "@/lib/nostr/nostr-service";
import { getAdminPubkeyHex } from "@/lib/nostr/nostr-utils";
import {
  processDiscussionCreationFlow,
  type DiscussionCreationForm,
} from "@/lib/discussion/user-creation-flow";
import Button from "@/components/ui/Button";
import { logger } from "@/utils/logger";

const ADMIN_PUBKEY = getAdminPubkeyHex();
const nostrService = createNostrService(getNostrServiceConfig());

export default function DiscussionCreatePage() {
  const router = useRouter();
  const { user, signEvent } = useAuth();

  const [formData, setFormData] = useState<DiscussionCreationForm>({
    title: "",
    description: "",
    moderators: [],
  });
  const [moderatorInput, setModeratorInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [createdNaddr, setCreatedNaddr] = useState<string>("");

  const createInternalDiscussionId = (): string =>
    `discussion-${crypto.randomUUID().toLowerCase()}`;

  if (!isDiscussionsEnabled()) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">会話作成</h1>
          <p className="text-gray-600">この機能は現在利用できません。</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!user.isLoggedIn) {
      setShowLoginModal(true);
      return;
    }

    // クライアントサイドバリデーション
    const errors: string[] = [];

    if (!formData.title.trim()) {
      errors.push("タイトルは必須です");
    } else if (formData.title.length > 100) {
      errors.push("タイトルは100文字以内で入力してください");
    }

    if (!formData.description.trim()) {
      errors.push("説明は必須です");
    } else if (formData.description.length > 500) {
      errors.push("説明は500文字以内で入力してください");
    }

    const moderators = moderatorInput
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (moderators.length > 0) {
      const { isValidNpub } = await import("@/lib/nostr/nostr-utils");
      const invalidModerators = moderators.filter((mod) => !isValidNpub(mod));
      if (invalidModerators.length > 0) {
        errors.push("無効なモデレーターIDが含まれています");
      }
    }

    if (errors.length > 0) {
      setErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setErrors([]);
    setSuccessMessage("");

    try {
      const formDataWithModerators = {
        ...formData,
        moderators,
        dTag: createInternalDiscussionId(),
      };

      const result = await processDiscussionCreationFlow({
        formData: formDataWithModerators,
        userPubkey: user.pubkey || "",
        adminPubkey: ADMIN_PUBKEY,
        signEvent,
        publishEvent: (event) => nostrService.publishSignedEvent(event),
        publishListingRequest: false,
      });

      if (result.success && result.discussionNaddr) {
        setCreatedNaddr(result.discussionNaddr);
        setSuccessMessage(result.successMessage || "");

        // フォームをクリア
        setFormData({ title: "", description: "", moderators: [] });
        setModeratorInput("");
      } else {
        setErrors(result.errors);
      }
    } catch (error) {
      logger.error("Failed to create discussion:", error);
      setErrors(["会話作成中に予期しないエラーが発生しました"]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoToDiscussion = () => {
    if (createdNaddr) {
      router.push(`/discussions/${createdNaddr}`);
    }
  };

  const addModerator = () => {
    const trimmedInput = moderatorInput.trim();
    if (trimmedInput && !formData.moderators.includes(trimmedInput)) {
      setFormData((prev) => ({
        ...prev,
        moderators: [...prev.moderators, trimmedInput],
      }));
      setModeratorInput("");
    }
  };

  const removeModerator = (npub: string) => {
    setFormData((prev) => ({
      ...prev,
      moderators: prev.moderators.filter((m) => m !== npub),
    }));
  };

  // 成功画面
  if (successMessage && createdNaddr) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-3xl font-bold mb-4 ruby-text">会話作成完了</h1>
          </div>

          <div className="card bg-base-100 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="card-body">
              <div className="prose prose-sm dark:prose-invert max-w-none ruby-text">
                {successMessage.split("\n").map((line, idx) => (
                  <p key={idx} className="mb-2">
                    {line || "\u00A0"}
                  </p>
                ))}
              </div>

              <div className="flex gap-4 mt-6">
                <Button onClick={handleGoToDiscussion}>会話を開始する</Button>
                <Button onClick={() => router.push("/discussions")} secondary>
                  会話一覧に戻る
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link
            href="/discussions"
            className="btn btn-ghost rounded-full dark:rounded-sm mb-4"
          >
            <span>← 会話一覧に戻る</span>
          </Link>

          <h1 className="text-3xl font-bold mb-6 ruby-text">会話を作成</h1>

          {/* 3ステップ説明 */}
          <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
            <div className="card-body">
              <h2 className="text-xl font-semibold mb-4 ruby-text">
                作成の流れ
              </h2>
              <div className="space-y-4 ruby-text">
                <div className="flex gap-4 items-center">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-6 h-6 text-primary"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    作成すればURLが作られて、すぐに会話を始めることができます。
                  </p>
                </div>
                <div className="flex gap-4 items-center">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-6 h-6 text-primary"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    会話一覧への掲載は、少々お待ちください。担当者が確認します。
                  </p>
                </div>
                <div className="flex gap-4 items-center">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-6 h-6 text-primary"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    悪意のある書き込みを防ぐために、投稿を手作業で承認する必要があります。一日の終わりなどにまとめてやるのがおすすめです。仲間と一緒に作業することもできます。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <main role="main">
          <div className="card bg-base-100 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="card-body">
              <h2 className="text-xl font-semibold mb-6 ruby-text">
                会話情報を入力
              </h2>

              <div className="space-y-6">
                <div>
                  <label htmlFor="title" className="label ruby-text">
                    <span className="label-text">タイトル *</span>
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    className="input input-bordered w-full"
                    placeholder="会話のタイトルを入力してください"
                    required
                    disabled={isSubmitting}
                    maxLength={100}
                    autoComplete="off"
                  />
                  <div className="text-gray-500 mt-1">
                    {formData.title.length}/100文字
                  </div>
                </div>

                <div>
                  <label htmlFor="description" className="label ruby-text">
                    <span className="label-text">説明 *</span>
                  </label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className="textarea textarea-bordered w-full h-32"
                    placeholder="どのような会話にしたいか説明してください"
                    required
                    disabled={isSubmitting}
                    maxLength={500}
                    autoComplete="off"
                  />
                  <div className="text-gray-500 mt-1">
                    {formData.description.length}/500文字
                  </div>
                </div>

                <div>
                  <label htmlFor="moderators" className="label ruby-text">
                    <span className="label-text">モデレーター（任意）</span>
                  </label>

                  {formData.moderators.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {formData.moderators.map((npub) => (
                        <div key={npub} className="badge badge-outline gap-1">
                          <span className="font-mono">
                            {npub.substring(0, 10)}...
                          </span>
                          <button
                            type="button"
                            onClick={() => removeModerator(npub)}
                            className="btn btn-ghost btn-xs p-0 min-h-0 h-4 w-4"
                            disabled={isSubmitting}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-gray-600 dark:text-gray-400 mt-1 mb-2 ruby-text">
                    投稿の承認を手伝ってくれる人のユーザーIDを入力してください。
                  </div>

                  <div className="flex gap-2">
                    <input
                      id="moderators"
                      type="text"
                      value={moderatorInput}
                      onChange={(e) => setModeratorInput(e.target.value)}
                      className="input input-bordered flex-1"
                      placeholder="npub1..."
                      disabled={isSubmitting}
                      autoComplete="off"
                    />
                    <Button
                      onClick={addModerator}
                      disabled={!moderatorInput.trim() || isSubmitting}
                    >
                      追加
                    </Button>
                  </div>
                </div>

                {errors.length > 0 && (
                  <div className="alert alert-error">
                    <ul className="text-sm">
                      {errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button
                  onClick={handleSubmit}
                  className="w-full"
                  disabled={
                    isSubmitting ||
                    !formData.title.trim() ||
                    !formData.description.trim()
                  }
                  loading={isSubmitting}
                >
                  {isSubmitting ? (
                    <span>作成中...</span>
                  ) : (
                    <span>会話を作成する</span>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}
