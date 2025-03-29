// API関連のテスト用セットアップファイル
// Next.js APIルートハンドラのテストに必要なグローバル変数とポリフィルを設定
global.Request = class Request {};
global.Response = class Response {
  constructor(body, init) {
    this.body = body;
    this.init = init || {};
    this.status = init?.status || 200;
    this.headers = new Map();
    if (init?.headers) {
      Object.entries(init.headers).forEach(([key, value]) => {
        this.headers.set(key, value);
      });
    }
  }

  json() {
    if (typeof this.body === "string") {
      return Promise.resolve(JSON.parse(this.body));
    }
    return Promise.resolve(this.body);
  }
};

// NextResponseのモックを作成
jest.mock("next/server", () => {
  return {
    NextRequest: class MockNextRequest {
      constructor(url, init = {}) {
        this.url = url;
        this.method = init.method || "GET";
        this.headers = new Map();
        this.body = init.body || null;
        this.nextUrl = new URL(url, "http://localhost");
        this.searchParams = this.nextUrl.searchParams;
      }
    },
    NextResponse: {
      json: (body, init) => {
        const response = new Response(JSON.stringify(body), init);
        return response;
      },
    },
  };
});

// fsモジュールをモック
jest.mock("fs", () => {
  return {
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    unlink: jest.fn(),
  };
});

// pathモジュールをモック
jest.mock("path", () => {
  const originalModule = jest.requireActual("path");
  return {
    ...originalModule,
    join: jest.fn((...args) => args.join("/")),
  };
});
