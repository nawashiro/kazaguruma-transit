import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^src/lib/auth/session$": "<rootDir>/__mocks__/lib/auth/session.ts",
    "^src/lib/api/rate-limit-middleware$":
      "<rootDir>/__mocks__/lib/api/rate-limit-middleware.ts",
  },
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
  transformIgnorePatterns: [
    "/node_modules/(?!(uncrypto|iron-session|next-auth|nostr-tools|@noble\\/hashes|@noble\\/curves|@noble\\/ciphers|@scure\\/base|@scure\\/bip39)/)",
  ],
};

const serverTestFiles = [
  "<rootDir>/src/app/api/__tests__/transit-production.test.ts",
  "<rootDir>/src/app/__tests__/location-pages-*.test.ts",
];

const resolveJestConfig = createJestConfig(customJestConfig);

export default async () => {
  const resolvedConfig = await resolveJestConfig();

  const baseConfig = {
    ...resolvedConfig,
    // Override next/jest's default ignore list so actual NDK codecs can load.
    transformIgnorePatterns: [
      "/node_modules/(?!(uncrypto|iron-session|next-auth|nostr-tools|@noble\\/hashes|@noble\\/curves|@noble\\/ciphers|@scure\\/base|@scure\\/bip39)/)",
      "^.+\\\\.module\\\\.(css|sass|scss)$",
    ],
  };

  return {
    ...baseConfig,
    projects: [
      {
        ...baseConfig,
        displayName: "unit",
        testPathIgnorePatterns: [
          ...baseConfig.testPathIgnorePatterns,
          "src/app/api/__tests__/transit-production",
          "src/app/__tests__/location-pages-404",
          "src/app/__tests__/location-pages-origin-runtime",
        ],
      },
      {
        ...baseConfig,
        displayName: "server",
        testMatch: serverTestFiles,
        testEnvironment: "node",
        maxWorkers: 1,
        globalSetup: "<rootDir>/scripts/global-setup.mjs",
        globalTeardown: "<rootDir>/scripts/global-teardown.mjs",
      },
    ],
  };
};
