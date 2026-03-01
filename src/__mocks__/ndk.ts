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

const isHex = (value: string, length: number): boolean =>
  value.length === length && /^[0-9a-f]+$/i.test(value);

const nip19Decode = (value: string) => {
  if (value.startsWith("npub1")) {
    const pubkey = value.slice(5);
    if (!isHex(pubkey, 64)) {
      throw new Error("invalid npub");
    }
    return { type: "npub", data: pubkey };
  }

  if (value.startsWith("naddr1")) {
    const payload = value.slice(6);
    if (!payload) {
      throw new Error("invalid naddr");
    }
    const decoded = JSON.parse(Buffer.from(payload, "hex").toString("utf8")) as {
      kind: number;
      pubkey: string;
      identifier: string;
      relays?: string[];
    };
    return {
      type: "naddr",
      data: {
        kind: decoded.kind,
        pubkey: decoded.pubkey,
        identifier: decoded.identifier,
        relays: decoded.relays ?? [],
      },
    };
  }

  throw new Error("unsupported bech32");
};

export const nip19 = {
  npubEncode(pubkey: string) {
    if (!isHex(pubkey, 64)) {
      throw new Error("invalid pubkey");
    }
    return `npub1${pubkey}`;
  },
  naddrEncode({
    kind,
    pubkey,
    identifier,
    relays,
  }: {
    kind: number;
    pubkey: string;
    identifier: string;
    relays?: string[];
  }) {
    const payload = Buffer.from(
      JSON.stringify({
        kind,
        pubkey,
        identifier,
        relays: relays ?? [],
      }),
      "utf8"
    ).toString("hex");
    return `naddr1${payload}`;
  },
  decode: nip19Decode,
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
  pubkey = "f".repeat(64);
  constructor(privateKey: Uint8Array | string) {
    void privateKey;
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
    return;
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
