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
        className="rounded-lg p-4 shadow-lg max-w-3xl mx-auto border border-primary/20"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        <div className="flex items-center justify-between">
          <h2 id="modal-title" className="text-lg font-semibold">
            風ぐるまは初めてですか？
          </h2>
          <button
            ref={closeButtonRef}
            className="text-base-content/60 hover:text-base-content"
            onClick={handleClose}
            aria-label="閉じる"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
        <p id="modal-description" className="my-2">
          風ぐるまの使い方や基本情報を確認してみませんか？
        </p>
        <div className="flex gap-2 justify-end mt-3">
          <button
            className="btn btn-sm btn-outline"
            onClick={handleClose}
            data-testid="close-guide-modal"
          >
            後で見る
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleGoToGuide}
            data-testid="go-to-guide"
          >
            使い方を見る
          </button>
        </div>
      </div>
    </div>
  );
};

export default FirstVisitGuideModal;
