import type { NostrEventDTO } from "@/lib/nostr/discussion-ndk-gateway";
import { formatBip39JapaneseMnemonicPreviewFromPubkey } from "@/lib/nostr/mnemonic-utils";

export type ListAuditType = "listing-requested" | "promotion-requested";
export type DiscussionAuditType = "post-submitted" | "promotion-requested";

export interface AuditTimelineDTO {
  id: string;
  type: ListAuditType | DiscussionAuditType;
  actorPubkey: string;
  actorMnemonic: string;
  timestamp: number;
  targetRef?: string;
  approvalState: "unapproved" | "approved";
  approvedByPubkey?: string;
  approvedByMnemonic?: string;
}

const getTagValue = (event: NostrEventDTO, key: string): string | undefined =>
  event.tags.find((tag) => tag[0] === key)?.[1];

const isModeratorRequest = (event: NostrEventDTO): boolean =>
  event.kind === 1111 &&
  event.tags.some((tag) => tag[0] === "t" && tag[1] === "moderator-request");

const isListingRequest = (event: NostrEventDTO): boolean =>
  event.kind === 1111 && event.tags.some((tag) => tag[0] === "q");

const isPostSubmitted = (event: NostrEventDTO): boolean =>
  event.kind === 1111 &&
  event.tags.some((tag) => tag[0] === "a") &&
  !isModeratorRequest(event);

const approvalsByTarget = (events: NostrEventDTO[]): Map<string, NostrEventDTO> => {
  const map = new Map<string, NostrEventDTO>();
  for (const event of events) {
    if (event.kind !== 4550) continue;
    const targets = [getTagValue(event, "e"), getTagValue(event, "a")].filter(
      (target): target is string => Boolean(target)
    );
    if (targets.length === 0) continue;
    for (const target of targets) {
      const existing = map.get(target);
      if (!existing || event.created_at >= existing.created_at) {
        map.set(target, event);
      }
    }
  }
  return map;
};

const resolveApproval = (
  event: NostrEventDTO,
  approvals: Map<string, NostrEventDTO>
): NostrEventDTO | undefined => {
  // 投稿・申請イベントの承認は対象イベントID(e)で表現されることがあるため優先する
  const byEventId = approvals.get(event.id);
  if (byEventId) return byEventId;

  const byRef =
    approvals.get(getTagValue(event, "e") ?? "") ??
    approvals.get(getTagValue(event, "a") ?? "");
  return byRef;
};

const toDto = (
  event: NostrEventDTO,
  type: ListAuditType | DiscussionAuditType,
  approval?: NostrEventDTO
): AuditTimelineDTO => ({
  id: event.id,
  type,
  actorPubkey: event.pubkey,
  actorMnemonic: formatBip39JapaneseMnemonicPreviewFromPubkey(event.pubkey),
  timestamp: event.created_at,
  targetRef: getTagValue(event, "e") ?? getTagValue(event, "a"),
  approvalState: approval ? "approved" : "unapproved",
  approvedByPubkey: approval?.pubkey,
  approvedByMnemonic: approval
    ? formatBip39JapaneseMnemonicPreviewFromPubkey(approval.pubkey)
    : undefined,
});

export function mapListAuditTimeline(events: NostrEventDTO[]): AuditTimelineDTO[] {
  const approvals = approvalsByTarget(events);
  return events
    .filter((event) => isListingRequest(event) || isModeratorRequest(event))
    .map((event) => {
      const approval = resolveApproval(event, approvals);
      return toDto(
        event,
        isModeratorRequest(event) ? "promotion-requested" : "listing-requested",
        approval
      );
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function mapDiscussionAuditTimeline(
  events: NostrEventDTO[]
): AuditTimelineDTO[] {
  const approvals = approvalsByTarget(events);
  return events
    .filter((event) => isPostSubmitted(event) || isModeratorRequest(event))
    .map((event) => {
      const approval = resolveApproval(event, approvals);
      return toDto(
        event,
        isModeratorRequest(event) ? "promotion-requested" : "post-submitted",
        approval
      );
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}
