import { SimplePool, Event, Filter, finalizeEvent } from "nostr-tools";
import type { PWKBlob } from "nosskey-sdk";
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

  createRevocationEvent(
    approvalEventId: string,
    discussionId?: string
  ): Omit<Event, "id" | "sig" | "pubkey"> {
    const tags: string[][] = [
      ["e", approvalEventId]
    ];

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
    const approvalEvents = events.filter(event => 
      event.tags.some(tag => tag[0] === "q")
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

  // spec_v2.md要件: 引用されたユーザー作成Kind:34550の取得
  async getReferencedUserDiscussions(references: string[]): Promise<Event[]> {
    if (references.length === 0) {
      return [];
    }

    // 引用形式: "34550:pubkey:dTag" を解析
    const filters: Filter[] = [];
    
    for (const ref of references) {
      const parts = ref.split(':');
      if (parts.length === 3 && parts[0] === '34550') {
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

  // spec_v2.md要件: NIP-72承認システムでの承認済みユーザー会話取得
  async getApprovedUserDiscussions(
    adminPubkey: string,
    options: { limit?: number; until?: number } = {}
  ): Promise<{
    userDiscussion: Event;
    approvalEvent: Event;
    approvedAt: number;
  }[]> {
    try {
      // 1. 管理者の承認イベントを取得（ページネーション対応）
      const approvalEvents = await this.getAdminApprovalEvents(adminPubkey, options);
      
      // 2. すべてのqタグから引用を抽出
      const allReferences: string[] = [];
      const approvalMap = new Map<string, Event>();
      
      for (const approvalEvent of approvalEvents) {
        const qTags = approvalEvent.tags.filter(tag => tag[0] === "q");
        for (const qTag of qTags) {
          if (qTag[1]) {
            allReferences.push(qTag[1]);
            approvalMap.set(qTag[1], approvalEvent);
          }
        }
      }
      
      // 3. 引用されたユーザー会話を取得
      const userDiscussions = await this.getReferencedUserDiscussions(allReferences);
      
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
      const filter: Filter = {
        kinds: [1111], // NIP-72 community posts
        "#A": [discussionListNaddr], // Discussion list community reference
        limit: options.limit || 50,
      };

      if (options.until) {
        filter.until = options.until;
      }

      return this.getEvents([filter]);
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
        const qTags = approvalEvent.tags.filter(tag => tag[0] === "q");
        for (const qTag of qTags) {
          if (qTag[1]) {
            approvedRefs.add(qTag[1]);
          }
        }
      }

      // 4. 承認されていない会話をフィルタリング
      const pendingDiscussions = allUserDiscussions.filter(event => {
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
