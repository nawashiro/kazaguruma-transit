"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { useAuth } from "@/lib/auth/auth-context";
import {
  isDiscussionsEnabled,
  getNostrServiceConfig,
} from "@/lib/config/discussion-config";
import { LoginModal } from "@/components/discussion/LoginModal";
import { createNostrService } from "@/lib/nostr/nostr-service";
import {
  parseDiscussionEvent,
  isValidNpub,
  npubToHex,
} from "@/lib/nostr/nostr-utils";
import { extractDiscussionFromNaddr } from "@/lib/nostr/naddr-utils";
import Button from "@/components/ui/Button";
import type { Discussion } from "@/types/discussion";
import { logger } from "@/utils/logger";
import type { Event } from "nostr-tools";

// const ADMIN_PUBKEY = getAdminPubkeyHex(); // eslint-disable-line @typescript-eslint/no-unused-vars
const nostrServiceConfig = getNostrServiceConfig();
const nostrService = createNostrService(nostrServiceConfig);

interface EditFormData {
  title: string;
  description: string;
  moderators: string[];
}

export default function DiscussionEditPage() {
  const params = useParams();
  const router = useRouter();
  const naddrParam = params.naddr as string;
  const { user, signEvent } = useAuth();

  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [formData, setFormData] = useState<EditFormData>({
    title: "",
    description: "",
    moderators: [],
  });
  const [moderatorInput, setModeratorInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const discussionStreamCleanupRef = useRef<(() => void) | null>(null);

  const discussionInfo = useMemo(() => {
    if (!naddrParam) return null;
    return extractDiscussionFromNaddr(naddrParam);
  }, [naddrParam]);

  const isAuthor = useMemo(() => {
    return discussion && user.pubkey === discussion.authorPubkey;
  }, [discussion, user.pubkey]);

  const applyDiscussionEvents = useCallback(
    (events: Event[]) => {
      if (!discussionInfo) return;

      const parsedDiscussion = events
        .map(parseDiscussionEvent)
        .find((d) => d && d.dTag === discussionInfo.dTag);

      if (!parsedDiscussion) {
        return;
      }

      setDiscussion(parsedDiscussion);
      setFormData({
        title: parsedDiscussion.title,
        description: parsedDiscussion.description,
        moderators: parsedDiscussion.moderators.map((m) => m.pubkey), // npub形式に変換が必要
      });
    },
    [discussionInfo]
  );

  const startStreamingDiscussion = useCallback(() => {
    discussionStreamCleanupRef.current?.();

    if (!isDiscussionsEnabled() || !discussionInfo) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    discussionStreamCleanupRef.current = nostrService.streamEventsOnEvent(
      [
        {
          kinds: [34550],
          authors: [discussionInfo.authorPubkey],
          "#d": [discussionInfo.dTag],
          limit: 1,
        },
      ],
      {
        onEvent: (events) => {
          applyDiscussionEvents(events);
          setIsLoading(false);
        },
        onEose: (events) => {
          applyDiscussionEvents(events);
          setIsLoading(false);
        },
        timeoutMs: nostrServiceConfig.defaultTimeout,
      }
    );
  }, [
    discussionInfo,
    applyDiscussionEvents,
    nostrServiceConfig.defaultTimeout,
  ]);

  useEffect(() => {
    startStreamingDiscussion();

    return () => {
      discussionStreamCleanupRef.current?.();
      discussionStreamCleanupRef.current = null;
    };
  }, [startStreamingDiscussion]);

  const handleSave = async () => {
    if (!user.isLoggedIn) {
      setShowLoginModal(true);
      return;
    }

    // バリデーション
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
      .filter((line) => line.length > 0)
      .concat(formData.moderators);

    if (moderators.length > 0) {
      const invalidModerators = moderators.filter((mod) => !isValidNpub(mod));
      if (invalidModerators.length > 0) {
        errors.push("無効なモデレーターIDが含まれています");
      }
    }

    // ID is not editable as per NIP-72 specification

    if (errors.length > 0) {
      setErrors(errors);
      return;
    }

    setIsSaving(true);
    setErrors([]);
    setSuccessMessage("");

    try {
      if (!discussion) {
        throw new Error("Discussion not found");
      }

      const tags: string[][] = [
        ["d", discussion.dTag], // Use original dTag - not editable per NIP-72
        ["name", formData.title.trim()],
        ["description", formData.description.trim()],
      ];

      moderators.forEach((moderatorNpub) => {
        const hexPubkey = npubToHex(moderatorNpub);
        tags.push(["p", hexPubkey, "", "moderator"]);
      });

      const eventTemplate = {
        kind: 34550,
        content: formData.description.trim(),
        tags,
        pubkey: user.pubkey,
        created_at: Math.floor(Date.now() / 1000),
      };

      const signedEvent = await signEvent(eventTemplate);
      const published = await nostrService.publishSignedEvent(signedEvent);

      if (!published) {
        throw new Error("Failed to publish updated event to relays");
      }

      setSuccessMessage("会話が更新されました");

      // 数秒後に会話詳細画面に戻る
      setTimeout(() => {
        router.push(`/discussions/${naddrParam}`);
      }, 2000);
    } catch (error) {
      logger.error("Failed to update discussion:", error);
      setErrors(["会話の更新に失敗しました"]);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user.isLoggedIn) {
      setShowLoginModal(true);
      return;
    }

    setIsDeleting(true);
    setErrors([]);

    try {
      if (!discussion?.event?.id) {
        throw new Error("Discussion event ID not found");
      }

      const deleteEvent = {
        kind: 5,
        content: "",
        tags: [["e", discussion.event.id]],
        pubkey: user.pubkey,
        created_at: Math.floor(Date.now() / 1000),
      };

      const signedEvent = await signEvent(deleteEvent);
      const published = await nostrService.publishSignedEvent(signedEvent);

      if (!published) {
        throw new Error("Failed to publish delete event to relays");
      }

      router.push("/discussions");
    } catch (error) {
      logger.error("Failed to delete discussion:", error);
      setErrors(["会話の削除に失敗しました"]);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
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

  // 権限チェック
  if (!discussionInfo) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">無効な会話URL</h1>
          <p className="text-gray-600 mb-4">指定された会話URLが無効です。</p>
          <Link
            href="/discussions"
            className="btn btn-primary rounded-full dark:rounded-sm"
          >
            会話一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  if (!isDiscussionsEnabled()) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">会話編集</h1>
          <p className="text-gray-600">この機能は現在利用できません。</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!discussion) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">会話が見つかりません</h1>
          <Link
            href="/discussions"
            className="btn btn-primary rounded-full dark:rounded-sm"
          >
            会話一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  if (!isAuthor) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">アクセス拒否</h1>
          <p className="text-gray-600 mb-4">
            この会話を編集する権限がありません。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-6 ruby-text">会話を編集</h1>
        </div>

        <main role="main">
          {successMessage ? (
            <div className="card bg-base-100 shadow-lg border border-green-200 dark:border-green-700">
              <div className="card-body text-center">
                <div className="mb-4">
                  <CheckCircleIcon className="w-16 h-16 text-green-600 dark:text-green-400 mx-auto" />
                </div>
                <h2 className="text-xl font-semibold mb-4 text-green-600 dark:text-green-400">
                  {successMessage}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  まもなく会話画面に戻ります...
                </p>
              </div>
            </div>
          ) : (
            <div className="card bg-base-100 shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="card-body">
                <h2 className="text-xl font-semibold mb-6 ruby-text">
                  会話情報を編集
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
                      required
                      disabled={isSaving || isDeleting}
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
                      required
                      disabled={isSaving || isDeleting}
                      maxLength={500}
                      autoComplete="off"
                    />
                    <div className="text-gray-500 mt-1">
                      {formData.description.length}/500文字
                    </div>
                  </div>

                  {/* Read-only ID display - not editable per NIP-72 */}
                  <div>
                    <label className="label ruby-text">
                      <span className="label-text">会話ID</span>
                    </label>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <span className="text-sm font-mono">
                        {discussion?.dTag || "loading..."}
                      </span>
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
                              disabled={isSaving || isDeleting}
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
                        disabled={isSaving || isDeleting}
                        autoComplete="off"
                      />
                      <Button
                        onClick={addModerator}
                        secondary
                        disabled={
                          !moderatorInput.trim() || isSaving || isDeleting
                        }
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

                  <div className="flex gap-4">
                    <button
                      className="btn btn-primary rounded-full dark:rounded-sm ruby-text"
                      onClick={handleSave}
                      disabled={
                        isSaving ||
                        isDeleting ||
                        !formData.title.trim() ||
                        !formData.description.trim()
                      }
                    >
                      {isSaving ? (
                        <span>保存中...</span>
                      ) : (
                        <span>変更を保存</span>
                      )}
                    </button>

                    <button
                      className="btn btn-outline btn-error rounded-full dark:rounded-sm ruby-text"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={isSaving || isDeleting}
                    >
                      {isDeleting ? (
                        <span>削除中...</span>
                      ) : (
                        <span>会話を削除</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 削除確認ダイアログ */}
      {showDeleteConfirm && (
        <dialog open className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg ruby-text">会話の削除</h3>
            <p className="py-4 ruby-text">
              この会話を削除しますか？この操作は取り消せません。
            </p>
            <div className="modal-action">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn btn-outline rounded-full dark:rounded-sm"
                disabled={isDeleting}
              >
                <span>キャンセル</span>
              </button>
              <button
                onClick={handleDelete}
                className="btn btn-error rounded-full dark:rounded-sm"
                disabled={isDeleting}
              >
                <span>削除する</span>
              </button>
            </div>
          </div>
        </dialog>
      )}

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}
