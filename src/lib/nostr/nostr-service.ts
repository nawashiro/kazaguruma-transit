import { SimplePool, Event, Filter, finalizeEvent } from "nostr-tools";
import type { PWKBlob } from "nosskey-sdk";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@/utils/logger";

export interface NostrRelayConfig {
  url: string;
  read: boolean;
  write: boolean;
}

export interface NostrServiceConfig {
  relays: NostrRelayConfig[];
  defaultTimeout: number;
}

export class NostrService {
  private pool: SimplePool;
  private relays: string[];
  private config: NostrServiceConfig;

  constructor(config: NostrServiceConfig) {
    this.pool = new SimplePool();
    this.config = config;
    this.relays = config.relays
      .filter((relay) => relay.read)
      .map((relay) => relay.url);
  }

  async getEvents(filters: Filter[]): Promise<Event[]> {
    try {
      // Handle multiple filters by making multiple queries and combining results
      const allEvents: Event[] = [];
      for (const filter of filters) {
        const events = await this.pool.querySync(this.relays, filter);
        allEvents.push(...(events || []));
      }
      // Remove duplicates by ID
      const uniqueEvents = allEvents.filter(
        (event, index, self) =>
          self.findIndex((e) => e.id === event.id) === index
      );
      return uniqueEvents;
    } catch (error) {
      logger.error("Failed to get events:", error);
      return [];
    }
  }

  async subscribeToEvents(
    filters: Filter[],
    onEvent: (event: Event) => void,
    onEose?: () => void
  ): Promise<() => void> {
    const subscription = this.pool.subscribeMany(this.relays, filters, {
      onevent: onEvent,
      oneose: onEose,
    });

    return () => {
      subscription.close();
    };
  }

  async publishEvent(
    event: Omit<Event, "id" | "sig" | "pubkey">,
    secretKey: Uint8Array
  ): Promise<boolean> {
    try {
      const signedEvent = finalizeEvent(event, secretKey);
      const writeRelays = this.config.relays
        .filter((relay) => relay.write)
        .map((relay) => relay.url);

      const promises = this.pool.publish(writeRelays, signedEvent);
      const results = await Promise.allSettled(promises);

      return results.some((result) => result.status === "fulfilled");
    } catch (error) {
      logger.error("Failed to publish event:", error);
      return false;
    }
  }

  async publishSignedEvent(signedEvent: Event): Promise<boolean> {
    try {
      const writeRelays = this.config.relays
        .filter((relay) => relay.write)
        .map((relay) => relay.url);

      const promises = this.pool.publish(writeRelays, signedEvent);
      const results = await Promise.allSettled(promises);

      return results.some((result) => result.status === "fulfilled");
    } catch (error) {
      logger.error("Failed to publish signed event:", error);
      return false;
    }
  }

  async getProfile(pubkey: string): Promise<Event | null> {
    const events = await this.getEvents([
      {
        kinds: [0],
        authors: [pubkey],
        limit: 1,
      },
    ]);

    return events[0] || null;
  }

  async getDiscussions(adminPubkey: string): Promise<Event[]> {
    return this.getEvents([
      {
        kinds: [34550],
        authors: [adminPubkey],
      },
    ]);
  }

  async getDiscussionPosts(
    discussionId: string,
    busStopTags?: string[]
  ): Promise<Event[]> {
    const filters: Filter[] = [];

    if (busStopTags && busStopTags.length > 0) {
      // バス停ごとに個別のフィルタを作成
      busStopTags.forEach((busStopTag) => {
        filters.push({
          kinds: [1111],
          "#a": [discussionId],
          "#t": [busStopTag],
        });
      });
    } else {
      // バス停指定なしの場合は全投稿を取得
      filters.push({
        kinds: [1111],
        "#a": [discussionId],
      });
    }

    return this.getEvents(filters);
  }

  async getApprovals(discussionId: string): Promise<Event[]> {
    return this.getEvents([
      {
        kinds: [4550],
        "#a": [discussionId],
      },
    ]);
  }

  async getApprovalsForPosts(
    postIds: string[],
    discussionId: string
  ): Promise<Event[]> {
    if (postIds.length === 0) {
      return [];
    }

    return this.getEvents([
      {
        kinds: [4550],
        "#a": [discussionId],
        "#e": postIds,
      },
    ]);
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
      filters["#a"] = [discussionId];
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
      filters["#a"] = [discussionId];
    }

    return this.getEvents([filters]);
  }

  async getEvaluationsForPosts(
    postIds: string[],
    discussionId?: string
  ): Promise<Event[]> {
    if (postIds.length === 0) {
      return [];
    }

    const filters: Filter = {
      kinds: [7],
      "#e": postIds,
    };

    if (discussionId) {
      filters["#a"] = [discussionId];
    }

    return this.getEvents([filters]);
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
    dTag?: string
  ): Omit<Event, "id" | "sig" | "pubkey"> {
    const tagValue = dTag || uuidv4();
    const tags: string[][] = [
      ["d", tagValue],
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
    const tags: string[][] = [
      ["a", discussionId],
      ["A", discussionId],
    ];

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
    const tags: string[][] = [
      ["a", discussionId],
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
    const tags: string[][] = [
      ["e", targetEventId],
      ["rating", rating],
    ];

    if (discussionId) {
      tags.push(["a", discussionId]);
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

  disconnect(): void {
    this.pool.close(this.relays);
  }

  getPublicKeyFromPWK(pwk: PWKBlob): string {
    return pwk.pubkey;
  }

  static createCommunityId(pubkey: string, dTag: string): string {
    return `34550:${pubkey}:${dTag}`;
  }
}

export const createNostrService = (
  config: NostrServiceConfig
): NostrService => {
  return new NostrService(config);
};
