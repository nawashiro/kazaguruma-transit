"use client";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { useDiscussionManagement } from "@/components/discussion/DiscussionManagementProvider";
import { ModeratorManagementSection } from "@/components/discussion/ModeratorManagementSection";
import { buildLoginRoute } from "@/lib/navigation/auth-route";
import { createNostrService, type Event } from "@/lib/nostr/nostr-service";
import { createDiscussionNdkGateway } from "@/lib/nostr/discussion-ndk-gateway";
import {
  getNostrServiceConfig,
} from "@/lib/config/discussion-config";
import { createModeratorPromotionRequestEvent } from "@/lib/discussion/user-creation-flow";
import {
  calculateModeratorUpdateTimestamp,
  calculateNextModeratorPubkeys,
  deriveLatestModeratorApplications,
  derivePendingModeratorApplications,
} from "@/lib/discussion/moderator-application-state";
import { isValidNpub, npubToHex } from "@/lib/nostr/nostr-utils";
import {
  formatBip39JapaneseMnemonicPreviewFromPubkey,
} from "@/lib/nostr/mnemonic-utils";
import { logger } from "@/utils/logger";
import { NpubDisplay } from "@/components/ui/NpubDisplay";
const config = getNostrServiceConfig();
const service = createNostrService(config);
const gateway = createDiscussionNdkGateway(config);
const PUBLIC_MODERATOR_ROUTE = "/discussions/moderator";

