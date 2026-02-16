import {
  loadRubyPreference,
  saveRubyPreference,
  isLocalStorageAvailable,
  observeRubyToggle,
  RUBY_PREFERENCE_KEY,
  DEFAULT_RUBY_DISPLAY,
} from '../ruby-preference';

describe('Ruby Preference Service', () => {
  beforeEach(() => {
    // 各テストの前にlocalStorageをクリア
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('isLocalStorageAvailable', () => {
    it('localStorage が使用可能な場合は true を返すこと', () => {
      expect(isLocalStorageAvailable()).toBe(true);
    });

    it('localStorage が使用不可の場合は false を返すこと', () => {
      // localStorageを一時的に無効化してテスト
      const originalLocalStorage = global.localStorage;
      // @ts-expect-error - テスト用にlocalStorageを無効化
      delete global.localStorage;

      expect(isLocalStorageAvailable()).toBe(false);

      // 復元
      global.localStorage = originalLocalStorage;
    });
  });

  describe('loadRubyPreference', () => {
    it('localStorage に設定がない場合はデフォルト値を返すこと', () => {
      expect(loadRubyPreference()).toBe(DEFAULT_RUBY_DISPLAY);
    });

    it('localStorage に "true" が保存されている場合は true を返すこと', () => {
      localStorage.setItem(RUBY_PREFERENCE_KEY, 'true');
      expect(loadRubyPreference()).toBe(true);
    });

    it('localStorage に "false" が保存されている場合は false を返すこと', () => {
      localStorage.setItem(RUBY_PREFERENCE_KEY, 'false');
      expect(loadRubyPreference()).toBe(false);
    });

    it('localStorage に不正な値が保存されている場合はデフォルト値を返すこと', () => {
      localStorage.setItem(RUBY_PREFERENCE_KEY, 'invalid');
      expect(loadRubyPreference()).toBe(DEFAULT_RUBY_DISPLAY);
    });

    it('localStorage が使用不可の場合はデフォルト値を返すこと', () => {
      // localStorageを一時的に無効化してテスト
      const originalLocalStorage = global.localStorage;
      // @ts-expect-error - テスト用にlocalStorageを無効化
      delete global.localStorage;

      expect(loadRubyPreference()).toBe(DEFAULT_RUBY_DISPLAY);

      // 復元
      global.localStorage = originalLocalStorage;
    });
  });

  describe('saveRubyPreference', () => {
    it('true を保存できること', () => {
      const result = saveRubyPreference(true);
      expect(result).toBe(true);
      expect(localStorage.getItem(RUBY_PREFERENCE_KEY)).toBe('true');
    });

    it('false を保存できること', () => {
      const result = saveRubyPreference(false);
      expect(result).toBe(true);
      expect(localStorage.getItem(RUBY_PREFERENCE_KEY)).toBe('false');
    });

    it('localStorage が使用不可の場合は false を返すこと', () => {
      // localStorageを一時的に無効化してテスト
      const originalLocalStorage = global.localStorage;
      // @ts-expect-error - テスト用にlocalStorageを無効化
      delete global.localStorage;

      const result = saveRubyPreference(true);
      expect(result).toBe(false);

      // 復元
      global.localStorage = originalLocalStorage;
    });
  });

  describe('observeRubyToggle', () => {
    beforeEach(() => {
      // 各テストの前にDOMをクリア
      document.body.innerHTML = '';
    });

    it('トグルボタンが存在する場合、クリックイベントを監視できること', () => {
      // トグルボタンをDOMに追加
      const button = document.createElement('button');
      button.className = 'my-toggle';
      document.body.appendChild(button);

      // 初期状態を保存（オン）
      localStorage.setItem(RUBY_PREFERENCE_KEY, 'true');

      const callback = jest.fn();
      const cleanup = observeRubyToggle(callback);

      // ボタンをクリック
      button.click();

      // コールバックが呼ばれ、状態が反転していることを確認
      expect(callback).toHaveBeenCalledWith(false);

      cleanup();
    });

    it('トグルボタンをクリックするたびに状態が反転すること', () => {
      const button = document.createElement('button');
      button.className = 'my-toggle';
      document.body.appendChild(button);

      // 初期状態を保存（オン）
      localStorage.setItem(RUBY_PREFERENCE_KEY, 'true');

      const callback = jest.fn();
      const cleanup = observeRubyToggle(callback);

      // 1回目のクリック: true -> false
      button.click();
      expect(callback).toHaveBeenCalledWith(false);

      // 状態を更新（実際のアプリではコールバック内でsaveRubyPreferenceが呼ばれる）
      localStorage.setItem(RUBY_PREFERENCE_KEY, 'false');

      // 2回目のクリック: false -> true
      button.click();
      expect(callback).toHaveBeenCalledWith(true);

      cleanup();
    });

    it('トグルボタンが存在しない場合、リトライすること', () => {
      jest.useFakeTimers();

      const callback = jest.fn();
      observeRubyToggle(callback, 3, 100); // 最大3回、100msごとにリトライ

      // 初回は何も起こらない
      expect(callback).not.toHaveBeenCalled();

      // 100ms後にボタンを追加
      jest.advanceTimersByTime(100);
      const button = document.createElement('button');
      button.className = 'my-toggle';
      document.body.appendChild(button);

      // さらに100ms進めてリトライを実行
      jest.advanceTimersByTime(100);

      // ボタンをクリック
      button.click();
      expect(callback).toHaveBeenCalled();

      jest.useRealTimers();
    });
  });
});
