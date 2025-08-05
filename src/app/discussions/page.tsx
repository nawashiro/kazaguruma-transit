"use client";

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = "force-dynamic";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { isDiscussionsEnabled } from "@/lib/config/discussion-config";
import { LoginModal } from "@/components/discussion/LoginModal";
import { AuditTimeline } from "@/components/discussion/AuditTimeline";
import { AdminCheck } from "@/components/discussion/PermissionGuards";
import { createNostrService } from "@/lib/nostr/nostr-service";
import {
  parseDiscussionEvent,
  parseDiscussionRequestEvent,
  createAuditTimeline,
  formatRelativeTime,
  getAdminPubkeyHex,
} from "@/lib/nostr/nostr-utils";
import Button from "@/components/ui/Button";
import type {
  Discussion,
  DiscussionRequest,
  DiscussionRequestFormData,
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

export default function DiscussionsPage() {
  const [activeTab, setActiveTab] = useState<"main" | "audit">("main");
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [requests, setRequests] = useState<DiscussionRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [requestForm, setRequestForm] = useState<DiscussionRequestFormData>({
    title: "",
    description: "",
  });

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
          <h1 className="text-2xl font-bold mb-4">意見交換機能</h1>
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
      console.error("Failed to load discussions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user.isLoggedIn) {
      setShowLoginModal(true);
      return;
    }

    if (!requestForm.title.trim() || !requestForm.description.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const eventTemplate = nostrService.createDiscussionRequestEvent(
        requestForm.title.trim(),
        requestForm.description.trim(),
        ADMIN_PUBKEY
      );

      const signedEvent = await signEvent(eventTemplate);
      const published = await nostrService.publishSignedEvent(signedEvent);

      if (!published) {
        throw new Error("Failed to publish request to relays");
      }

      setRequestForm({ title: "", description: "" });
      await loadData();
    } catch (error) {
      console.error("Failed to submit request:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const auditItems = createAuditTimeline(discussions, requests, [], []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">意見交換</h1>
        <p className="text-gray-600 dark:text-gray-400">
          風ぐるまの利用体験について意見交換を行う場所です。
        </p>
      </div>

      <div className="join mb-6">
        <input
          className="join-item btn"
          type="radio"
          name="tab-options"
          aria-label="会話一覧"
          checked={activeTab === "main"}
          onChange={() => setActiveTab("main")}
        />
        <input
          className="join-item btn"
          type="radio"
          name="tab-options"
          aria-label="監査ログ"
          checked={activeTab === "audit"}
          onChange={() => setActiveTab("audit")}
        />
      </div>

      {activeTab === "main" ? (
        <div className="space-y-6">
          <AdminCheck adminPubkey={ADMIN_PUBKEY} userPubkey={user.pubkey}>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <Link
                href="/discussions/manage"
                className="btn btn-primary rounded-full dark:rounded-sm"
              >
                会話管理
              </Link>
            </div>
          </AdminCheck>

          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">会話一覧</h2>

              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    </div>
                  ))}
                </div>
              ) : discussions.length > 0 ? (
                <div className="space-y-4">
                  {discussions.map((discussion) => (
                    <Link
                      key={discussion.id}
                      href={`/discussions/${discussion.dTag}`}
                      className="block"
                    >
                      <div className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700">
                        <div className="card-body p-4">
                          <h3 className="card-title text-lg">
                            {discussion.title}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {discussion.description}
                          </p>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-xs text-gray-500">
                              {formatRelativeTime(discussion.createdAt)}
                            </span>
                            <span className="badge badge-outline badge-sm">
                              {discussion.moderators.length + 1} モデレーター
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-400">
                    会話がまだありません。
                  </p>
                </div>
              )}
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">
                新しい会話をリクエスト
              </h2>

              <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="card-body">
                  <form onSubmit={handleRequestSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="title" className="label">
                        <span className="label-text">タイトル</span>
                      </label>
                      <input
                        type="text"
                        id="title"
                        value={requestForm.title}
                        onChange={(e) =>
                          setRequestForm((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                        className="input input-bordered w-full"
                        placeholder="会話のタイトル"
                        required
                        disabled={isSubmitting}
                        maxLength={100}
                      />
                    </div>

                    <div>
                      <label htmlFor="description" className="label">
                        <span className="label-text">説明</span>
                      </label>
                      <textarea
                        id="description"
                        value={requestForm.description}
                        onChange={(e) =>
                          setRequestForm((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        className="textarea textarea-bordered w-full h-24"
                        placeholder="会話の目的や内容を説明してください"
                        required
                        disabled={isSubmitting}
                        maxLength={500}
                      />
                    </div>

                    <Button
                      type="submit"
                      className={isSubmitting ? "loading" : ""}
                      fullWidth
                      disabled={
                        isSubmitting ||
                        !requestForm.title.trim() ||
                        !requestForm.description.trim()
                      }
                      loading={isSubmitting}
                    >
                      <p>{isSubmitting ? "" : "リクエストを送信"}</p>
                    </Button>
                  </form>

                  <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                    <p>管理者による確認後、会話が作成される場合があります。</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-semibold mb-4">監査ログ</h2>
          <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="card-body">
              {isLoading ? (
                <div className="animate-pulse space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="h-16 bg-gray-200 dark:bg-gray-700 rounded"
                    ></div>
                  ))}
                </div>
              ) : (
                <AuditTimeline items={auditItems} />
              )}
            </div>
          </div>
        </div>
      )}

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}