export default function DiscussionManagementModeratorPage() {
  const router = useRouter();
  const { user, signEvent } = useAuth();
  const management = useDiscussionManagement();
  const managementDiscussion = management.snapshot?.listDiscussion;
  const discussion = useMemo(
    () =>
      managementDiscussion
        ? {
            ...managementDiscussion,
            moderators: managementDiscussion.moderators ?? [],
          }
        : null,
    [managementDiscussion],
  );
  const [localEvents, setLocalEvents] = useState<Event[]>([]),
    [reason, setReason] = useState(""),
    [approved, setApproved] = useState(new Set<string>()),
    [removed, setRemoved] = useState(new Set<string>()),
    [direct, setDirect] = useState(""),
    [directModerators, setDirectModerators] = useState<string[]>([]),
    [directError, setDirectError] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const events = useMemo(() => {
    const snapshotEvents = management.snapshot?.moderatorRequests?.map(
      (request) => request.event,
    ) ?? [];
    const byId = new Map<string, Event>();
    [...snapshotEvents, ...localEvents].forEach((event) => byId.set(event.id, event));
    return Array.from(byId.values());
  }, [localEvents, management.snapshot?.moderatorRequests]);
  const applicationReadState: "loading" | "eose" | "partial" =
    management.state === "loading"
      ? "loading"
      : management.state === "ready"
        ? "eose"
        : "partial";
  const reload = management.reload;
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
    change: Dispatch<SetStateAction<Set<string>>>,
    key: string,
  ) => {
    change((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };
  const request = async () => {
    if (!user.isLoggedIn) {
      router.push(
        buildLoginRoute(PUBLIC_MODERATOR_ROUTE),
      );
      return;
    }
    if (!discussion || !user.pubkey) {
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
      setLocalEvents((old) => [signed as Event, ...old]);
      setReason("");
    } catch {
      setError("モデレーター申請の送信に失敗しました。");
    } finally {
      setBusy(false);
    }
  };
  const addDirectModerator = () => {
    const input = direct.trim();
    if (!isValidNpub(input)) {
      setDirectError("有効なユーザーIDを入力してください。");
      return;
    }

    const pubkey = npubToHex(input);
    const isAlreadyModerator = discussion?.moderators.some(
      (moderator) => moderator.pubkey === pubkey,
    );
    if (isAlreadyModerator || directModerators.includes(pubkey)) {
      setDirectError("そのユーザーはすでに追加予定です。");
      return;
    }

    setDirectModerators((current) => [...current, pubkey]);
    setDirect("");
    setDirectError("");
  };
  const removeDirectModerator = (pubkey: string) => {
    setDirectModerators((current) =>
      current.filter((candidate) => candidate !== pubkey),
    );
  };
  const confirm = async () => {
    if (!discussion || !user.pubkey) return;
    setBusy(true);
    setError("");
    try {
      const accepted = applications.filter((a) =>
        approved.has(a.applicantPubkey),
      );
      const keys = calculateNextModeratorPubkeys(
        discussion.moderators.map((m) => m.pubkey),
        [...approved],
        directModerators,
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
      setDirectModerators([]);
      setDirect("");
      setDirectError("");
      await reload();
    } catch (error) {
      logger.error(error);
      setError("モデレーター変更の確定に失敗しました。");
    } finally {
      setBusy(false);
    }
  };
  if (!discussion && applicationReadState === "loading")
    return (
      <div role="status">
        <p className="ruby-text">会話情報を読み込み中...</p>
      </div>
    );
  if (!discussion) {
    const completionReason = management.completionReason;
    const isPartial = management.state === "partial" ||
      management.state === "error" ||
      completionReason === "idle-timeout" ||
      completionReason === "hard-timeout" ||
      completionReason === "cancelled";
    return (
      <div
        className={
          isPartial
            ? "alert alert-warning alert-soft text-base-content!"
            : "alert alert-error alert-soft text-base-content!"
        }
        role="status"
        aria-live="polite"
      >
        <p className="ruby-text">
          {isPartial
            ? `会話データの取得に時間がかかっています（${completionReason ?? "unknown"}）。受信待機中または relay 応答遅延の可能性があります。`
            : management.error ?? "会話情報が見つかりませんでした。"}
        </p>
        <button
          type="button"
          className="btn text-base btn-outline ruby-text gap-0 min-h-[44px] rounded-full dark:rounded-sm"
          onClick={() => void reload()}
        >
          再読み込み
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {applicationReadState === "eose" ? (
        <ModeratorManagementSection
          moderators={discussion.moderators}
          applications={applications}
          applicationsByPubkey={applicationsByPubkey}
          isCreator={isCreator}
          approvedPubkeys={approved}
          removedPubkeys={removed}
          onToggleApproval={(key) => toggle(setApproved, key)}
          onToggleRemoval={(key) => toggle(setRemoved, key)}
        />
      ) : applicationReadState === "partial" ? (
        <div
          className="alert alert-warning alert-soft text-base-content!"
          role="status"
          aria-live="polite"
          aria-label="モデレーター申請の取得は完了していません"
        >
          <p className="ruby-text">
            モデレーター申請の取得が完了していないため、申請がないとは断定できません。
          </p>
        </div>
      ) : (
        <div role="status">
          <p className="ruby-text">モデレーター申請を読み込み中...</p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-base-content ruby-text">
          {error}
        </p>
      )}
      {isCreator ? (
        <>
          <section className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body space-y-4">
              <h2 className="card-title inline ruby-text gap-0">
                モデレーターを追加
              </h2>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="label" htmlFor="direct-moderator">
                    <span className="label-text font-medium ruby-text">
                      ユーザーID
                    </span>
                  </label>
                  <div className="join w-full">
                    <input
                      id="direct-moderator"
                      className="input join-item h-11 min-h-[44px] flex-1"
                      value={direct}
                      onChange={(event) => {
                        setDirect(event.target.value);
                        setDirectError("");
                      }}
                      placeholder="npub1..."
                      disabled={busy}
                      aria-invalid={Boolean(directError)}
                      aria-describedby="direct-moderator-error"
                    />
                    <button
                      className="btn text-base btn-primary ruby-text gap-0 join-item h-11 min-h-[44px]"
                      onClick={addDirectModerator}
                      disabled={busy || !direct.trim()}
                    >
                      追加
                    </button>
                  </div>
                </div>
              </div>
              {directError && (
                <p
                  id="direct-moderator-error"
                  role="alert"
                  className="text-base text-base-content ruby-text"
                >
                  {directError}
                </p>
              )}
              {directModerators.length > 0 && (
                <div>
                  <h3 className="label-text font-medium ruby-text">
                    追加予定のユーザー
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {directModerators.map((pubkey) => (
                      <li
                        key={pubkey}
                        className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-base-200 p-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium break-words ruby-text">
                            {formatBip39JapaneseMnemonicPreviewFromPubkey(
                              pubkey,
                            )}
                          </p>
                          <NpubDisplay pubkey={pubkey} />
                        </div>
                        <button
                          type="button"
                          className="btn text-base btn-ghost ruby-text gap-0 min-h-[44px] shrink-0 rounded-full dark:rounded-sm"
                          onClick={() => removeDirectModerator(pubkey)}
                          disabled={busy}
                        >
                          取り消す
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
          <section className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body space-y-4">
              <h2 className="card-title inline ruby-text gap-0">
                モデレーターの変更を確定
              </h2>
              <button
                className="btn text-base btn-primary ruby-text gap-0 min-h-[44px] rounded-full dark:rounded-sm self-start"
                onClick={confirm}
                disabled={
                  busy ||
                  (!approved.size && !removed.size && !directModerators.length)
                }
              >
                変更を確定
              </button>
            </div>
          </section>
        </>
      ) : !user.isLoggedIn ? (
        <section
          id="become-moderator"
          className="card border border-base-300 bg-base-100"
        >
          <div className="card-body space-y-3">
            <p className="ruby-text">
              モデレーターに申請するにはログインが必要です。
            </p>
            <button
              className="btn text-base btn-primary ruby-text gap-0 min-h-[44px] rounded-full dark:rounded-sm self-start sm:ml-0"
              onClick={() =>
                router.push(
                  buildLoginRoute(PUBLIC_MODERATOR_ROUTE),
                )
              }
            >
              ログイン
            </button>
          </div>
        </section>
      ) : isPending ? (
        <p className="ruby-text">あなたはモデレーターに申請中です。</p>
      ) : isModerator ? (
        <p className="ruby-text">あなたはこの会話のモデレーターです。</p>
      ) : (
        <section
          id="become-moderator"
          className="card border border-base-300 bg-base-100"
        >
          <div className="card-body space-y-3">
            <h2 className="card-title inline ruby-text gap-0">
              <span className="label-text">モデレーターになる</span>
            </h2>
            <p className="text-base ruby-text">投稿の承認を行う場合、会話作成者にモデレーターになりたい旨を申請してください。</p>
            <textarea
              id="reason"
              className="textarea w-full"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="申請理由（任意）"
              disabled={busy}
            />
            <button
              className="btn text-base btn-primary ruby-text gap-0 min-h-[44px] rounded-full dark:rounded-sm self-start"
              onClick={request}
              disabled={busy}
            >
              申請する
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
