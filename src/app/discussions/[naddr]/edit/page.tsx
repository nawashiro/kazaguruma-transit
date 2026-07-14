"use client";

export const dynamic = "force-dynamic";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/lib/auth/auth-context";
import { useDiscussionMeta } from "@/components/discussion/DiscussionTabLayout";
import {
  isDiscussionsEnabled,
  getNostrServiceConfig,
  getDiscussionReadStrategyConfig,
} from "@/lib/config/discussion-config";
import { selectRelayCandidates } from "@/lib/discussion/relay-candidate-selector";
import { LoginModal } from "@/components/discussion/LoginModal";
import {
  buildDisabledActionState,
  DisabledReasonText,
  PermissionNotice,
} from "@/components/discussion/PermissionGuards";
import { createNostrService } from "@/lib/nostr/nostr-service";
import {
  isValidNpub,
  npubToHex,
  getAdminPubkeyHex,
  formatRelativeTime,
} from "@/lib/nostr/nostr-utils";
import {
  extractDiscussionFromNaddr,
  buildNaddrFromDiscussion,
} from "@/lib/nostr/naddr-utils";
import {
  createDiscussionListingRequest,
  createModeratorPromotionRequestEvent,
} from "@/lib/discussion/user-creation-flow";
import { formatBip39JapaneseMnemonicPreviewFromPubkey } from "@/lib/nostr/mnemonic-utils";
import { UserIdentity } from "@/components/ui/UserIdentity";
import {
  createDiscussionNdkGateway,
  type ModeratorDecision,
} from "@/lib/nostr/discussion-ndk-gateway";
import Button from "@/components/ui/Button";
import type { Discussion } from "@/types/discussion";
import { logger } from "@/utils/logger";
import type { Event } from "@/lib/nostr/nostr-service";

// const ADMIN_PUBKEY = getAdminPubkeyHex(); // eslint-disable-line @typescript-eslint/no-unused-vars
const nostrServiceConfig = getNostrServiceConfig();
const readStrategy =
  typeof getDiscussionReadStrategyConfig === "function"
    ? getDiscussionReadStrategyConfig()
    : {
      relayLimit: 3,
      idleTimeoutMs: nostrServiceConfig.defaultTimeout,
      hardTimeoutMs: nostrServiceConfig.defaultTimeout * 3,
      dedupWindowMs: 250,
    };
const nostrService = createNostrService(nostrServiceConfig);
const discussionGateway = createDiscussionNdkGateway(nostrServiceConfig);
const ADMIN_PUBKEY = getAdminPubkeyHex();

interface EditFormData {
  title: string;
  description: string;
  moderators: string[];
}

interface ModeratorPromotionRequest {
  id: string;
  applicantPubkey: string;
  createdAt: number;
  event: Event;
}

