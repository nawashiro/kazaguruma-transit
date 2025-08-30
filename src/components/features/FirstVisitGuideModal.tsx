import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isFirstVisit } from "../../utils/visitTracker";
import { logger } from "../../utils/logger";
import { sendEvent } from "@/lib/analytics/useGA";

/**
 * 初回訪問ガイドモーダル
 * 初めてアプリを訪れたユーザーに表示される初心者ガイドへの誘導モーダル
 * クッキーポリシーのような控えめな下部表示
 */
const FirstVisitGuideModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // モーダルを開いたとき、閉じるボタンにフォーカスを移動
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);

    // イベント記録
    logger.log("初回訪問ポップアップが閉じられました");

    // Googleアナリティクスイベント送信
    sendEvent(
      "engagement",
      "guide_popup_close",
      "beginners_guide_popup_dismissed"
    );
  }, []);

  const handleGoToGuide = useCallback(() => {
    setIsOpen(false);

    // イベント記録
    logger.log("初回訪問ポップアップからガイドページへ移動します");

    // Googleアナリティクスイベント送信
    sendEvent(
      "engagement",
      "guide_popup_click",
      "beginners_guide_popup_navigation"
    );

    router.push("/beginners-guide");
  }, [router]);

  useEffect(() => {
    // ページロード後に初回訪問かどうかを確認し、タイマーで少し遅らせて表示
    const timer = setTimeout(() => {
      const firstVisit = isFirstVisit();
      setIsOpen(firstVisit);

      if (firstVisit) {
        logger.log("初回訪問ポップアップが表示されました");
      }
    }, 1500); // 1.5秒後に表示して急すぎる印象を避ける

    return () => {
      clearTimeout(timer);
    };
  }, []); // 空の依存配列に修正して、マウント時のみ実行されるように

  // ESCキーでモーダルを閉じる機能
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleClose]); // isOpenとhandleCloseが変わるたびにリスナーを更新


  if (!isOpen) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 p-4 z-40 animate-slideUp"
      data-testid="first-visit-modal"
    >
      <div
        className="rounded-lg p-4 shadow-lg max-w-3xl mx-auto border border-primary/20 bg-base-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        <h2 id="modal-title" className="text-lg font-semibold ruby-text">
          風ぐるまは初めてですか？
        </h2>
        <p id="modal-description" className="my-2 ruby-text">
          風ぐるまの使い方や基本情報を確認してみませんか？
        </p>
        <div className="flex gap-2 justify-end mt-3">
          <button
            className="btn btn-sm btn-outline rounded-full dark:rounded-sm min-h-10 h-fit"
            onClick={handleClose}
            data-testid="close-guide-modal"
          >
            <span>
              <ruby>
                後<rt>あと</rt>
              </ruby>
              で
              <ruby>
                見<rt>み</rt>
              </ruby>
              る
            </span>
          </button>
          <button
            className="btn btn-sm btn-primary rounded-full dark:rounded-sm min-h-10 h-fit"
            onClick={handleGoToGuide}
            data-testid="go-to-guide"
          >
            <span>
              <ruby>
                使<rt>つか</rt>
              </ruby>
              い
              <ruby>
                方<rt>かた</rt>
              </ruby>
              を
              <ruby>
                見<rt>み</rt>
              </ruby>
              る
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FirstVisitGuideModal;
