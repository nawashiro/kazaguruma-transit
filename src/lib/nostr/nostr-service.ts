import NDK, {
  NDKEvent,
  NDKPrivateKeySigner,
  NDKRelaySet,
  type NDKFilter,
  type NostrEvent,
} from "@nostr-dev-kit/ndk";
import type { PWKBlob } from "nosskey-sdk";
import { logger } from "@/utils/logger";
import { normalizeDiscussionId } from "@/lib/nostr/naddr-utils";

export type Event = NostrEvent & { id: string; sig: string; kind: number };
export type Filter = NDKFilter<number>;
export type CompletionReason =
  | "eose"
  | "idle-timeout"
  | "hard-timeout"
  | "cancelled";

export interface EventFetchCompletion {
  events: Event[];
  completionReason: CompletionReason;
  eventCount: number;
  elapsedMs: number;
  startedAt: number;
  lastEventAt: number;
  eoseReceived: boolean;
  relayUrls: string[];
  duplicateCount: number;
  /** Relay URLs that delivered each event, including duplicate deliveries. */
  sourceRelayUrlsByEventId: Record<string, string[]>;
}

const getSourceRelayUrl = (event: NDKEvent): string | null => {
  const relay = (event as NDKEvent & { relay?: { url?: unknown } }).relay;
  return typeof relay?.url === "string" ? relay.url : null;
};

export interface ReadEventsOptions {
  idleTimeoutMs?: number;
  hardTimeoutMs?: number;
  relayUrls?: string[];
}

export const dedupeAndSortEvents = (events: Event[]): Event[] => {
  const uniqueById = new Map<string, Event>();

  events.forEach((event) => {
    const existing = uniqueById.get(event.id);
    if (!existing || event.created_at > existing.created_at) {
      uniqueById.set(event.id, event);
    }
  });

  return Array.from(uniqueById.values()).sort(
    (a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id)
  );
};

const mergeEvent = (current: Event[], incoming: Event): Event[] => {
  if (current.some((event) => event.id === incoming.id)) {
    return current;
  }

  return dedupeAndSortEvents([...current, incoming]);
};

const normalizeDiscussionIdForRead = (discussionId: string): string | null => {
  try {
    return normalizeDiscussionId(discussionId);
  } catch (error) {
    logger.error("Invalid discussion id:", error);
    return null;
  }
};

export interface NostrRelayConfig {
  url: string;
  read: boolean;
  write: boolean;
}

export interface NostrServiceConfig {
  relays: NostrRelayConfig[];
  defaultTimeout: number;
}

export interface StreamEventsOptions {
  onEvent: (events: Event[], event: Event) => void;
  onEose?: (events: Event[]) => void;
  timeoutMs?: number;
  relayUrls?: string[];
}

export class NostrService {
  private ndk: NDK;
  private relays: string[];
  private writeRelays: string[];
  private config: NostrServiceConfig;
  private connectPromise?: Promise<void>;
  private readonly pendingReads = new Map<string, Promise<EventFetchCompletion>>();

  constructor(config: NostrServiceConfig) {
    this.config = config;
    this.relays = config.relays
      .filter((relay) => relay.read)
      .map((relay) => relay.url);
    this.writeRelays = config.relays
      .filter((relay) => relay.write)
      .map((relay) => relay.url);
    this.ndk = new NDK({
      explicitRelayUrls: Array.from(
        new Set([...this.relays, ...this.writeRelays])
      ),
      autoConnectUserRelays: false,
    });
  }

