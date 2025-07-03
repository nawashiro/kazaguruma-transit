import { logger } from "@/utils/logger";
import { useEffect, useState, useCallback } from "react";

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
    const savedSetting = localStorage.getItem("rubyful");
    // 明示的に"false"が設定されている場合のみOFF、それ以外はON
    return savedSetting !== "false";
  } catch (error) {
    console.warn("ローカルストレージの読み込みに失敗しました:", error);
    return true;
  }
};

/**
 * Rubyfulライブラリを初期化し、ルビ表示機能を管理するフック
 * @param trigger - 再実行のトリガーとなる依存配列
 * @param isLoaded - Rubyfulライブラリが読み込み完了したかどうか
 */
export const useRubyfulRun = (trigger: any[], isLoaded: boolean) => {
  // ルビ表示の状態管理（初期値はローカルストレージから読み込み）
  const [isRubyVisible, setIsRubyVisible] = useState(() => getRubyfulSetting());

  // ルビ表示切り替えハンドラーをuseCallbackで最適化
  const handleToggleRuby = useCallback(() => {
    setIsRubyVisible((prevState) => {
      const newRubyState = !prevState;

      try {
        localStorage.setItem("rubyful", newRubyState.toString());

        // Rubyfulライブラリの設定も同時に更新
        if ((window as any).RubyfulJsApp) {
          (window as any).RubyfulJsApp.defaultDisplay = newRubyState;
        }
      } catch (error) {
        logger.warn("ローカルストレージの保存に失敗しました:", error);
      }

      return newRubyState;
    });
  }, []);

  useEffect(() => {
    // Rubyfulライブラリが未読み込みの場合は処理をスキップ
    if (!isLoaded) return;

    try {
      // 既存のRubyfulボタンを削除（重複防止）
      const existingButtons = document.getElementsByClassName(
        "rubyfuljs-button"
      ) as HTMLCollectionOf<HTMLButtonElement>;

      for (const button of existingButtons) {
        button.remove();
      }

      // Rubyfulライブラリの設定
      (window as any).RubyfulJsApp = {
        refPaths: ["//*[contains(@class,'ruby-text')]"],
        defaultDisplay: isRubyVisible,
        ...(window as any).RubyfulJsApp,
      };

      // Rubyfulの手動初期化実行
      (window as any).RubyfulJsApp.manualLoadProcess();

      // ルビ表示切り替えボタンにイベントリスナーを設定
      const rubyfulButton = document.getElementsByClassName("rubyfuljs-button");

      if (rubyfulButton.length > 0) {
        rubyfulButton[0].addEventListener("click", handleToggleRuby);

        // クリーンアップ関数でイベントリスナーを削除
        return () => {
          if (rubyfulButton[0]) {
            rubyfulButton[0].removeEventListener("click", handleToggleRuby);
          }
        };
      }
    } catch (error) {
      logger.error("Rubyfulの初期化中にエラーが発生しました:", error);
    }
  }, [...trigger, handleToggleRuby]);

  return { isRubyVisible };
};
