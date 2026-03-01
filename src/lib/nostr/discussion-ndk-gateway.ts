import {
  createNostrService,
  type CompletionReason,
  type ReadEventsOptions,
  type NostrService,
  type NostrServiceConfig,
  type StreamEventsOptions,
} from "@/lib/nostr/nostr-service";

export interface NostrEventDraft {
  kind: number;
  content: string;
  tags: string[][];
  created_at: number;
  pubkey?: string;
}

export interface NostrEventDTO extends NostrEventDraft {
  id: string;
  pubkey: string;
  sig: string;
}

export interface NdkSubscription {
  close: () => void;
}

export interface NdkSubscribeHandlers {
  onEvent: (events: NostrEventDTO[], event: NostrEventDTO) => void;
  onEose?: (events: NostrEventDTO[]) => void;
}

export interface NdkEventFilter {
  kinds?: number[];
  authors?: string[];
  "#a"?: string[];
  "#e"?: string[];
  "#p"?: string[];
  "#d"?: string[];
  "#t"?: string[];
  since?: number;
  until?: number;
  limit?: number;
}

export interface NdkQueryCompletion {
  events: NostrEventDTO[];
  completionReason: CompletionReason;
  eventCount: number;
  elapsedMs: number;
  startedAt: number;
  lastEventAt: number;
  eoseReceived: boolean;
}

export interface DiscussionNdkGateway {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  query: (filters: NdkEventFilter[]) => Promise<NostrEventDTO[]>;
  queryWithCompletion: (
    filters: NdkEventFilter[],
    options?: ReadEventsOptions
  ) => Promise<NdkQueryCompletion>;
  subscribe: (
    filters: NdkEventFilter[],
    handlers: NdkSubscribeHandlers
  ) => NdkSubscription;
  sign: (event: NostrEventDraft) => Promise<NostrEventDTO>;
  publish: (event: NostrEventDTO) => Promise<boolean>;
}

export class UnconfiguredDiscussionNdkGateway implements DiscussionNdkGateway {
  async connect(): Promise<void> {
    return;
  }

  async disconnect(): Promise<void> {
    return;
  }

  async query(): Promise<NostrEventDTO[]> {
    return [];
  }

  async queryWithCompletion(): Promise<NdkQueryCompletion> {
    const now = Date.now();
    return {
      events: [],
      completionReason: "hard-timeout",
      eventCount: 0,
      elapsedMs: 0,
      startedAt: now,
      lastEventAt: now,
      eoseReceived: false,
    };
  }

  subscribe(): NdkSubscription {
    return { close: () => undefined };
  }

  async sign(event: NostrEventDraft): Promise<NostrEventDTO> {
    void event;
    throw new Error("NDK signer is not configured");
  }

  async publish(event: NostrEventDTO): Promise<boolean> {
    void event;
    return false;
  }
}

const toLegacyStreamOptions = (
  handlers: NdkSubscribeHandlers
): StreamEventsOptions => ({
  onEvent: (events, event) =>
    handlers.onEvent(
      events as unknown as NostrEventDTO[],
      event as unknown as NostrEventDTO
    ),
  onEose: (events) => handlers.onEose?.(events as unknown as NostrEventDTO[]),
});

export class LegacyNostrServiceDiscussionNdkGateway
  implements DiscussionNdkGateway
{
  constructor(private readonly service: NostrService) {}

  async connect(): Promise<void> {
    return;
  }

  async disconnect(): Promise<void> {
    this.service.disconnect();
  }

  async query(filters: NdkEventFilter[]): Promise<NostrEventDTO[]> {
    return (await this.service.getEventsOnEose(
      filters as Parameters<NostrService["getEventsOnEose"]>[0]
    )) as unknown as NostrEventDTO[];
  }

  async queryWithCompletion(
    filters: NdkEventFilter[],
    options?: ReadEventsOptions
  ): Promise<NdkQueryCompletion> {
    const completion = await this.service.getEventsWithCompletion(
      filters as Parameters<NostrService["getEventsWithCompletion"]>[0],
      options
    );
    return {
      ...completion,
      events: completion.events as unknown as NostrEventDTO[],
    };
  }

  subscribe(
    filters: NdkEventFilter[],
    handlers: NdkSubscribeHandlers
  ): NdkSubscription {
    const close = this.service.streamEventsOnEvent(
      filters as Parameters<NostrService["streamEventsOnEvent"]>[0],
      toLegacyStreamOptions(handlers)
    );
    return { close };
  }

  async sign(event: NostrEventDraft): Promise<NostrEventDTO> {
    void event;
    throw new Error("Legacy gateway cannot sign directly");
  }

  async publish(event: NostrEventDTO): Promise<boolean> {
    return this.service.publishSignedEvent(
      event as Parameters<NostrService["publishSignedEvent"]>[0]
    );
  }
}

export const createDiscussionNdkGateway = (
  config: NostrServiceConfig
): DiscussionNdkGateway =>
  new LegacyNostrServiceDiscussionNdkGateway(createNostrService(config));
