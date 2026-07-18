"use client";
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
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
import {
  formatBip39JapaneseMnemonicPreviewFromPubkey,
} from "@/lib/nostr/mnemonic-utils";
import { logger } from "@/utils/logger";
import { NpubDisplay } from "@/components/ui/NpubDisplay";
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
    [directModerators, setDirectModerators] = useState<string[]>([]),
    [directError, setDirectError] = useState(""),
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
      await meta?.reload();
    } catch (error) {
      logger.error(error);
      setError("モデレーター変更の確定に失敗しました。");
    } finally {
      setBusy(false);
    }
  };
  if (!discussion && meta?.isLoading !== false)
    return (
      <div role="status">
        <span className="ruby-text">会話情報を読み込み中...</span>
      </div>
    );
  if (!discussion)
    return (
      <div className="alert alert-error" role="alert">
        <span className="ruby-text">
          {meta?.error ?? "会話情報が見つかりませんでした。"}
        </span>
        <button
          type="button"
          className="btn btn-outline min-h-[44px] rounded-full dark:rounded-sm"
          onClick={() => void meta?.reload()}
        >
          <span className="ruby-text">再読み込み</span>
        </button>
      </div>
    );
  return (
    <div className="space-y-6">
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
      {error && (
        <p role="alert" className="text-error ruby-text">
          {error}
        </p>
      )}
      {isCreator ? (
        <>
          <section className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body space-y-4">
              <h2 className="card-title ruby-text">
                <span>モデレーターを追加</span>
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
                      className="btn btn-primary join-item h-11 min-h-[44px]"
                      onClick={addDirectModerator}
                      disabled={busy || !direct.trim()}
                    >
                      <span className="ruby-text">追加</span>
                    </button>
                  </div>
                </div>
              </div>
              {directError && (
                <p
                  id="direct-moderator-error"
                  role="alert"
                  className="text-sm text-error ruby-text"
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
                          className="btn btn-ghost min-h-[44px] shrink-0 rounded-full dark:rounded-sm"
                          onClick={() => removeDirectModerator(pubkey)}
                          disabled={busy}
                        >
                          <span className="ruby-text">取り消す</span>
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
              <h2 className="card-title ruby-text">
                <span>モデレーターの変更を確定</span>
              </h2>
              <button
                className="btn btn-primary min-h-[44px] rounded-full dark:rounded-sm self-start"
                onClick={confirm}
                disabled={
                  busy ||
                  (!approved.size && !removed.size && !directModerators.length)
                }
              >
                <span className="ruby-text">変更を確定</span>
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
              className="btn btn-primary min-h-[44px] rounded-full dark:rounded-sm self-start sm:ml-0"
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
        <section
          id="become-moderator"
          className="card border border-base-300 bg-base-100"
        >
          <div className="card-body space-y-3">
            <h2 className="card-title ruby-text">
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
    </div>
  );
}
