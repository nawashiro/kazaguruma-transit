/**
 * sqlite-manager.tsのモック
 */

const mockSqliteManager = {
  init: jest.fn().mockResolvedValue(undefined),
  runQuery: jest.fn().mockResolvedValue({ lastID: 1, changes: 1 }),
  getQuery: jest.fn().mockResolvedValue({}),
  allQuery: jest.fn().mockResolvedValue([]),
  getRateLimitByIp: jest.fn().mockResolvedValue(null),
  incrementRateLimit: jest.fn().mockResolvedValue(undefined),
  resetRateLimit: jest.fn().mockResolvedValue(undefined),
  cleanupExpiredRateLimits: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
};

exports.sqliteManager = mockSqliteManager;
