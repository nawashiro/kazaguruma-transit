"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useDiscussionMeta } from "@/components/discussion/DiscussionTabLayout";
import { ModeratorManagementSection } from "@/components/discussion/ModeratorManagementSection";
import { LoginModal } from "@/components/discussion/LoginModal";
import { createNostrService, type Event } from "@/lib/nostr/nostr-service";
import { createDiscussionNdkGateway } from "@/lib/nostr/discussion-ndk-gateway";
import { getNostrServiceConfig } from "@/lib/config/discussion-config";
import { createModeratorPromotionRequestEvent } from "@/lib/discussion/user-creation-flow";
import {
  calculateModeratorUpdateTimestamp,
  calculateNextModeratorPubkeys,
  deriveLatestModeratorApplications,
  derivePendingModeratorApplications,
} from "@/lib/discussion/moderator-application-state";
import { isValidNpub, npubToHex } from "@/lib/nostr/nostr-utils";
import { logger } from "@/utils/logger";
const config = getNostrServiceConfig();
const service = createNostrService(config);
const gateway = createDiscussionNdkGateway(config);
export default function ModeratorsPage() {
  const { user, signEvent } = useAuth();
  const meta = useDiscussionMeta();
  const discussion = meta?.discussion;
  const [events, setEvents] = useState<Event[]>([]),
    [reason, setReason] = useState(""),
    [showLogin, setShowLogin] = useState(false),
    [approved, setApproved] = useState(new Set<string>()),
    [removed, setRemoved] = useState(new Set<string>()),
    [direct, setDirect] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!discussion) return;
    return service.streamEventsOnEvent(
      [
        {
          kinds: [1111],
          "#a": [discussion.id],
          "#t": ["moderator-request"],
          limit: 50,
        },
      ],
      { onEvent: setEvents, onEose: setEvents },
    );
  }, [discussion]);
  const applications = useMemo(
    () =>
      discussion ? derivePendingModeratorApplications(discussion, events) : [],
    [discussion, events],
  );
  const applicationsByPubkey = useMemo(
    () =>
      discussion
        ? deriveLatestModeratorApplications(discussion.id, events)
        : new Map(),
    [discussion, events],
  );
  const isCreator = Boolean(
    discussion && user.pubkey === discussion.authorPubkey,
  );
  const isModerator = Boolean(
    user.pubkey && discussion?.moderators.some((m) => m.pubkey === user.pubkey),
  );
  const isPending = applications.some((a) => a.applicantPubkey === user.pubkey);
  const toggle = (
    set: Set<string>,
    change: (value: Set<string>) => void,
    key: string,
  ) => {
    const next = new Set(set);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    change(next);
  };
  const request = async () => {
    if (!discussion || !user.pubkey) {
      setShowLogin(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const signed = await signEvent(
        createModeratorPromotionRequestEvent(
          discussion.id,
          discussion.authorPubkey,
          user.pubkey,
          reason,
        ) as unknown as Record<string, unknown>,
      );
      if (!(await service.publishSignedEvent(signed))) throw new Error();
      setEvents((old) => [signed as Event, ...old]);
      setReason("");
    } catch {
      setError("モデレーター申請の送信に失敗しました。");
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    if (!discussion || !user.pubkey) return;
    const directKey = direct.trim() ? npubToHex(direct.trim()) : "";
    if (directKey && !isValidNpub(direct.trim())) {
      setError("有効なユーザーIDを入力してください。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const accepted = applications.filter((a) =>
        approved.has(a.applicantPubkey),
      );
      const keys = calculateNextModeratorPubkeys(
        discussion.moderators.map((m) => m.pubkey),
        [...approved],
        directKey ? [directKey] : [],
        [...removed],
      );
      const draft = gateway.createModeratorUpdateDraft({
        discussionEvent: discussion.event,
        moderatorPubkeys: keys,
        actorPubkey: user.pubkey,
        createdAt: calculateModeratorUpdateTimestamp(
          discussion.event.created_at,
          accepted,
        ),
      });
      const signed = await signEvent(
        draft as unknown as Record<string, unknown>,
      );
      if (!(await service.publishSignedEvent(signed))) throw new Error();
      setApproved(new Set());
      setRemoved(new Set());
      setDirect("");
      await meta?.reload();
    } catch (error) {
      logger.error(error);
      setError("モデレーター変更の確定に失敗しました。");
    } finally {
      setBusy(false);
    }
  };
  if (!discussion)
    return (
      <div role="status" className="ruby-text">
        会話情報を読み込み中...
      </div>
    );
  return (
    <main className="max-w-2xl space-y-6">
      <ModeratorManagementSection
        moderators={discussion.moderators}
        applications={applications}
        applicationsByPubkey={applicationsByPubkey}
        isCreator={isCreator}
        approvedPubkeys={approved}
        removedPubkeys={removed}
        onToggleApproval={(key) => toggle(approved, setApproved, key)}
        onToggleRemoval={(key) => toggle(removed, setRemoved, key)}
      />
      {error && (
        <p role="alert" className="text-error ruby-text">
          {error}
        </p>
      )}
      {isCreator ? (
        <section className="card border border-base-300 bg-base-100">
          <div className="card-body space-y-3">
            <label className="label ruby-text" htmlFor="direct-moderator">
              <span className="label-text">モデレーターを直接追加</span>
            </label>
            <input
              id="direct-moderator"
              className="input input-bordered w-full"
              value={direct}
              onChange={(event) => setDirect(event.target.value)}
              placeholder="npub1..."
              disabled={busy}
            />
            <p role="status" className="ruby-text">
              許可予定 {approved.size}名・削除予定 {removed.size}名
            </p>
            <button
              className="btn btn-primary min-h-[44px] rounded-full dark:rounded-sm self-start"
              onClick={confirm}
              disabled={
                busy || (!approved.size && !removed.size && !direct.trim())
              }
            >
              <span className="ruby-text">変更を確定</span>
            </button>
          </div>
        </section>
      ) : !user.isLoggedIn ? (
        <section className="card border border-base-300 bg-base-100">
          <div className="card-body space-y-3">
            <p className="ruby-text">
              モデレーターに申請するにはログインが必要です。
            </p>
            <button
              className="btn btn-primary min-h-[44px] rounded-full dark:rounded-sm self-start ml-12 sm:ml-0"
              onClick={() => setShowLogin(true)}
            >
              <span className="ruby-text">ログイン</span>
            </button>
          </div>
        </section>
      ) : isPending ? (
        <p className="ruby-text">あなたはモデレーターに申請中です。</p>
      ) : isModerator ? (
        <p className="ruby-text">あなたはこの会話のモデレーターです。</p>
      ) : (
        <section className="card border border-base-300 bg-base-100">
          <div className="card-body space-y-3">
            <label htmlFor="reason" className="label ruby-text">
              <span className="label-text">モデレーターに申請</span>
            </label>
            <textarea
              id="reason"
              className="textarea textarea-bordered w-full"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="申請理由（任意）"
              disabled={busy}
            />
            <button
              className="btn btn-primary min-h-[44px] rounded-full dark:rounded-sm self-start"
              onClick={request}
              disabled={busy}
            >
              <span className="ruby-text">申請する</span>
            </button>
          </div>
        </section>
      )}
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </main>
  );
}
