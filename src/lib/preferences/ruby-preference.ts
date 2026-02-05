/**
 * ルビ表示設定の永続化サービス
 * @module ruby-preference
 */

/**
 * localStorageのキー名
 * ルビ表示設定を保存するために使用される
 */
export const RUBY_PREFERENCE_KEY = 'rubyful-display-preference' as const;

/**
 * デフォルト設定値（ルビ表示オン）
 * localStorage使用不可や設定未保存時に使用される
 */
export const DEFAULT_RUBY_DISPLAY = true as const;

/**
 * ルビ表示設定の型
 */
export type RubyPreference = boolean;

/**
 * localStorage保存形式の型
 */
export type RubyPreferenceStorageValue = 'true' | 'false';

import { logger } from '@/utils/logger';

/**
 * localStorageが使用可能かチェックする
 *
 * プライベートブラウジングモードや古いブラウザでは、localStorageが
 * 使用できない場合があるため、事前にチェックする必要がある。
 *
 * @returns {boolean} localStorageが使用可能な場合はtrue
 */
export function isLocalStorageAvailable(): boolean {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * ルビ表示設定を読み込む
 *
 * localStorageから保存された設定を読み込み、ルビ表示の有効/無効を返す。
 * 設定が存在しない場合や読み込みに失敗した場合は、デフォルト値（true）を返す。
 *
 * @returns {boolean} 保存された設定、または存在しない場合はデフォルト値（true）
 */
export function loadRubyPreference(): boolean {
  if (!isLocalStorageAvailable()) {
    logger.warn('localStorage is not available, using default value');
    return DEFAULT_RUBY_DISPLAY;
  }

  try {
    const stored = localStorage.getItem(RUBY_PREFERENCE_KEY);
    if (stored === null) {
      return DEFAULT_RUBY_DISPLAY; // 初回アクセス
    }
    if (stored !== 'true' && stored !== 'false') {
      logger.warn(`Invalid ruby preference value: ${stored}, using default`);
      return DEFAULT_RUBY_DISPLAY;
    }
    return stored === 'true';
  } catch (error) {
    logger.error('Failed to load ruby preference:', error);
    return DEFAULT_RUBY_DISPLAY;
  }
}

/**
 * ルビ表示設定を保存する
 *
 * ルビ表示の有効/無効をlocalStorageに保存する。
 * 保存に成功した場合はtrue、失敗した場合はfalseを返す。
 *
 * @param {boolean} isEnabled - ルビ表示の有効/無効
 * @returns {boolean} 保存に成功したかどうか
 */
export function saveRubyPreference(isEnabled: boolean): boolean {
  if (!isLocalStorageAvailable()) {
    logger.warn('localStorage is not available, cannot save preference');
    return false;
  }

  try {
    localStorage.setItem(RUBY_PREFERENCE_KEY, String(isEnabled));
    logger.log(`Ruby preference saved: ${isEnabled}`);
    return true;
  } catch (error) {
    logger.error('Failed to save ruby preference:', error);
    return false;
  }
}

/**
 * RubyfulV2のトグル状態変更を監視する
 *
 * トグルボタンのクリックイベントを監視し、状態が変更されたときに
 * コールバック関数を呼び出す。
 *
 * ボタンが見つからない場合は、最大5秒間（50回）リトライする。
 *
 * 実装方法: RubyfulV2の公開APIから内部状態にアクセスできないため、
 * クリック時に現在保存されている設定を読み込んで反転させた値を
 * 新しい状態として扱う。
 *
 * @param {(isEnabled: boolean) => void} callback - 状態変更時に呼ばれるコールバック
 * @param {number} maxRetries - 最大リトライ回数（デフォルト: 50）
 * @param {number} retryInterval - リトライ間隔（ミリ秒、デフォルト: 100）
 * @returns {() => void} 監視を停止するクリーンアップ関数
 */
export function observeRubyToggle(
  callback: (isEnabled: boolean) => void,
  maxRetries: number = 50,
  retryInterval: number = 100
): () => void {
  let toggleButton: Element | null = null;
  let retryCount = 0;
  let retryTimer: NodeJS.Timeout | null = null;

  const handleClick = () => {
    logger.log('Ruby toggle button clicked');
    // RubyfulV2の状態更新は同期的に行われる
    // 現在保存されている設定を読み込み、反転させた値を新しい状態とする
    const currentSaved = loadRubyPreference();
    const newState = !currentSaved;
    logger.log('Toggle state changed:', currentSaved, '->', newState);
    callback(newState);
  };

  const tryAttach = (): boolean => {
    // トグルボタンを取得してイベントリスナーを追加
    toggleButton = document.querySelector('.my-toggle');
    if (toggleButton) {
      toggleButton.addEventListener('click', handleClick);
      logger.log('Ruby toggle observer started');
      return true;
    }
    return false;
  };

  // 初回試行
  if (tryAttach()) {
    return () => {
      if (toggleButton) {
        toggleButton.removeEventListener('click', handleClick);
        logger.log('Ruby toggle observer stopped');
      }
      if (retryTimer) clearInterval(retryTimer);
    };
  }

  // リトライ処理
  logger.log('Ruby toggle button not found, starting retry...');
  retryTimer = setInterval(() => {
    retryCount++;
    if (tryAttach()) {
      if (retryTimer) clearInterval(retryTimer);
    } else if (retryCount >= maxRetries) {
      logger.warn(
        `Ruby toggle button not found after ${maxRetries} retries, observer not started`
      );
      if (retryTimer) clearInterval(retryTimer);
    }
  }, retryInterval);

  return () => {
    if (toggleButton) {
      toggleButton.removeEventListener('click', handleClick);
      logger.log('Ruby toggle observer stopped');
    }
    if (retryTimer) clearInterval(retryTimer);
  };
}
