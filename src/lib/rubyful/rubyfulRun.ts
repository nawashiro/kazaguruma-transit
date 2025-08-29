import { logger } from "@/utils/logger";
import { useEffect, useState } from "react";

// Rubyful v2のグローバル型定義
declare global {
  interface Window {
    RubyfulV2?: {
      init: (config: {
        selector?: string;
        defaultDisplay?: boolean;
      }) => void;
      toggle?: () => void;
    };
  }
}

/**
 * ローカルストレージからルビ表示設定を読み込む
 * @returns ルビ表示設定（デフォルト: true）
 */
const getRubyfulSetting = (): boolean => {
  if (typeof window === "undefined") {
    // SSR時はデフォルト値を返す
    return true;
  }

  try {
    const savedSetting = localStorage.getItem("isRubyOn");
    // 明示的に"false"が設定されている場合のみOFF、それ以外はON
    return savedSetting !== "false";
  } catch (error) {
    logger.warn("ローカルストレージの読み込みに失敗しました:", error);
    return true;
  }
};

/**
 * Rubyful v2ライブラリを管理するフック（簡素化版）
 * @param trigger - 再実行のトリガーとなる依存配列
 * @param isLoaded - Rubyfulライブラリが読み込み完了したかどうか
 */
export const useRubyfulRun = (trigger: unknown[], isLoaded: boolean) => {
  // ルビ表示の状態管理（初期値はローカルストレージから読み込み）
  const [isRubyVisible, setIsRubyVisible] = useState(() => getRubyfulSetting());

  useEffect(() => {
    // Rubyful v2が読み込まれていない場合はスキップ
    if (!isLoaded) return;

    try {
      // Rubyful v2はMutationObserverで自動的にDOM変更を監視するため
      // 手動でのDOM操作や複雑な初期化処理は不要
      logger.info("Rubyful v2 is managing ruby text automatically");
      
      // ローカルストレージの設定を保存
      try {
        localStorage.setItem("isRubyOn", isRubyVisible.toString());
      } catch (error) {
        logger.warn("ローカルストレージへの保存に失敗しました:", error);
      }
    } catch (error) {
      logger.error("Rubyful v2の処理中にエラーが発生しました:", error);
    }
  }, [trigger, isLoaded, isRubyVisible]);

  return { isRubyVisible };
};