export default function DiscussionEditPage() {
  const params = useParams();
  const router = useRouter();
  const naddrParam = params.naddr as string;
  const { user, signEvent } = useAuth();
  const discussionMeta = useDiscussionMeta();
  const layoutDiscussion = discussionMeta?.discussion ?? null;
  const isDiscussionLoading = discussionMeta?.isLoading ?? false;
  const discussionCompletionReason = discussionMeta?.completionReason ?? null;

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
  const [isRequestingListing, setIsRequestingListing] = useState(false);
  const [isRequestingPromotion, setIsRequestingPromotion] = useState(false);
  const [decidingPromotionIds, setDecidingPromotionIds] = useState<Set<string>>(
    new Set(),
  );
  const [promotionRequestMessage, setPromotionRequestMessage] = useState("");
  const [promotionRequests, setPromotionRequests] = useState<
    ModeratorPromotionRequest[]
  >([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [successType, setSuccessType] = useState<
    "save" | "listing" | "promotion" | null
  >(null);
  const promotionRequestStreamCleanupRef = useRef<(() => void) | null>(null);
  const readGenerationRef = useRef(0);

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
        if (prev?.id === layoutDiscussion.id) {
          return prev;
        }
        return layoutDiscussion;
      });
      setFormData({
        title: layoutDiscussion.title,
        description: layoutDiscussion.description,
        moderators: layoutDiscussion.moderators.map((m) => m.pubkey),
      });
      return;
    }

    if (!isDiscussionLoading) {
      setDiscussion(null);
    }
  }, [layoutDiscussion, isDiscussionLoading]);

  const startStreamingDiscussion = useCallback(() => {
    promotionRequestStreamCleanupRef.current?.();
    const readGeneration = ++readGenerationRef.current;

    if (!isDiscussionsEnabled() || !discussionInfo) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const relayUrls = selectRelayCandidates({
      hints: discussionInfo.relays,
      configured: (nostrServiceConfig.relays ?? [])
        .filter((relay) => relay.read)
        .map((relay) => relay.url),
      defaults: [],
      limit: readStrategy.relayLimit,
    }).map((relay) => relay.url);

    promotionRequestStreamCleanupRef.current = nostrService.streamEventsOnEvent(
      [
        {
          kinds: [1111],
          "#a": [discussionInfo.discussionId],
          "#t": ["moderator-request"],
          limit: 50,
        },
      ],
      {
        onEvent: (events) => {
          if (readGenerationRef.current !== readGeneration) return;
          const requests = events
            .filter((event) =>
              event.tags.some(
                (tag) => tag[0] === "t" && tag[1] === "moderator-request",
              ),
            )
            .map((event) => ({
              id: event.id,
              applicantPubkey: event.pubkey,
              createdAt: event.created_at,
              event,
            }))
            .sort((a, b) => b.createdAt - a.createdAt);
          setPromotionRequests(requests);
          setIsLoading(false);
        },
        onEose: (events) => {
          if (readGenerationRef.current !== readGeneration) return;
          const requests = events
            .filter((event) =>
              event.tags.some(
                (tag) => tag[0] === "t" && tag[1] === "moderator-request",
              ),
            )
            .map((event) => ({
              id: event.id,
              applicantPubkey: event.pubkey,
              createdAt: event.created_at,
              event,
            }))
            .sort((a, b) => b.createdAt - a.createdAt);
          setPromotionRequests(requests);
          setIsLoading(false);
        },
        timeoutMs: nostrServiceConfig.defaultTimeout,
        ...(relayUrls.length > 0 ? { relayUrls } : {}),
      },
    );
  }, [discussionInfo]);

  useEffect(() => {
    startStreamingDiscussion();

    return () => {
      promotionRequestStreamCleanupRef.current?.();
      promotionRequestStreamCleanupRef.current = null;
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

  const handleRequestListing = async () => {
    if (!user.isLoggedIn || !discussion || !user.pubkey) {
      setShowLoginModal(true);
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

  const handleRequestPromotion = async () => {
    if (!user.isLoggedIn || !discussion || !user.pubkey) {
      setShowLoginModal(true);
      return;
    }

    setIsRequestingPromotion(true);
    setErrors([]);
    setSuccessMessage("");
    setSuccessType(null);
    try {
      const eventTemplate = createModeratorPromotionRequestEvent(
        discussion.id,
        discussion.authorPubkey,
        user.pubkey,
        promotionRequestMessage,
      );

      const signedEvent = await signEvent(
        eventTemplate as unknown as Record<string, unknown>,
      );
      const published = await nostrService.publishSignedEvent(signedEvent);
      if (!published) {
        throw new Error("Failed to publish moderator promotion request");
      }

      setPromotionRequests((prev) => [
        {
          id: signedEvent.id,
          applicantPubkey: user.pubkey || "",
          createdAt: signedEvent.created_at,
          event: signedEvent,
        },
        ...prev.filter((request) => request.id !== signedEvent.id),
      ]);
      setPromotionRequestMessage("");
      setSuccessMessage("モデレーター昇格申請を送信しました");
      setSuccessType("promotion");
    } catch (error) {
      logger.error("Failed to request moderator promotion:", error);
      setErrors(["モデレーター昇格申請の送信に失敗しました"]);
    } finally {
      setIsRequestingPromotion(false);
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

  const handleModerationDecision = async (
    request: ModeratorPromotionRequest,
    decision: ModeratorDecision,
  ) => {
    if (!discussion || !user.isLoggedIn || !user.pubkey || !isAuthor) {
      return;
    }

    setDecidingPromotionIds((prev) => new Set(prev).add(request.id));
    try {
      const eventTemplate = discussionGateway.createModeratorDecisionDraft({
        discussionEvent: discussion.event,
        applicantPubkey: request.applicantPubkey,
        decision,
        actorPubkey: user.pubkey,
      });

      const signedEvent = await signEvent(
        eventTemplate as unknown as Record<string, unknown>,
      );
      const published = await nostrService.publishSignedEvent(signedEvent);
      if (!published) {
        throw new Error("Failed to publish moderator decision");
      }

      setDiscussion((prev) => {
        if (!prev) return prev;
        const hasApplicant = prev.moderators.some(
          (moderator) => moderator.pubkey === request.applicantPubkey,
        );
        const nextModerators =
          decision === "approved"
            ? hasApplicant
              ? prev.moderators
              : [...prev.moderators, { pubkey: request.applicantPubkey }]
            : prev.moderators.filter(
              (moderator) => moderator.pubkey !== request.applicantPubkey,
            );

        return {
          ...prev,
          moderators: nextModerators,
          event: {
            ...signedEvent,
          },
        };
      });

      setSuccessMessage(
        decision === "approved"
          ? "モデレーター昇格を承認しました"
          : "モデレーター昇格を却下しました",
      );
      setSuccessType("promotion");
    } catch (error) {
      logger.error("Failed to decide moderator promotion:", error);
      setErrors(["モデレーター昇格審査に失敗しました"]);
    } finally {
      setDecidingPromotionIds((prev) => {
        const next = new Set(prev);
        next.delete(request.id);
        return next;
      });
    }
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

  if (isDiscussionLoading || isLoading) {
    return (
      <div
        className="container mx-auto px-4 py-8"
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
    if (
      discussionCompletionReason === "idle-timeout" ||
      discussionCompletionReason === "hard-timeout" ||
      discussionCompletionReason === "cancelled"
    ) {
      return (
        <div className="container mx-auto px-4 py-8">
          <div className="alert alert-warning mb-4" role="alert">
            <span>
              会話データの取得に時間がかかっています（
              {discussionCompletionReason}）。 受信待機中または relay
              応答遅延の可能性があります。
            </span>
          </div>
          <button
            type="button"
            className="btn btn-outline rounded-full dark:rounded-sm"
            onClick={() => window.location.reload()}
          >
            再読み込み
          </button>
        </div>
      );
    }

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

  const hasEditPermission = Boolean(user.isLoggedIn && isAuthor);
  const editPermissionReason = !user.isLoggedIn
    ? "編集操作にはログインが必要です。"
    : "会話作成者のみ編集できます。";
  const isCurrentModerator = Boolean(
    user.pubkey &&
    discussion.moderators.some((moderator) => moderator.pubkey === user.pubkey),
  );
  const canRequestPromotion = Boolean(
    user.isLoggedIn && !isAuthor && !isCurrentModerator,
  );
  const requestPromotionReason = !user.isLoggedIn
    ? "昇格申請にはログインが必要です。"
    : isAuthor
      ? "会話作成者は昇格申請の対象ではありません。"
      : "すでにモデレーターです。";

  if (!hasEditPermission) {
    return (
      <main className="container mx-auto px-4 py-8" role="main">
        <div className="card max-w-2xl mx-auto bg-base-100 shadow-sm border border-base-300">
          <div className="card-body items-center text-center py-8">
            <InformationCircleIcon
              className="h-12 w-12 text-info"
              aria-hidden="true"
            />
            <h1 className="mt-4 text-lg font-medium text-base-content ruby-text">
              基本情報を編集できません
            </h1>
            <p className="mt-2 text-sm text-base-content/70 ruby-text">
              会話の基本情報を編集できるのは会話作成者だけです。
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <main id="discussion-edit-main" role="main">
          {successMessage ? (
            <div className="card bg-base-100 shadow-lg border border-green-200 dark:border-green-700">
              <div className="card-body text-center">
                <div className="mb-4">
                  <CheckCircleIcon className="w-16 h-16 text-green-600 dark:text-green-400 mx-auto" />
                </div>
                <h2 className="text-xl font-semibold mb-4 text-green-600 dark:text-green-400">
                  {successMessage}
                </h2>
                {successType === "save" && (
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    まもなく会話画面に戻ります...
                  </p>
                )}
                {successType === "listing" && (
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
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
                      className="textarea w-full h-32"
                      required
                      disabled={isSaving || isDeleting || !hasEditPermission}
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
                              className="btn btn-ghost min-h-[44px] min-w-[44px] rounded-full dark:rounded-sm p-0"
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
                      onLogin={() => setShowLoginModal(true)}
                    />
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
                        className="btn btn-primary rounded-full dark:rounded-sm"
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
                        className="btn btn-secondary rounded-full dark:rounded-sm"
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
                      className="btn btn-outline btn-error rounded-full dark:rounded-sm min-h-[44px]"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={isSaving || isDeleting || !hasEditPermission}
                    >
                      <span className="ruby-text">
                        {isDeleting ? "削除中..." : "会話を削除"}
                      </span>
                    </button>
                  </section>

                  {false && discussion && (
                    <section aria-labelledby="moderator-section-title">
                      <h3
                        id="moderator-section-title"
                        className="text-lg font-semibold ruby-text"
                      >
                        モデレーター管理
                      </h3>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 ruby-text">
                          現在のモデレーター（Mnemonic）
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {discussion!.moderators.length > 0 ? (
                            discussion!.moderators.map((moderator) => (
                              <span
                                key={moderator.pubkey}
                                className="badge badge-outline"
                              >
                                {formatBip39JapaneseMnemonicPreviewFromPubkey(
                                  moderator.pubkey,
                                )}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-gray-500 ruby-text">
                              モデレーターは未設定です。
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 ruby-text">
                          モデレーター昇格申請
                        </p>
                        <textarea
                          value={promotionRequestMessage}
                          onChange={(e) =>
                            setPromotionRequestMessage(e.target.value)
                          }
                          className="textarea w-full h-24 mb-2"
                          placeholder="申請理由（任意）"
                          disabled={isRequestingPromotion}
                        />
                        <button
                          className="btn btn-outline rounded-full dark:rounded-sm"
                          onClick={handleRequestPromotion}
                          disabled={
                            isRequestingPromotion || !canRequestPromotion
                          }
                        >
                          <span className="ruby-text">
                            {isRequestingPromotion
                              ? "申請中..."
                              : "モデレーター昇格を申請"}
                          </span>
                        </button>
                        <PermissionNotice
                          state={buildDisabledActionState(
                            canRequestPromotion,
                            requestPromotionReason,
                          )}
                          requiresLogin={false}
                          onLogin={() => setShowLoginModal(true)}
                        />
                      </div>

                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 ruby-text">
                          昇格申請ユーザー一覧
                        </p>
                        {promotionRequests.length === 0 ? (
                          <p className="text-sm text-gray-500 ruby-text">
                            申請はまだありません。
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {promotionRequests.map((request) => (
                              <div
                                key={request.id}
                                className="p-3 border border-base-300 rounded-lg"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="badge badge-outline">
                                    {formatBip39JapaneseMnemonicPreviewFromPubkey(
                                      request.applicantPubkey,
                                    )}
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    {formatRelativeTime(request.createdAt)}
                                  </span>
                                  <span
                                    className={`badge ${discussion!.moderators.some(
                                      (moderator) =>
                                        moderator.pubkey ===
                                        request.applicantPubkey,
                                    )
                                        ? "badge-success"
                                        : "badge-ghost"
                                      }`}
                                  >
                                    {discussion!.moderators.some(
                                      (moderator) =>
                                        moderator.pubkey ===
                                        request.applicantPubkey,
                                    )
                                      ? "approved"
                                      : "unapproved"}
                                  </span>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    className="btn btn-primary rounded-full dark:rounded-sm"
                                    onClick={() =>
                                      handleModerationDecision(
                                        request,
                                        "approved",
                                      )
                                    }
                                    disabled={
                                      !isAuthor ||
                                      decidingPromotionIds.has(request.id)
                                    }
                                  >
                                    <span className="ruby-text">承認</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-outline rounded-full dark:rounded-sm"
                                    onClick={() =>
                                      handleModerationDecision(
                                        request,
                                        "unapproved",
                                      )
                                    }
                                    disabled={
                                      !isAuthor ||
                                      decidingPromotionIds.has(request.id)
                                    }
                                  >
                                    <span className="ruby-text">却下</span>
                                  </button>
                                </div>
                                <DisabledReasonText
                                  state={buildDisabledActionState(
                                    Boolean(isAuthor),
                                    "昇格審査は会話作成者のみ操作できます。",
                                  )}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </section>
                  )}
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
                <span className="ruby-text">キャンセル</span>
              </button>
              <button
                onClick={handleDelete}
                className="btn btn-error rounded-full dark:rounded-sm"
                disabled={isDeleting}
              >
                <span className="ruby-text">削除する</span>
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
