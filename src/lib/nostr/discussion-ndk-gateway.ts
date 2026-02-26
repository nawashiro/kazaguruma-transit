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
  onEvent: (event: NostrEventDTO) => void;
  onEose?: () => void;
}

export interface NdkEventFilter {
  kinds?: number[];
  authors?: string[];
  "#a"?: string[];
  "#e"?: string[];
  "#p"?: string[];
  since?: number;
  until?: number;
  limit?: number;
}

export interface DiscussionNdkGateway {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  query: (filters: NdkEventFilter[]) => Promise<NostrEventDTO[]>;
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
