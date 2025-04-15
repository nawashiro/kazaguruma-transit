/**
 * sqlite3モジュールのモック
 */

class MockStatement {
  constructor() {}
  run() {
    return Promise.resolve({});
  }
  get() {
    return Promise.resolve({});
  }
  all() {
    return Promise.resolve([]);
  }
  finalize() {
    return Promise.resolve({});
  }
}

class MockDatabase {
  constructor() {}
  run(sql, params, callback) {
    if (callback) {
      callback(null, { lastID: 1, changes: 1 });
    }
    return Promise.resolve({ lastID: 1, changes: 1 });
  }
  get(sql, params, callback) {
    if (callback) {
      callback(null, {});
    }
    return Promise.resolve({});
  }
  all(sql, params, callback) {
    if (callback) {
      callback(null, []);
    }
    return Promise.resolve([]);
  }
  exec(sql, callback) {
    if (callback) {
      callback(null);
    }
    return Promise.resolve({});
  }
  prepare(sql, params, callback) {
    const stmt = new MockStatement();
    if (callback) {
      callback(null, stmt);
    }
    return stmt;
  }
  close(callback) {
    if (callback) {
      callback(null);
    }
    return Promise.resolve({});
  }
  serialize() {}
  parallelize() {}
}

const sqlite3 = {
  Database: MockDatabase,
  Statement: MockStatement,
  verbose: () => sqlite3,
  OPEN_READONLY: 1,
  OPEN_READWRITE: 2,
  OPEN_CREATE: 4,
  OPEN_FULLMUTEX: 65536,
  OPEN_URI: 64,
  OPEN_SHAREDCACHE: 131072,
  OPEN_PRIVATECACHE: 262144,
};

module.exports = sqlite3;
