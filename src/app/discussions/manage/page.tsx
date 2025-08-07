"use client";

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = "force-dynamic";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { isDiscussionsEnabled } from "@/lib/config/discussion-config";
import {
  AdminCheck,
  PermissionError,
} from "@/components/discussion/PermissionGuards";
import { createNostrService } from "@/lib/nostr/nostr-service";
import {
  parseDiscussionEvent,
  parseDiscussionRequestEvent,
  validateDiscussionForm,
  formatRelativeTime,
  hexToNpub,
  npubToHex,
  isValidNpub,
  getAdminPubkeyHex,
} from "@/lib/nostr/nostr-utils";
import Button from "@/components/ui/Button";
import type {
  Discussion,
  DiscussionRequest,
  DiscussionFormData,
} from "@/types/discussion";

const ADMIN_PUBKEY = getAdminPubkeyHex();
const RELAYS = [
  { url: "wss://relay.damus.io", read: true, write: true },
  { url: "wss://relay.nostr.band", read: true, write: true },
  { url: "wss://nos.lol", read: true, write: true },
];

const nostrService = createNostrService({
  relays: RELAYS,
  defaultTimeout: 5000,
});


export default function DiscussionManagePage() {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [requests, setRequests] = useState<DiscussionRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<DiscussionFormData>({
    title: "",
    description: "",
    moderators: [],
  });
  const [editForm, setEditForm] = useState<DiscussionFormData>({
    title: "",
    description: "",
    moderators: [],
  });
  const [moderatorInput, setModeratorInput] = useState("");
  const [editModeratorInput, setEditModeratorInput] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [editErrors, setEditErrors] = useState<string[]>([]);

  const { user, signEvent } = useAuth();

  useEffect(() => {
    if (isDiscussionsEnabled()) {
      loadData();
    }
  }, []);

  // Check if discussions are enabled and render accordingly
  if (!isDiscussionsEnabled()) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">会話管理</h1>
          <p className="text-gray-600">この機能は現在利用できません。</p>
        </div>
      </div>
    );
  }

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [discussionEvents, requestEvents] = await Promise.all([
        nostrService.getDiscussions(ADMIN_PUBKEY),
        nostrService.getDiscussionRequests(ADMIN_PUBKEY),
      ]);

      const parsedDiscussions = discussionEvents
        .map(parseDiscussionEvent)
        .filter((d): d is Discussion => d !== null)
        .sort((a, b) => b.createdAt - a.createdAt);

      const parsedRequests = requestEvents
        .map(parseDiscussionRequestEvent)
        .filter((r): r is DiscussionRequest => r !== null)
        .sort((a, b) => b.createdAt - a.createdAt);

      setDiscussions(parsedDiscussions);
      setRequests(parsedRequests);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateDiscussionForm(createForm);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors([]);

    try {
      const eventTemplate = nostrService.createDiscussionEvent(
        createForm.title.trim(),
        createForm.description.trim(),
        createForm.moderators
      );

      const signedEvent = await signEvent(eventTemplate);
      const published = await nostrService.publishSignedEvent(signedEvent);

      if (!published) {
        throw new Error("Failed to publish event to relays");
      }

      setCreateForm({
        title: "",
        description: "",
        moderators: [],
      });
      setModeratorInput("");
      await loadData();
    } catch (error) {
      console.error("Failed to create discussion:", error);
      setErrors(["会話の作成に失敗しました"]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDiscussion = async (discussionId: string) => {
    if (!confirm("この会話を削除してもよろしいですか？")) {
      return;
    }

    setDeletingId(discussionId);
    try {
      const discussion = discussions.find((d) => d.id === discussionId);
      if (!discussion) return;

      const deleteEvent = nostrService.createDeleteEvent(discussion.event.id);
      const signedEvent = await signEvent(deleteEvent);
      const published = await nostrService.publishSignedEvent(signedEvent);

      if (!published) {
        throw new Error("Failed to publish delete event to relays");
      }

      await loadData();
    } catch (error) {
      console.error("Failed to delete discussion:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const addModerator = () => {
    const trimmed = moderatorInput.trim();
    if (trimmed && isValidNpub(trimmed)) {
      const hexKey = npubToHex(trimmed);
      if (!createForm.moderators.includes(hexKey)) {
        setCreateForm((prev) => ({
          ...prev,
          moderators: [...prev.moderators, hexKey],
        }));
        setModeratorInput("");
        setErrors([]);
      }
    } else {
      setErrors(["有効なnpub形式の公開鍵を入力してください"]);
    }
  };

  const removeModerator = (pubkey: string) => {
    setCreateForm((prev) => ({
      ...prev,
      moderators: prev.moderators.filter((m) => m !== pubkey),
    }));
  };

  const startEdit = (discussion: Discussion) => {
    setEditingId(discussion.id);
    setEditForm({
      title: discussion.title,
      description: discussion.description,
      moderators: discussion.moderators.map((m) => m.pubkey),
    });
    setEditModeratorInput("");
    setEditErrors([]);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      title: "",
      description: "",
      moderators: [],
    });
    setEditModeratorInput("");
    setEditErrors([]);
  };

  const handleEditSubmit = async (discussion: Discussion) => {
    const validationErrors = validateDiscussionForm(editForm);
    if (validationErrors.length > 0) {
      setEditErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setEditErrors([]);

    try {
      // NIP-72: replaceable eventとして同じdTagで新しいイベントを発行
      const eventTemplate = nostrService.createDiscussionEvent(
        editForm.title.trim(),
        editForm.description.trim(),
        editForm.moderators,
        discussion.dTag // 既存のdTagを使用
      );

      const signedEvent = await signEvent(eventTemplate);
      const published = await nostrService.publishSignedEvent(signedEvent);

      if (!published) {
        throw new Error("Failed to publish event to relays");
      }

      cancelEdit();
      await loadData();
    } catch (error) {
      console.error("Failed to update discussion:", error);
      setEditErrors(["会話の更新に失敗しました"]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addEditModerator = () => {
    const trimmed = editModeratorInput.trim();
    if (trimmed && isValidNpub(trimmed)) {
      const hexKey = npubToHex(trimmed);
      if (!editForm.moderators.includes(hexKey)) {
        setEditForm((prev) => ({
          ...prev,
          moderators: [...prev.moderators, hexKey],
        }));
        setEditModeratorInput("");
        setEditErrors([]);
      }
    } else {
      setEditErrors(["有効なnpub形式の公開鍵を入力してください"]);
    }
  };

  const removeEditModerator = (pubkey: string) => {
    setEditForm((prev) => ({
      ...prev,
      moderators: prev.moderators.filter((m) => m !== pubkey),
    }));
  };

  return (
    <AdminCheck
      adminPubkey={ADMIN_PUBKEY}
      userPubkey={user.pubkey}
      fallback={<PermissionError type="admin" />}
    >
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link
            href="/discussions"
            className="btn btn-ghost btn-sm mb-4 rounded-full dark:rounded-sm"
          >
            ← 会話一覧
          </Link>
          <h1 className="text-3xl font-bold">会話管理</h1>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <section aria-labelledby="create-discussion-heading">
            <h2 id="create-discussion-heading" className="text-xl font-semibold mb-4">新しい会話作成</h2>

            <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="card-body">
                <form onSubmit={handleCreateSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="create-title" className="label">
                      <span className="label-text">タイトル *</span>
                    </label>
                    <input
                      type="text"
                      id="create-title"
                      value={createForm.title}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      className="input input-bordered w-full"
                      placeholder="会話のタイトル"
                      required
                      disabled={isSubmitting}
                      maxLength={100}
                      autoComplete="off"
                    />
                  </div>

                  <div>
                    <label htmlFor="create-description" className="label">
                      <span className="label-text">説明 *</span>
                    </label>
                    <textarea
                      id="create-description"
                      value={createForm.description}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      className="textarea textarea-bordered w-full h-24"
                      placeholder="会話の目的や内容"
                      required
                      disabled={isSubmitting}
                      maxLength={500}
                      autoComplete="off"
                    />
                  </div>

                  <div>
                    <label htmlFor="moderator-input" className="label">
                      <span className="label-text">モデレーター</span>
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        id="moderator-input"
                        value={moderatorInput}
                        onChange={(e) => setModeratorInput(e.target.value)}
                        className="input input-bordered flex-1"
                        placeholder="npub形式の公開鍵"
                        disabled={isSubmitting}
                        autoComplete="off"
                      />
                      <Button
                        type="button"
                        onClick={addModerator}
                        secondary
                        disabled={isSubmitting || !moderatorInput.trim()}
                      >
                        追加
                      </Button>
                    </div>

                    {createForm.moderators.length > 0 && (
                      <div className="space-y-1">
                        {createForm.moderators.map((mod) => (
                          <div
                            key={mod}
                            className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded"
                          >
                            <span className="font-mono text-sm flex-1">
                              {hexToNpub(mod).slice(0, 12)}...{hexToNpub(mod).slice(-8)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeModerator(mod)}
                              className="btn btn-xs btn-error rounded-full dark:rounded-sm"
                              disabled={isSubmitting}
                            >
                              削除
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
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
                    type="submit"
                    fullWidth
                    disabled={isSubmitting}
                    loading={isSubmitting}
                  >
                    <p>{isSubmitting ? "" : "会話作成"}</p>
                  </Button>
                </form>
              </div>
            </div>
          </section>

          <div className="space-y-6">
            <section aria-labelledby="existing-discussions-heading">
              <h2 id="existing-discussions-heading" className="text-xl font-semibold mb-4">既存の会話</h2>

              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    </div>
                  ))}
                </div>
              ) : discussions.length > 0 ? (
                <div className="space-y-3">
                  {discussions.map((discussion) => (
                    <div
                      key={discussion.id}
                      className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700"
                    >
                      <div className="card-body p-4">
                        {editingId === discussion.id ? (
                          // 編集フォーム
                          <div className="space-y-4">
                            <div>
                              <label className="label">
                                <span className="label-text">タイトル *</span>
                              </label>
                              <input
                                type="text"
                                value={editForm.title}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    title: e.target.value,
                                  }))
                                }
                                className="input input-bordered w-full"
                                placeholder="会話のタイトル"
                                required
                                disabled={isSubmitting}
                                maxLength={100}
                                autoComplete="off"
                              />
                            </div>

                            <div>
                              <label className="label">
                                <span className="label-text">説明 *</span>
                              </label>
                              <textarea
                                value={editForm.description}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    description: e.target.value,
                                  }))
                                }
                                className="textarea textarea-bordered w-full h-20"
                                placeholder="会話の目的や内容"
                                required
                                disabled={isSubmitting}
                                maxLength={500}
                                autoComplete="off"
                              />
                            </div>

                            <div>
                              <label className="label">
                                <span className="label-text">モデレーター</span>
                              </label>
                              <div className="flex gap-2 mb-2">
                                <input
                                  type="text"
                                  value={editModeratorInput}
                                  onChange={(e) =>
                                    setEditModeratorInput(e.target.value)
                                  }
                                  className="input input-bordered flex-1"
                                  placeholder="npub形式の公開鍵"
                                  disabled={isSubmitting}
                                  autoComplete="off"
                                />
                                <Button
                                  type="button"
                                  onClick={addEditModerator}
                                  secondary
                                  disabled={
                                    isSubmitting || !editModeratorInput.trim()
                                  }
                                >
                                  追加
                                </Button>
                              </div>

                              {editForm.moderators.length > 0 && (
                                <div className="space-y-1">
                                  {editForm.moderators.map((mod) => (
                                    <div
                                      key={mod}
                                      className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded"
                                    >
                                      <span className="font-mono text-sm flex-1">
                                        {hexToNpub(mod).slice(0, 12)}...{hexToNpub(mod).slice(-8)}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => removeEditModerator(mod)}
                                        className="btn btn-xs btn-error rounded-full dark:rounded-sm"
                                        disabled={isSubmitting}
                                      >
                                        削除
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {editErrors.length > 0 && (
                              <div className="alert alert-error">
                                <ul className="text-sm">
                                  {editErrors.map((error, index) => (
                                    <li key={index}>{error}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <div className="flex gap-2 justify-end">
                              <Button
                                type="button"
                                onClick={cancelEdit}
                                secondary
                                disabled={isSubmitting}
                              >
                                キャンセル
                              </Button>
                              <Button
                                type="button"
                                onClick={() => handleEditSubmit(discussion)}
                                disabled={isSubmitting}
                                loading={isSubmitting}
                              >
                                {isSubmitting ? "" : "更新"}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          // 表示モード
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                            {/* コンテンツ */}
                            <div className="flex-1 order-2 sm:order-1">
                              <h3 className="font-medium">
                                {discussion.title}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {discussion.description}
                              </p>
                              <div className="flex items-center gap-4 mt-2">
                                <span className="text-xs text-gray-500">
                                  {formatRelativeTime(discussion.createdAt)}
                                </span>
                                <span className="badge badge-outline badge-xs">
                                  {discussion.moderators.length + 1}{" "}
                                  モデレーター
                                </span>
                              </div>
                            </div>

                            {/* ボタン */}
                            <div className="flex gap-2 justify-end order-1 sm:order-2 sm:flex-shrink-0">
                              <button
                                onClick={() => startEdit(discussion)}
                                className="btn btn-outline btn-sm sm:btn-md rounded-full dark:rounded-sm"
                                disabled={isSubmitting}
                              >
                                編集
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteDiscussion(discussion.id)
                                }
                                className="btn btn-error btn-sm sm:btn-md rounded-full dark:rounded-sm"
                                disabled={deletingId === discussion.id}
                              >
                                {deletingId === discussion.id ? "" : "削除"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-400">
                  会話はありません。
                </p>
              )}
            </section>
            <section aria-labelledby="requests-heading">
              <h2 id="requests-heading" className="text-xl font-semibold mb-4">リクエスト一覧</h2>

              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    </div>
                  ))}
                </div>
              ) : requests.length > 0 ? (
                <div className="space-y-3">
                  {requests.map((request) => (
                    <div
                      key={request.id}
                      className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700"
                    >
                      <div className="card-body p-4">
                        <h3 className="font-medium">{request.title}</h3>
                        {request.description.split("\n").map((line, index) => (
                          <p
                            className="text-sm text-gray-600 dark:text-gray-400"
                            key={index}
                          >
                            {line}
                          </p>
                        ))}
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs text-gray-500">
                            {formatRelativeTime(request.createdAt)}
                          </span>
                          <span className="text-xs font-mono">
                            {hexToNpub(request.requesterPubkey).slice(0, 12)}...
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-400">
                  リクエストはありません。
                </p>
              )}
            </section>
          </div>
        </div>
      </div>
    </AdminCheck>
  );
}