  private toRawEvent(event: NDKEvent): Event {
    const raw = event.rawEvent();
    return {
      ...raw,
      kind: Number(raw.kind),
    };
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connectPromise) {
      this.connectPromise = this.ndk.connect(this.config.defaultTimeout).catch(
        (error) => {
          this.connectPromise = undefined;
          throw error;
        }
      );
    }
    await this.connectPromise;
  }

  private collectEventsWithCompletion(
    filters: Filter[],
    options: ReadEventsOptions = {}
  ): Promise<EventFetchCompletion> {
    if (filters.length === 0) {
      const now = Date.now();
      return Promise.resolve({
        events: [],
        completionReason: "eose",
        eventCount: 0,
        elapsedMs: 0,
        startedAt: now,
        lastEventAt: now,
        eoseReceived: true,
        relayUrls: [],
        duplicateCount: 0,
        sourceRelayUrlsByEventId: {},
      });
    }

    const idleTimeoutMs = options.idleTimeoutMs ?? this.config.defaultTimeout;
    const hardTimeoutMs = Math.max(
      options.hardTimeoutMs ?? this.config.defaultTimeout * 3,
      idleTimeoutMs + 1
    );
    const relayUrls = Array.from(new Set(options.relayUrls ?? this.relays));
    const relaySet = relayUrls.length > 0
      && options.relayUrls
      ? NDKRelaySet.fromRelayUrls(relayUrls, this.ndk)
      : undefined;

    return new Promise((resolve) => {
      const startedAt = Date.now();
      let lastEventAt = startedAt;
      let closed = false;
      let eoseCount = 0;
      let eoseReceived = false;
      let duplicateCount = 0;
      const collected: Event[] = [];
      const sourceRelayUrlsByEventId = new Map<string, Set<string>>();
      const subscriptions: Array<{ stop: () => void }> = [];
      const timerRefs: {
        idle?: ReturnType<typeof setTimeout>;
        hard?: ReturnType<typeof setTimeout>;
      } = {};

      const closeSubscriptions = () => {
        subscriptions.forEach((subscription) => subscription.stop());
      };

      const finalize = (completionReason: CompletionReason) => {
        if (closed) return;
        closed = true;
        if (timerRefs.idle) clearTimeout(timerRefs.idle);
        if (timerRefs.hard) clearTimeout(timerRefs.hard);
        closeSubscriptions();

        const events = dedupeAndSortEvents(collected);
        const sourceRelays = Object.fromEntries(
          Array.from(sourceRelayUrlsByEventId, ([eventId, urls]) => [
            eventId,
            Array.from(urls).sort(),
          ])
        );
        logger.info("nostr read completed", {
          eventCount: events.length,
          duplicateCount,
          completionReason,
          elapsedMs: Date.now() - startedAt,
          relayCount: relayUrls.length,
        });
        resolve({
          events,
          completionReason,
          eventCount: events.length,
          elapsedMs: Date.now() - startedAt,
          startedAt,
          lastEventAt,
          eoseReceived,
          relayUrls,
          duplicateCount,
          sourceRelayUrlsByEventId: sourceRelays,
        });
      };

      const resetIdleTimer = () => {
        if (timerRefs.idle) clearTimeout(timerRefs.idle);
        timerRefs.idle = setTimeout(() => finalize("idle-timeout"), idleTimeoutMs);
      };

      timerRefs.hard = setTimeout(() => finalize("hard-timeout"), hardTimeoutMs);
      resetIdleTimer();

      for (const filter of filters) {
        const subscription = this.ndk.subscribe(
          filter,
          {
            closeOnEose: true,
            onEvent: (event) => {
              if (closed) return;

              lastEventAt = Date.now();
              resetIdleTimer();

              const rawEvent = this.toRawEvent(event);
              const sourceRelayUrl = getSourceRelayUrl(event);
              if (sourceRelayUrl) {
                const sources = sourceRelayUrlsByEventId.get(rawEvent.id) ?? new Set<string>();
                sources.add(sourceRelayUrl);
                sourceRelayUrlsByEventId.set(rawEvent.id, sources);
              }
              const updated = mergeEvent(collected, rawEvent);
              if (updated === collected) {
                duplicateCount += 1;
                return;
              }

              collected.length = 0;
              collected.push(...updated);
            },
            onEose: () => {
              if (closed) return;
              eoseCount += 1;
              if (eoseCount >= filters.length) {
                eoseReceived = true;
                finalize("eose");
              }
            },
          },
          relaySet ?? true
        );
        subscriptions.push(subscription);
      }

      this.ensureConnected().catch((error) => {
        logger.error("Failed to connect before reading events:", error);
        finalize("hard-timeout");
      });
    });
  }

  async getEventsWithCompletion(
    filters: Filter[],
    options: ReadEventsOptions = {}
  ): Promise<EventFetchCompletion> {
    const readKey = JSON.stringify({ filters, options });
    const existingRead = this.pendingReads.get(readKey);
    if (existingRead) return existingRead;

    const readPromise = this.readEventsWithCompletion(filters, options);
    this.pendingReads.set(readKey, readPromise);
    try {
      return await readPromise;
    } finally {
      this.pendingReads.delete(readKey);
    }
  }

  private async readEventsWithCompletion(
    filters: Filter[],
    options: ReadEventsOptions = {}
  ): Promise<EventFetchCompletion> {
    try {
      await this.ensureConnected();
      return await this.collectEventsWithCompletion(filters, options);
    } catch (error) {
      logger.error("Failed to get events with completion:", error);
      const now = Date.now();
      return {
        events: [],
        completionReason: "hard-timeout",
        eventCount: 0,
        elapsedMs: 0,
        startedAt: now,
        lastEventAt: now,
        eoseReceived: false,
        relayUrls: options.relayUrls ?? this.relays,
        duplicateCount: 0,
        sourceRelayUrlsByEventId: {},
      };
    }
  }

  async getEventsOnEose(filters: Filter[]): Promise<Event[]> {
    try {
      const { events } = await this.getEventsWithCompletion(filters);
      return events;
    } catch (error) {
      logger.error("Failed to get events:", error);
      return [];
    }
  }

  async getEvents(filters: Filter[]): Promise<Event[]> {
    return this.getEventsOnEose(filters);
  }

  streamEventsOnEvent(
    filters: Filter[],
    { onEvent, onEose, timeoutMs, relayUrls }: StreamEventsOptions
  ): () => void {
    if (filters.length === 0) {
      onEose?.([]);
      return () => {};
    }

    const collected: Event[] = [];
    let closed = false;
    let eoseCount = 0;
    const timeoutRef: { id?: ReturnType<typeof setTimeout> } = {};
    const subscriptions: Array<{ stop: () => void }> = [];
    const relaySet = relayUrls && relayUrls.length > 0
      ? NDKRelaySet.fromRelayUrls(relayUrls, this.ndk)
      : undefined;

    const closeSubscriptions = () => {
      subscriptions.forEach((subscription) => subscription.stop());
    };

    const finalize = () => {
      if (closed) return;
      closed = true;
      if (timeoutRef.id) {
        clearTimeout(timeoutRef.id);
      }
      closeSubscriptions();
      onEose?.(dedupeAndSortEvents(collected));
    };

    for (const filter of filters) {
      const subscription = this.ndk.subscribe(
        filter,
        {
          closeOnEose: true,
          onEvent: (event) => {
            if (closed) return;

            const rawEvent = this.toRawEvent(event);
            const updated = mergeEvent(collected, rawEvent);
            if (updated === collected) return;

            collected.length = 0;
            collected.push(...updated);
            onEvent([...collected], rawEvent);
          },
          onEose: () => {
            if (closed) return;
            eoseCount += 1;
            if (eoseCount >= filters.length) {
              finalize();
            }
          },
        },
        relaySet ?? true
      );
      subscriptions.push(subscription);
    }

    this.ensureConnected().catch((error) => {
      logger.error("Failed to connect before streaming:", error);
      finalize();
    });

    timeoutRef.id = setTimeout(() => {
      finalize();
    }, timeoutMs ?? this.config.defaultTimeout);

    return () => {
      finalize();
    };
  }

  async subscribeToEvents(
    filters: Filter[],
    onEvent: (event: Event) => void,
    onEose?: () => void
  ): Promise<() => void> {
    if (filters.length === 0) {
      onEose?.();
      return () => {};
    }

    let closed = false;
    let eoseCount = 0;
    const subscriptions = filters.map((filter) =>
      this.ndk.subscribe(
        filter,
        {
          closeOnEose: true,
          onEvent: (event) => onEvent(this.toRawEvent(event)),
          onEose: () => {
            if (closed) return;
            eoseCount += 1;
            if (eoseCount >= filters.length) {
              onEose?.();
            }
          },
        },
        true
      )
    );

    this.ensureConnected().catch((error) => {
      logger.error("Failed to connect before subscribeToEvents:", error);
      onEose?.();
    });

    return () => {
      if (closed) return;
      closed = true;
      subscriptions.forEach((subscription) => subscription.stop());
    };
  }

  async publishEvent(
    event: Omit<Event, "id" | "sig" | "pubkey">,
    secretKey: Uint8Array
  ): Promise<boolean> {
    try {
      await this.ensureConnected();
      const signer = new NDKPrivateKeySigner(Buffer.from(secretKey).toString("hex"));
      const ndkEvent = new NDKEvent(this.ndk, {
        ...event,
        pubkey: signer.pubkey,
      });
      await ndkEvent.sign(signer);
      const publishedToRelays = await ndkEvent.publish(
        undefined,
        this.config.defaultTimeout
      );
      return publishedToRelays.size > 0;
    } catch (error) {
      logger.error("Failed to publish event:", error);
      return false;
    }
  }

  async publishSignedEvent(signedEvent: Event): Promise<boolean> {
    try {
      await this.ensureConnected();
      const ndkEvent = new NDKEvent(this.ndk, signedEvent);
      const publishedToRelays = await ndkEvent.publish(
        undefined,
        this.config.defaultTimeout
      );
      return publishedToRelays.size > 0;
    } catch (error) {
      logger.error("Failed to publish signed event:", error);
      return false;
    }
  }

  async getProfile(pubkeys: string[]): Promise<Event[]> {
    const events = await this.getEvents([
      {
        kinds: [0],
        authors: pubkeys,
      },
    ]);

    return events;
  }

  async getDiscussions(adminPubkey: string): Promise<Event[]> {
    const events = await this.getEvents([
      {
        kinds: [34550],
        authors: [adminPubkey],
      },
    ]);

    // replaceable eventの重複を除去（同じdTagで最新のもののみを保持）
    const eventsByDTag = new Map<string, Event>();

    for (const event of events) {
      const dTag = event.tags.find((tag) => tag[0] === "d")?.[1];
      if (!dTag) continue;

      const existing = eventsByDTag.get(dTag);
      if (!existing || event.created_at > existing.created_at) {
        eventsByDTag.set(dTag, event);
      }
    }

    return Array.from(eventsByDTag.values());
  }

  async getDiscussion(pubkey: string, dTag: string): Promise<Event> {
    const events = await this.getEvents([
      {
        kinds: [34550],
        authors: [pubkey],
        "#d": [dTag],
      },
    ]);

    // replaceable eventの重複を除去（同じdTagで最新のもののみを保持）
    const eventsByDTag = new Map<string, Event>();

    for (const event of events) {
      const dTag = event.tags.find((tag) => tag[0] === "d")?.[1];
      if (!dTag) continue;

      const existing = eventsByDTag.get(dTag);
      if (!existing || event.created_at > existing.created_at) {
        eventsByDTag.set(dTag, event);
      }
    }

    return Array.from(eventsByDTag.values())[0];
  }

  streamDiscussionMeta(
    pubkey: string,
    dTag: string,
    options: StreamEventsOptions
  ): () => void {
    return this.streamEventsOnEvent(
      [
        {
          kinds: [34550],
          authors: [pubkey],
          "#d": [dTag],
          limit: 1,
        },
      ],
      options
    );
  }

  async getDiscussionPosts(
    discussionId: string,
    busStopTags?: string[]
  ): Promise<Event[]> {
    const normalizedDiscussionId = normalizeDiscussionIdForRead(discussionId);
    if (!normalizedDiscussionId) {
      return [];
    }

    const filters: Filter[] = [];

    if (busStopTags && busStopTags.length > 0) {
      // バス停ごとに個別のフィルタを作成（kind:1111とkind:1の両方）
      busStopTags.forEach((busStopTag) => {
        filters.push({
          kinds: [1111, 1],
          "#a": [normalizedDiscussionId],
          "#t": [busStopTag],
        });
      });
    } else {
      // バス停指定なしの場合は全投稿を取得（kind:1111とkind:1の両方）
      filters.push({
        kinds: [1111, 1],
        "#a": [normalizedDiscussionId],
      });
    }

    return this.getEventsOnEose(filters);
  }

  async getApprovalsOnEose(discussionId: string): Promise<Event[]> {
    const normalizedDiscussionId = normalizeDiscussionIdForRead(discussionId);
    if (!normalizedDiscussionId) {
      return [];
    }

    return this.getEventsOnEose([
      {
        kinds: [4550],
        "#a": [normalizedDiscussionId],
      },
    ]);
  }

  async getApprovals(discussionId: string): Promise<Event[]> {
    return this.getApprovalsOnEose(discussionId);
  }

  streamApprovals(
    discussionId: string,
    options: StreamEventsOptions
  ): () => void {
    const normalizedDiscussionId = normalizeDiscussionIdForRead(discussionId);
    if (!normalizedDiscussionId) {
      options.onEose?.([]);
      return () => {};
    }

    return this.streamEventsOnEvent(
      [
        {
          kinds: [4550],
          "#a": [normalizedDiscussionId],
        },
      ],
      options
    );
  }

  async getApprovalsForPosts(
    postIds: string[],
    discussionId: string
  ): Promise<Event[]> {
    if (postIds.length === 0) {
      return [];
    }

    const normalizedDiscussionId = normalizeDiscussionIdForRead(discussionId);
    if (!normalizedDiscussionId) {
      return [];
    }

    return this.getEventsOnEose([
      {
        kinds: [4550],
        "#a": [normalizedDiscussionId],
        "#e": postIds,
      },
    ]);
  }

  streamApprovalsForPosts(
    postIds: string[],
    discussionId: string,
    options: StreamEventsOptions
  ): () => void {
    if (postIds.length === 0) {
      options.onEose?.([]);
      return () => {};
    }

    const normalizedDiscussionId = normalizeDiscussionIdForRead(discussionId);
    if (!normalizedDiscussionId) {
      options.onEose?.([]);
      return () => {};
    }

    return this.streamEventsOnEvent(
      [
        {
          kinds: [4550],
          "#a": [normalizedDiscussionId],
          "#e": postIds,
        },
      ],
      options
    );
  }

  async getEvaluations(
    pubkey: string,
    discussionId?: string
  ): Promise<Event[]> {
    const filters: Filter = {
      kinds: [7],
      authors: [pubkey],
    };

    if (discussionId) {
      const normalizedDiscussionId = normalizeDiscussionIdForRead(discussionId);
      if (!normalizedDiscussionId) {
        return [];
      }
      filters["#a"] = [normalizedDiscussionId];
    }

    return this.getEvents([filters]);
  }

  async getUserEvaluationsForPosts(
    pubkey: string,
    postIds: string[],
    discussionId?: string
  ): Promise<Event[]> {
    if (postIds.length === 0) {
      return [];
    }

    const filters: Filter = {
      kinds: [7],
      authors: [pubkey],
      "#e": postIds,
    };

    if (discussionId) {
      const normalizedDiscussionId = normalizeDiscussionIdForRead(discussionId);
      if (!normalizedDiscussionId) {
        return [];
      }
      filters["#a"] = [normalizedDiscussionId];
    }

    return this.getEvents([filters]);
  }

  async getEvaluationsForPosts(postIds: string[]): Promise<Event[]> {
    if (postIds.length === 0) {
      return [];
    }

    const filter: Filter = {
      kinds: [7],
      "#e": postIds,
    };

    return this.getEvents([filter]);
  }

  async getDiscussionRequests(adminPubkey: string): Promise<Event[]> {
    return this.getEvents([
      {
        kinds: [1],
        "#p": [adminPubkey],
        "#t": ["discussion-request"],
      },
    ]);
  }

  createDiscussionEvent(
    title: string,
    description: string,
    moderators: string[],
    dTag: string
  ): Omit<Event, "id" | "sig" | "pubkey"> {
    const tags: string[][] = [
      ["d", dTag],
      ["name", title],
      ["description", description],
      ...moderators.map((mod) => ["p", mod, "", "moderator"]),
    ];

    return {
      kind: 34550,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: description,
    };
  }

  createPostEvent(
    content: string,
    discussionId: string,
    busStopTag?: string
  ): Omit<Event, "id" | "sig" | "pubkey"> {
    let discussionHexId = discussionId;
    try {
      discussionHexId = normalizeDiscussionId(discussionId);
    } catch (error) {
      logger.error("Failed to normalize discussion id:", error);
      throw new Error(
        `Invalid discussion id: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }

    const tags: string[][] = [["a", discussionHexId]];

    if (busStopTag) {
      tags.push(["t", busStopTag]);
    }

    return {
      kind: 1111,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content,
    };
  }

  createApprovalEvent(
    postEvent: Event,
    discussionId: string
  ): Omit<Event, "id" | "sig" | "pubkey"> {
    let discussionHexId = discussionId;
    try {
      discussionHexId = normalizeDiscussionId(discussionId);
    } catch (error) {
      logger.error("Failed to normalize discussion id:", error);
      throw new Error(
        `Invalid discussion id: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }

    const tags: string[][] = [
      ["a", discussionHexId],
      ["e", postEvent.id],
      ["p", postEvent.pubkey],
      ["k", postEvent.kind.toString()],
    ];

    return {
      kind: 4550,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: JSON.stringify(postEvent),
    };
  }

  createEvaluationEvent(
    targetEventId: string,
    rating: "+" | "-",
    discussionId?: string
  ): Omit<Event, "id" | "sig" | "pubkey"> {
    const tags: string[][] = [["e", targetEventId]];

    if (discussionId) {
      try {
        const discussionHexId = normalizeDiscussionId(discussionId);
        tags.push(["a", discussionHexId]);
      } catch (error) {
        logger.error("Failed to normalize discussion id:", error);
        throw new Error(
          `Invalid discussion id: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    return {
      kind: 7,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: rating,
    };
  }

  createDiscussionRequestEvent(
    title: string,
    description: string,
    adminPubkey: string
  ): Omit<Event, "id" | "sig" | "pubkey"> {
    return {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["p", adminPubkey],
        ["t", "discussion-request"],
        ["subject", title],
      ],
      content: `${description}`,
    };
  }

  createRevocationEvent(
    approvalEventId: string,
    discussionId?: string
  ): Omit<Event, "id" | "sig" | "pubkey"> {
    const tags: string[][] = [["e", approvalEventId]];

    if (discussionId) {
      tags.push(["h", discussionId]);
    }

    return {
      kind: 5,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: "Revoked approval",
    };
  }

  createDeleteEvent(
    targetEventId: string
  ): Omit<Event, "id" | "sig" | "pubkey"> {
    return {
      kind: 5,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["e", targetEventId]],
      content: "delete",
    };
  }

  // spec_v2.md要件: 管理者作成のKind:34550による承認システム
  async getAdminApprovalEvents(
    adminPubkey: string,
    options: { limit?: number; until?: number } = {}
  ): Promise<Event[]> {
    const filter: any = {
      kinds: [34550],
      authors: [adminPubkey],
    };

    if (options.limit) {
      filter.limit = options.limit;
    }
    if (options.until) {
      filter.until = options.until;
    }

    const events = await this.getEvents([filter]);

    // 承認リストのみを取得（qタグを含むもの）
    const approvalEvents = events.filter((event) =>
      event.tags.some((tag) => tag[0] === "q")
    );

    // replaceable eventの重複を除去
    const eventsByDTag = new Map<string, Event>();

    for (const event of approvalEvents) {
      const dTag = event.tags.find((tag) => tag[0] === "d")?.[1];
      if (!dTag) continue;

      const existing = eventsByDTag.get(dTag);
      if (!existing || event.created_at > existing.created_at) {
        eventsByDTag.set(dTag, event);
      }
    }

    return Array.from(eventsByDTag.values());
  }

  // Get single event by hex ID (format: "kind:pubkey:identifier")
  async getEventByNaddr(hexId: string): Promise<Event | null> {
    try {
      const parts = hexId.split(":");
      if (parts.length !== 3) {
        throw new Error("Invalid hex ID format");
      }

      const [kindStr, pubkey, identifier] = parts;
      const kind = parseInt(kindStr, 10);

      if (isNaN(kind)) {
        throw new Error("Invalid kind in hex ID");
      }

      const filter: Filter = {
        kinds: [kind],
        authors: [pubkey],
        "#d": [identifier],
        limit: 1,
      };

      const events = await this.getEvents([filter]);
      return events.length > 0 ? events[0] : null;
    } catch (error) {
      logger.error("Failed to get event by naddr:", error);
      return null;
    }
  }

  // Get profiles for multiple pubkeys
  async getProfiles(
    pubkeys: string[]
  ): Promise<Record<string, { name?: string; display_name?: string }>> {
    try {
      if (pubkeys.length === 0) {
        return {};
      }

      const filter: Filter = {
        kinds: [0], // Profile events
        authors: pubkeys,
        limit: pubkeys.length,
      };

      const events = await this.getEvents([filter]);
      const profiles: Record<string, { name?: string; display_name?: string }> =
        {};

      events.forEach((event) => {
        try {
          const content = JSON.parse(event.content);
          profiles[event.pubkey] = {
            name: content.name,
            display_name: content.display_name,
          };
        } catch (error) {
          logger.error("Failed to parse profile content:", error);
        }
      });

      return profiles;
    } catch (error) {
      logger.error("Failed to get profiles:", error);
      return {};
    }
  }

  // spec_v2.md要件: 引用されたユーザー作成Kind:34550の取得
  async getReferencedUserDiscussions(references: string[]): Promise<Event[]> {
    if (references.length === 0) {
      return [];
    }

    // 引用形式: "34550:pubkey:dTag" を解析
    const filters: Filter[] = [];

    for (const ref of references) {
      const parts = ref.split(":");
      if (parts.length === 3 && parts[0] === "34550") {
        const [, pubkey, dTag] = parts;
        filters.push({
          kinds: [34550],
          authors: [pubkey],
          "#d": [dTag],
          limit: 1,
        });
      }
    }

    if (filters.length === 0) {
      return [];
    }

    const events = await this.getEvents(filters);

    // 最新のreplaceable eventのみを保持
    const eventsByRef = new Map<string, Event>();

    for (const event of events) {
      const dTag = event.tags.find((tag) => tag[0] === "d")?.[1];
      if (!dTag) continue;

      const ref = `34550:${event.pubkey}:${dTag}`;
      const existing = eventsByRef.get(ref);
      if (!existing || event.created_at > existing.created_at) {
        eventsByRef.set(ref, event);
      }
    }

    return Array.from(eventsByRef.values());
  }

  streamReferencedUserDiscussions(
    references: string[],
    options: StreamEventsOptions
  ): () => void {
    if (references.length === 0) {
      options.onEose?.([]);
      return () => {};
    }

    const filters: Filter[] = [];

    for (const ref of references) {
      const parts = ref.split(":");
      if (parts.length === 3 && parts[0] === "34550") {
        const [, pubkey, dTag] = parts;
        filters.push({
          kinds: [34550],
          authors: [pubkey],
          "#d": [dTag],
          limit: 1,
        });
      }
    }

    if (filters.length === 0) {
      options.onEose?.([]);
      return () => {};
    }

    return this.streamEventsOnEvent(filters, options);
  }

  // spec_v2.md要件: NIP-72承認システムでの承認済みユーザー会話取得
  async getApprovedUserDiscussions(
    adminPubkey: string,
    options: { limit?: number; until?: number } = {}
  ): Promise<
    {
      userDiscussion: Event;
      approvalEvent: Event;
      approvedAt: number;
    }[]
  > {
    try {
      // 1. 管理者の承認イベントを取得（ページネーション対応）
      const approvalEvents = await this.getAdminApprovalEvents(
        adminPubkey,
        options
      );

      // 2. すべてのqタグから引用を抽出
      const allReferences: string[] = [];
      const approvalMap = new Map<string, Event>();

      for (const approvalEvent of approvalEvents) {
        const qTags = approvalEvent.tags.filter((tag) => tag[0] === "q");
        for (const qTag of qTags) {
          if (qTag[1]) {
            allReferences.push(qTag[1]);
            approvalMap.set(qTag[1], approvalEvent);
          }
        }
      }

      // 3. 引用されたユーザー会話を取得
      const userDiscussions = await this.getReferencedUserDiscussions(
        allReferences
      );

      // 4. 承認情報と組み合わせ
      const result: {
        userDiscussion: Event;
        approvalEvent: Event;
        approvedAt: number;
      }[] = [];

      for (const userDiscussion of userDiscussions) {
        const dTag = userDiscussion.tags.find((tag) => tag[0] === "d")?.[1];
        if (!dTag) continue;

        const ref = `34550:${userDiscussion.pubkey}:${dTag}`;
        const approvalEvent = approvalMap.get(ref);

        if (approvalEvent) {
          result.push({
            userDiscussion,
            approvalEvent,
            approvedAt: approvalEvent.created_at,
          });
        }
      }

      // 承認日時順にソート
      return result.sort((a, b) => b.approvedAt - a.approvedAt);
    } catch (error) {
      logger.error("Failed to get approved user discussions:", error);
      return [];
    }
  }

  // NIP-72 compliant: Get community posts to discussion list
  async getCommunityPostsToDiscussionList(
    discussionListNaddr: string,
    options: { limit?: number; until?: number } = {}
  ): Promise<Event[]> {
    try {
      // Convert naddr to hex format for NIP-72 compliance
      let discussionListHex = discussionListNaddr;
      try {
        discussionListHex = normalizeDiscussionId(discussionListNaddr);
      } catch (error) {
        logger.error("Failed to normalize discussion list id:", error);
        throw new Error(
          `Invalid discussion list id: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }

      const filters: Filter[] = [
        {
          kinds: [1111], // NIP-72 community posts
          "#a": [discussionListHex], // Discussion list community reference (lowercase 'a' for NIP-72 compliance)
          limit: options.limit || 50,
        },
        {
          kinds: [1], // NIP-72後方互換性: kind:1もサポート
          "#a": [discussionListHex],
          limit: options.limit || 50,
        },
      ];

      if (options.until) {
        filters[0].until = options.until;
        filters[1].until = options.until;
      }

      return this.getEvents(filters);
    } catch (error) {
      logger.error("Failed to get community posts:", error);
      return [];
    }
  }

  // Get approval events (kind:4550) from admin
  async getApprovalEvents(adminPubkey: string): Promise<Event[]> {
    try {
      return this.getEvents([
        {
          kinds: [4550],
          authors: [adminPubkey],
        },
      ]);
    } catch (error) {
      logger.error("Failed to get approval events:", error);
      return [];
    }
  }

  // spec_v2.md要件: 承認待ちユーザー会話の取得 (DEPRECATED - use getCommunityPostsToDiscussionList)
  async getPendingUserDiscussions(adminPubkey: string): Promise<Event[]> {
    try {
      // 1. 全てのユーザー作成Kind:34550を取得
      const allUserDiscussions = await this.getEvents([
        {
          kinds: [34550],
          // 管理者以外が作成したイベント
        },
      ]);

      // 2. 管理者の承認イベントを取得
      const approvalEvents = await this.getAdminApprovalEvents(adminPubkey);

      // 3. 承認済みの会話IDを抽出
      const approvedRefs = new Set<string>();
      for (const approvalEvent of approvalEvents) {
        const qTags = approvalEvent.tags.filter((tag) => tag[0] === "q");
        for (const qTag of qTags) {
          if (qTag[1]) {
            approvedRefs.add(qTag[1]);
          }
        }
      }

      // 4. 承認されていない会話をフィルタリング
      const pendingDiscussions = allUserDiscussions.filter((event) => {
        if (event.pubkey === adminPubkey) return false; // 管理者作成は除外

        const dTag = event.tags.find((tag) => tag[0] === "d")?.[1];
        if (!dTag) return false;

        const ref = `34550:${event.pubkey}:${dTag}`;
        return !approvedRefs.has(ref);
      });

      // 最新のreplaceable eventのみを保持
      const eventsByRef = new Map<string, Event>();

      for (const event of pendingDiscussions) {
        const dTag = event.tags.find((tag) => tag[0] === "d")?.[1];
        if (!dTag) continue;

        const ref = `34550:${event.pubkey}:${dTag}`;
        const existing = eventsByRef.get(ref);
        if (!existing || event.created_at > existing.created_at) {
          eventsByRef.set(ref, event);
        }
      }

      return Array.from(eventsByRef.values());
    } catch (error) {
      logger.error("Failed to get pending user discussions:", error);
      return [];
    }
  }

  // spec_v2.md要件: 会話承認イベントの作成
  createDiscussionApprovalEvent(
    userDiscussion: { id: string; dTag: string; authorPubkey: string },
    approvalId?: string
  ): Omit<Event, "id" | "sig" | "pubkey"> {
    const approvalDTag = approvalId || `approval-${Date.now()}`;
    const ref = `34550:${userDiscussion.authorPubkey}:${userDiscussion.dTag}`;

    const tags: string[][] = [
      ["d", approvalDTag],
      ["name", "承認済み会話リスト"],
      ["description", "管理者による承認済み会話リスト"],
      ["q", ref], // NIP-18 qタグでの引用
    ];

    return {
      kind: 34550,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: `承認済み会話リスト（${new Date().toLocaleDateString()}）`,
    };
  }

  // spec_v2.md要件: 承認撤回イベントの作成
  createApprovalRevocationEvent(
    approvalEventId: string
  ): Omit<Event, "id" | "sig" | "pubkey"> {
    return {
      kind: 5,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["e", approvalEventId]],
      content: "delete",
    };
  }

  disconnect(): void {
    this.ndk.pool.relays.forEach((relay) => relay.disconnect());
    this.connectPromise = undefined;
  }

  getPublicKeyFromPWK(pwk: PWKBlob): string {
    return pwk.pubkey;
  }

  static createCommunityId(pubkey: string, dTag: string): string {
    return `34550:${pubkey}:${dTag}`;
  }
}

const serviceSingletons = new Map<string, NostrService>();

export const getNostrServiceConfigKey = (config: NostrServiceConfig): string => {
  const normalizedRelays = config.relays.map((relay) => ({
    url: relay.url,
    read: relay.read,
    write: relay.write,
  }));
  return JSON.stringify({
    relays: normalizedRelays,
    defaultTimeout: config.defaultTimeout,
  });
};

export const createNostrService = (
  config: NostrServiceConfig
): NostrService => {
  const cacheKey = getNostrServiceConfigKey(config);
  const existing = serviceSingletons.get(cacheKey);
  if (existing) {
    return existing;
  }

  const service = new NostrService(config);
  serviceSingletons.set(cacheKey, service);
  return service;
};
