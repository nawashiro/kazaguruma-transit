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
    "/node_modules/(?!(uncrypto|iron-session|next-auth|nostr-tools|@noble\\/hashes|@scure\\/bip39)/)",
  ],
};

export default createJestConfig(customJestConfig);
