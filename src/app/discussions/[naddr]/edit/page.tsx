"use client";

export const dynamic = "force-dynamic";

import React, {
  useState,
  useEffect,
  useMemo,
} from "react";
import Link from "next/link";
import PageHeader from "@/components/layouts/PageHeader";
import { useParams, useRouter } from "next/navigation";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/lib/auth/auth-context";
import { useDiscussionDetail } from "@/components/discussion/DiscussionDetailProvider";
import {
  isDiscussionsEnabled,
  getNostrServiceConfig,
} from "@/lib/config/discussion-config";

import {
  buildDisabledActionState,
  PermissionNotice,
} from "@/components/discussion/PermissionGuards";
import { createNostrService } from "@/lib/nostr/nostr-service";
import {
  isValidNpub,
  npubToHex,
  getAdminPubkeyHex,
} from "@/lib/nostr/nostr-utils";
import {
  extractDiscussionFromNaddr,
  buildNaddrFromDiscussion,
} from "@/lib/nostr/naddr-utils";
import {
  createDiscussionListingRequest,
} from "@/lib/discussion/user-creation-flow";
import { UserIdentity } from "@/components/ui/UserIdentity";
import Button from "@/components/ui/Button";
import type { Discussion } from "@/types/discussion";
import { logger } from "@/utils/logger";
import { buildLoginRoute } from "@/lib/navigation/auth-route";

