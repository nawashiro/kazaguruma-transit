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
    dTag: "",
  });
  const [moderatorInput, setModeratorInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [createdNaddr, setCreatedNaddr] = useState<string>("");

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
      errors.push('タイトルは必須です');
    } else if (formData.title.length > 100) {
      errors.push('タイトルは100文字以内で入力してください');
    }

    if (!formData.description.trim()) {
      errors.push('説明は必須です');
    } else if (formData.description.length > 500) {
      errors.push('説明は500文字以内で入力してください');
    }

    const moderators = moderatorInput
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (moderators.length > 0) {
      const { isValidNpub } = await import('@/lib/nostr/nostr-utils');
      const invalidModerators = moderators.filter(mod => !isValidNpub(mod));
      if (invalidModerators.length > 0) {
        errors.push('無効なモデレーターIDが含まれています');
      }
    }

    if (formData.dTag && formData.dTag.trim()) {
      const dTagTrimmed = formData.dTag.trim();
      if (dTagTrimmed.length < 3 || dTagTrimmed.length > 50) {
        errors.push('IDは3文字以上50文字以内で入力してください');
      } else if (!/^[a-z0-9-]+$/.test(dTagTrimmed)) {
        errors.push('IDは小文字英数字、ハイフンのみ使用できます');
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
      };

      const result = await processDiscussionCreationFlow({
        formData: formDataWithModerators,
        userPubkey: user.pubkey || "",
        adminPubkey: ADMIN_PUBKEY,
        signEvent,
        publishEvent: (event) => nostrService.publishSignedEvent(event),
      });

      if (result.success && result.discussionNaddr) {
        setCreatedNaddr(result.discussionNaddr);
        setSuccessMessage(result.successMessage || "");
        
        // フォームをクリア
        setFormData({ title: "", description: "", moderators: [], dTag: "" });
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
      setFormData(prev => ({
        ...prev,
        moderators: [...prev.moderators, trimmedInput],
      }));
      setModeratorInput("");
    }
  };

  const removeModerator = (npub: string) => {
    setFormData(prev => ({
      ...prev,
      moderators: prev.moderators.filter(m => m !== npub),
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
                {successMessage.split('\n').map((line, idx) => (
                  <p key={idx} className="mb-2">
                    {line || '\u00A0'}
                  </p>
                ))}
              </div>
              
              <div className="flex gap-4 mt-6">
                <Button
                  onClick={handleGoToDiscussion}
                  variant="primary"
                  fullWidth
                >
                  会話を開始する
                </Button>
                <Button
                  onClick={() => router.push('/discussions')}
                  variant="outline"
                  fullWidth
                >
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
            className="btn btn-ghost btn-sm rounded-full dark:rounded-sm mb-4"
          >
            <span>← 会話一覧に戻る</span>
          </Link>
          
          <h1 className="text-3xl font-bold mb-6 ruby-text">会話を作成</h1>

          {/* 3ステップ説明 */}
          <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
            <div className="card-body">
              <h2 className="text-xl font-semibold mb-4 ruby-text">作成の流れ</h2>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="badge badge-primary badge-lg font-bold">1</div>
                  <div className="ruby-text">
                    <h3 className="font-semibold mb-1">すぐに開始</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      作成すればURLが作られて、すぐに会話を始めることができます。
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="badge badge-primary badge-lg font-bold">2</div>
                  <div className="ruby-text">
                    <h3 className="font-semibold mb-1">掲載承認</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      会話一覧への掲載は、少々お待ちください。担当者が確認します。
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="badge badge-primary badge-lg font-bold">3</div>
                  <div className="ruby-text">
                    <h3 className="font-semibold mb-1">投稿承認</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      悪意のある書き込みを防ぐために、投稿を手作業で承認する必要があります。一日の終わりなどにまとめてやるのがおすすめです。仲間と一緒に作業することもできます。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <main role="main">
          <div className="card bg-base-100 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="card-body">
              <h2 className="text-xl font-semibold mb-6 ruby-text">会話情報を入力</h2>
              
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
                  <div className="text-xs text-gray-500 mt-1">
                    {formData.title.length}/100文字
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    短くて覚えやすいタイトルがおすすめです。
                  </div>
                </div>

                <div>
                  <label htmlFor="dTag" className="label ruby-text">
                    <span className="label-text">会話ID（任意）</span>
                  </label>
                  <input
                    id="dTag"
                    type="text"
                    value={formData.dTag}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dTag: e.target.value,
                      }))
                    }
                    className="input input-bordered w-full"
                    placeholder="例: transit-discussion-2024"
                    disabled={isSubmitting}
                    maxLength={50}
                    autoComplete="off"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {formData.dTag?.length || 0}/50文字
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    小文字英数字、ハイフン、アンダースコアのみ使用可能。空欄の場合は自動生成されます。
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
                  <div className="text-xs text-gray-500 mt-1">
                    {formData.description.length}/500文字
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    参加者が理解しやすい説明を心がけてください。
                  </div>
                </div>

                <div>
                  <label htmlFor="moderators" className="label ruby-text">
                    <span className="label-text">モデレーター（任意）</span>
                  </label>
                  
                  {formData.moderators.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {formData.moderators.map((npub) => (
                        <div
                          key={npub}
                          className="badge badge-outline gap-1"
                        >
                          <span className="text-xs font-mono">
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
                      variant="outline"
                      disabled={!moderatorInput.trim() || isSubmitting}
                    >
                      追加
                    </Button>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    投稿の承認を手伝ってくれる人のNostr公開鍵（npub）を入力してください。
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
                  variant="primary"
                  fullWidth
                  disabled={isSubmitting || !formData.title.trim() || !formData.description.trim()}
                  loading={isSubmitting}
                >
                  {isSubmitting ? "作成中..." : "会話を作成する"}
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