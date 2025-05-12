import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isFirstVisit } from "../../utils/visitTracker";
import { logger } from "../../utils/logger";

/**
 * 初回訪問ガイドモーダル
 * 初めてアプリを訪れたユーザーに表示される初心者ガイドへの誘導モーダル
 * クッキーポリシーのような控えめな下部表示
 */
const FirstVisitGuideModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // ページロード後に初回訪問かどうかを確認し、タイマーで少し遅らせて表示
    const timer = setTimeout(() => {
      const firstVisit = isFirstVisit();
      setIsOpen(firstVisit);

      if (firstVisit) {
        logger.log("初回訪問ポップアップが表示されました");
      }
    }, 1500); // 1.5秒後に表示して急すぎる印象を避ける

    return () => clearTimeout(timer);
  }, []);

  const handleGoToGuide = () => {
    setIsOpen(false);

    // イベント記録
    logger.log("初回訪問ポップアップからガイドページへ移動します");

    // Googleアナリティクスイベント送信
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "guide_popup_click", {
        event_category: "engagement",
        event_label: "beginners_guide_popup_navigation",
      });
    }

    router.push("/beginners-guide");
  };

  const handleClose = () => {
    setIsOpen(false);

    // イベント記録
    logger.log("初回訪問ポップアップが閉じられました");

    // Googleアナリティクスイベント送信
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "guide_popup_close", {
        event_category: "engagement",
        event_label: "beginners_guide_popup_dismissed",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 p-4 z-40 animate-slideUp"
      data-testid="first-visit-modal"
    >
      <div
        className="bg-white rounded-lg p-4 shadow-lg max-w-3xl mx-auto border border-primary/20"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-center justify-between">
          <h2 id="modal-title" className="text-lg font-semibold">
            風ぐるまは初めてですか？
          </h2>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={handleClose}
            aria-label="閉じる"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
        <p className="my-2">風ぐるまの使い方や基本情報を確認してみませんか？</p>
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