// const ADMIN_PUBKEY = getAdminPubkeyHex(); // eslint-disable-line @typescript-eslint/no-unused-vars
const nostrServiceConfig = getNostrServiceConfig();
const nostrService = createNostrService(nostrServiceConfig);
const ADMIN_PUBKEY = getAdminPubkeyHex();

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
  const detail = useDiscussionDetail();
  const layoutDiscussion = detail.snapshot?.discussion ?? null;
  const isDiscussionLoading = detail.state === "loading";
  const discussionCompletionReason =
    detail.completionReason ??
    (detail.state === "partial"
      ? "idle-timeout"
      : detail.state === "error"
        ? "hard-timeout"
        : detail.state === "ready"
          ? "eose"
          : null);
  const reload = detail.reload;

  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [formData, setFormData] = useState<EditFormData>({
    title: "",
    description: "",
    moderators: [],
  });
  const [moderatorInput, setModeratorInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRequestingListing, setIsRequestingListing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [successType, setSuccessType] = useState<
    "save" | "listing" | null
  >(null);

  const discussionInfo = useMemo(() => {
    if (!naddrParam) return null;
    return extractDiscussionFromNaddr(naddrParam);
  }, [naddrParam]);

  const isAuthor = useMemo(() => {
    return discussion && user.pubkey === discussion.authorPubkey;
  }, [discussion, user.pubkey]);

  useEffect(() => {
    if (layoutDiscussion) {
      setDiscussion((prev) => {
        if (prev?.id === layoutDiscussion.id) return prev;
        return layoutDiscussion;
      });
      setFormData({
        title: layoutDiscussion.title,
        description: layoutDiscussion.description,
        moderators: layoutDiscussion.moderators.map((m) => m.pubkey),
      });
    } else if (!isDiscussionLoading) {
      setDiscussion(null);
    }
  }, [isDiscussionLoading, layoutDiscussion]);

  const handleSave = async () => {
    if (!user.isLoggedIn) {
      router.push(buildLoginRoute(`/discussions/${naddrParam}/edit`));
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
    setSuccessType(null);

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

      const signedEvent = await signEvent(
        eventTemplate as unknown as Record<string, unknown>,
      );
      const published = await nostrService.publishSignedEvent(signedEvent);

      if (!published) {
        throw new Error("Failed to publish updated event to relays");
      }

      setSuccessMessage("会話が更新されました");
      setSuccessType("save");
    } catch (error) {
      logger.error("Failed to update discussion:", error);
      setErrors(["会話の更新に失敗しました"]);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user.isLoggedIn) {
      router.push(buildLoginRoute(`/discussions/${naddrParam}/edit`));
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

  const handleRequestListing = async () => {
    if (!user.isLoggedIn || !discussion || !user.pubkey) {
      if (!user.isLoggedIn) {
        router.push(buildLoginRoute(`/discussions/${naddrParam}/edit`));
      }
      return;
    }

    setIsRequestingListing(true);
    setErrors([]);
    setSuccessMessage("");
    setSuccessType(null);
    try {
      const discussionNaddr = buildNaddrFromDiscussion(discussion);
      const eventTemplate = createDiscussionListingRequest(
        {
          title: discussion.title,
          description: discussion.description,
          moderators: [],
          dTag: discussion.dTag,
        },
        discussionNaddr,
        ADMIN_PUBKEY,
        user.pubkey,
      );

      const signedEvent = await signEvent(
        eventTemplate as unknown as Record<string, unknown>,
      );
      const published = await nostrService.publishSignedEvent(signedEvent);
      if (!published) {
        throw new Error("Failed to publish listing request");
      }
      setSuccessMessage("会話一覧への掲載を申請しました");
      setSuccessType("listing");
    } catch (error) {
      logger.error("Failed to request listing:", error);
      setErrors(["掲載申請の送信に失敗しました"]);
    } finally {
      setIsRequestingListing(false);
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
      <div className="py-8">
        <div>
          <PageHeader
            title="無効な会話URL"
            description="指定された会話URLが無効です。"
          />
          <Link
            href="/discussions"
            className="btn text-base btn-primary rounded-full dark:rounded-sm"
          >
            会話一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  if (!isDiscussionsEnabled()) {
    return (
      <div className="py-8">
        <PageHeader
          title="会話編集"
          description="この機能は現在利用できません。"
        />
      </div>
    );
  }

  if (isDiscussionLoading) {
    return (
      <div
        className="py-8"
        role="status"
        aria-live="polite"
      >
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        <span className="sr-only">会話情報を読み込み中...</span>
      </div>
    );
  }

  if (!discussion) {
    if (detail.state === "error") {
      return (
        <div className="py-8">
          <div
            className="alert alert-error alert-soft text-base-content!"
            role="status"
            aria-live="polite"
          >
            <span>{detail.error ?? "会話データの取得に失敗しました。"}</span>
            <button
              type="button"
              className="btn text-base btn-outline min-h-[44px] rounded-full dark:rounded-sm"
              onClick={() => void reload()}
            >
              <span className="ruby-text">再読み込み</span>
            </button>
          </div>
        </div>
      );
    }

    if (
      discussionCompletionReason === "idle-timeout" ||
      discussionCompletionReason === "hard-timeout" ||
      discussionCompletionReason === "cancelled"
    ) {
      return (
        <div className="py-8">
          <div
            className="alert alert-warning alert-soft text-base-content! mb-4"
            role="status"
            aria-live="polite"
          >
            <span>
              会話データの取得に時間がかかっています（
              {discussionCompletionReason}）。 受信待機中または relay
              応答遅延の可能性があります。
            </span>
          </div>
          <button
            type="button"
            className="btn text-base btn-outline min-h-[44px] rounded-full dark:rounded-sm"
            onClick={() => void reload()}
          >
            <span className="ruby-text">再読み込み</span>
          </button>
        </div>
      );
    }

    return (
      <div className="py-8">
        <div>
          <PageHeader title="会話が見つかりません" />
          <Link
            href="/discussions"
            className="btn text-base btn-primary rounded-full dark:rounded-sm"
          >
            会話一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  const hasEditPermission = Boolean(user.isLoggedIn && isAuthor);
  const editPermissionReason = !user.isLoggedIn
    ? "編集操作にはログインが必要です。"
    : "会話作成者のみ編集できます。";

  if (!hasEditPermission) {
    return (
      <div className="py-8">
        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body py-8">
            <InformationCircleIcon
              className="h-12 w-12 text-info"
              aria-hidden="true"
            />
            <PageHeader
              title="基本情報を編集できません"
              description="会話の基本情報を編集できるのは会話作成者だけです。"
            />
            {!user.isLoggedIn && (
              <Link
                href={buildLoginRoute(`/discussions/${naddrParam}/edit`)}
                className="btn text-base btn-primary min-h-[44px] rounded-full dark:rounded-sm"
              >
                <span className="ruby-text">ログイン</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div>
        <div id="discussion-edit-main">
          {successMessage ? (
            <div className="card bg-base-100 shadow-lg border border-green-200 dark:border-green-700">
              <div className="card-body ">
                <div className="mb-4">
                  <CheckCircleIcon className="w-16 h-16 text-green-600 dark:text-green-400 " />
                </div>
                <h2 className="text-xl font-semibold mb-4 text-green-600 dark:text-green-400">
                  {successMessage}
                </h2>
                {successType === "save" && (
                  <Link
                    href={`/discussions/${naddrParam}`}
                    className="btn text-base btn-primary min-h-[44px] rounded-full dark:rounded-sm"
                  >
                    <span className="ruby-text">会話画面に戻る</span>
                  </Link>
                )}
                {successType === "listing" && (
                  <p className="text-base-content mb-4">
                    反映まで時間がかかる場合があります。
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="card bg-base-100 shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="card-body">
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
                      className="input w-full"
                      required
                      disabled={isSaving || isDeleting || !hasEditPermission}
                      maxLength={100}
                      autoComplete="off"
                    />
                    <div className="text-base-content mt-1">
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
                      className="textarea w-full h-32"
                      required
                      disabled={isSaving || isDeleting || !hasEditPermission}
                      maxLength={500}
                      autoComplete="off"
                    />
                    <div className="text-base-content mt-1">
                      {formData.description.length}/500文字
                    </div>
                  </div>

                  {/* Read-only ID display - not editable per NIP-72 */}
                  <div>
                    <label className="label ruby-text">
                      <span className="label-text">会話ID</span>
                    </label>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <span className="text-base font-mono">
                        {discussion?.dTag || "loading..."}
                      </span>
                    </div>
                  </div>

                  <div className="hidden" aria-hidden="true">
                    <label htmlFor="moderators" className="label ruby-text">
                      <span className="label-text">モデレーター（任意）</span>
                    </label>

                    {formData.moderators.length > 0 && (
                      <div className="space-y-2 mb-2">
                        {formData.moderators.map((npub) => (
                          <div
                            key={npub}
                            className="flex min-w-0 items-center justify-between gap-3 rounded-box border border-base-300 bg-base-100 p-3"
                          >
                            <UserIdentity pubkey={npub} />
                            <button
                              type="button"
                              onClick={() => removeModerator(npub)}
                              className="btn text-base btn-ghost min-h-[44px] min-w-[44px] rounded-full dark:rounded-sm p-0"
                              aria-label={`モデレーター ${npub} を削除`}
                              disabled={
                                isSaving || isDeleting || !hasEditPermission
                              }
                            >
                              <span className="ruby-text">×</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="join w-full">
                      <input
                        id="moderators"
                        type="text"
                        value={moderatorInput}
                        onChange={(e) => setModeratorInput(e.target.value)}
                        className="input join-item h-11 min-h-[44px] flex-1"
                        placeholder="npub1..."
                        disabled={isSaving || isDeleting}
                        autoComplete="off"
                      />
                      <Button
                        onClick={addModerator}
                        disabled={
                          !moderatorInput.trim() ||
                          isSaving ||
                          isDeleting ||
                          !hasEditPermission
                        }
                        className="join-item h-11"
                      >
                        追加
                      </Button>
                    </div>
                    <PermissionNotice
                      state={buildDisabledActionState(
                        hasEditPermission,
                        editPermissionReason,
                      )}
                      requiresLogin={!user.isLoggedIn}
                      onLogin={() =>
                        router.push(buildLoginRoute(`/discussions/${naddrParam}/edit`))
                      }
                    />
                  </div>

                  {errors.length > 0 && (
                    <div
                      className="alert alert-error alert-soft text-base-content!"
                      role="alert"
                      aria-live="assertive"
                    >
                      <ul className="text-base">
                        {errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <section
                    aria-labelledby="conversation-actions-title"
                    className="space-y-3"
                  >
                    <h3
                      id="conversation-actions-title"
                      className="text-lg font-semibold ruby-text"
                    >
                      会話の操作
                    </h3>
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      <button
                        className="btn text-base btn-primary rounded-full dark:rounded-sm"
                        onClick={handleSave}
                        disabled={
                          isSaving ||
                          isDeleting ||
                          !hasEditPermission ||
                          !formData.title.trim() ||
                          !formData.description.trim()
                        }
                      >
                        {isSaving ? (
                          <span className="ruby-text">保存中...</span>
                        ) : (
                          <span className="ruby-text">変更を保存</span>
                        )}
                      </button>

                      <button
                        className="btn text-base btn-secondary rounded-full dark:rounded-sm"
                        onClick={handleRequestListing}
                        disabled={
                          isSaving ||
                          isDeleting ||
                          isRequestingListing ||
                          !hasEditPermission
                        }
                      >
                        {isRequestingListing ? (
                          <span className="ruby-text">申請中...</span>
                        ) : (
                          <span className="ruby-text">会話一覧へ掲載申請</span>
                        )}
                      </button>
                    </div>
                  </section>

                  <section
                    aria-labelledby="dangerous-actions-title"
                    className="space-y-3 border-t border-base-300 pt-5"
                  >
                    <h3
                      id="dangerous-actions-title"
                      className="text-lg font-semibold text-error ruby-text"
                    >
                      危険な操作
                    </h3>
                    <button
                      className="btn text-base btn-outline btn-error rounded-full dark:rounded-sm min-h-[44px]"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={isSaving || isDeleting || !hasEditPermission}
                    >
                      <span className="ruby-text">
                        {isDeleting ? "削除中..." : "会話を削除"}
                      </span>
                    </button>
                  </section>

                </div>
              </div>
            </div>
          )}
        </div>
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
                className="btn text-base btn-outline rounded-full dark:rounded-sm"
                disabled={isDeleting}
              >
                <span className="ruby-text">キャンセル</span>
              </button>
              <button
                onClick={handleDelete}
                className="btn text-base btn-error rounded-full dark:rounded-sm"
                disabled={isDeleting}
              >
                <span className="ruby-text">削除する</span>
              </button>
            </div>
          </div>
        </dialog>
      )}

    </div>
  );
}
