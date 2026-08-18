type Tag = string[];

type RawEvent = {
  id?: string;
  sig?: string;
  kind?: number;
  pubkey?: string;
  created_at?: number;
  content?: string;
  tags?: Tag[];
};

export class NDKEvent {
  private readonly event: RawEvent;

  constructor(_ndk?: NDK, event?: RawEvent) {
    this.event = event ?? {};
  }

  rawEvent() {
    return {
      id: this.event.id ?? "mock-id",
      sig: this.event.sig ?? "mock-sig",
      kind: this.event.kind ?? 1,
      pubkey: this.event.pubkey ?? "f".repeat(64),
      created_at: this.event.created_at ?? Math.floor(Date.now() / 1000),
      content: this.event.content ?? "",
      tags: this.event.tags ?? [],
    };
  }

  async sign() {
    return "mock-signature";
  }

  async publish() {
    return new Set(["wss://mock-relay"]);
  }
}

export class NDKPrivateKeySigner {
  readonly pubkey = "f".repeat(64);

  constructor(privateKey: Uint8Array | string) {
    void privateKey;
  }
}

export class NDKRelaySet {
  static fromRelayUrls(urls: readonly string[], _ndk: NDK) {
    void _ndk;
    return { urls: [...urls] };
  }
}

export default class NDK {
  pool = {
    relays: new Map<string, { disconnect: () => void }>([
      ["wss://mock-relay", { disconnect: () => undefined }],
    ]),
  };

  constructor(opts?: unknown) {
    void opts;
  }

  async connect(timeoutMs?: number) {
    void timeoutMs;
  }

  async fetchEvents(filters: unknown, opts?: unknown) {
    void filters;
    void opts;
    return new Set<NDKEvent>();
  }

  subscribe(filters: unknown, opts?: unknown, autoStart?: unknown) {
    void filters;
    void opts;
    void autoStart;
    return {
      stop: () => undefined,
    };
  }
}
