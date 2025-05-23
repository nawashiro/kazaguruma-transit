import { useEffect, useRef } from "react";
import { KeyLocation } from "../utils/addressLoader";

interface LocationDetailModalProps {
  location: KeyLocation | null;
  isOpen: boolean;
  onClose: () => void;
  onGoToLocation: (location: KeyLocation) => void;
  areaName: string | null;
}

export default function LocationDetailModal({
  location,
  isOpen,
  onClose,
  onGoToLocation,
  areaName,
}: LocationDetailModalProps) {
  // モーダル内の要素の参照
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusableElementRef = useRef<HTMLButtonElement>(null);

  // モーダルが開いたときにフォーカスを設定
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      // 開く前のアクティブな要素を保存
      const activeElement = document.activeElement as HTMLElement;

      // モーダルが開いたときに閉じるボタンにフォーカス
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);

      // モーダルが閉じたときに前のアクティブ要素に戻す
      return () => {
        if (activeElement) {
          setTimeout(() => {
            activeElement.focus();
          }, 50);
        }
      };
    }
  }, [isOpen]);

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [isOpen, onClose]);

  // フォーカストラップの実装
  useEffect(() => {
    const handleTabKey = (event: KeyboardEvent) => {
      if (!isOpen || !modalRef.current) return;

      // タブキーが押されたとき
      if (event.key === "Tab") {
        // モーダル内のフォーカス可能な要素を取得
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[
          focusableElements.length - 1
        ] as HTMLElement;

        // Shift + Tabが押されたとき
        if (event.shiftKey) {
          // 最初の要素にフォーカスがあるときは最後の要素にフォーカスを移動
          if (document.activeElement === firstElement) {
            lastElement.focus();
            event.preventDefault();
          }
        } else {
          // 最後の要素にフォーカスがあるときは最初の要素にフォーカスを移動
          if (document.activeElement === lastElement) {
            firstElement.focus();
            event.preventDefault();
          }
        }
      }
    };

    document.addEventListener("keydown", handleTabKey);
    return () => {
      document.removeEventListener("keydown", handleTabKey);
    };
  }, [isOpen]);

  if (!isOpen || !location) return null;

  return (
    <div
      className="modal modal-open z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div ref={modalRef} className="modal-box max-w-3xl relative z-50">
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="btn btn-sm btn-circle absolute right-2 top-2"
          aria-label="閉じる"
        >
          ✕
        </button>

        {/* タイトルと画像 */}
        <h3 id="modal-title" className="font-bold text-xl mb-2">
          {location.name}
        </h3>
        {areaName && <p className="text-sm text-gray-500 mb-2">{areaName}</p>}

        {location.imageUri && (
          <figure className="relative h-64 w-full overflow-hidden mb-4">
            <img
              src={location.imageUri}
              alt={location.name}
              className="object-cover w-full h-full"
            />
          </figure>
        )}

        {/* 説明文（全文表示） */}
        {location.description && (
          <div className="mt-4">
            <h4 className="font-semibold text-lg mb-2">説明</h4>
            <p className="text-sm">{location.description}</p>
          </div>
        )}

        {/* リンク */}
        {location.uri && (
          <div className="mt-4">
            <a
              href={location.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="link link-primary"
              aria-label={`${location.name}のウェブサイトを開く（新しいタブで開きます）`}
            >
              ウェブサイトを見る
            </a>
          </div>
        )}

        {/* 著作権情報 */}
        <div className="mt-6 bg-base-200 p-3 rounded-lg">
          <h4 className="font-semibold text-sm mb-2">提供情報</h4>
          <div className="text-xs space-y-2">
            <p>座標データ提供: {location.nodeCopyright}</p>

            {location.imageCopyright && (
              <p>画像提供: {location.imageCopyright}</p>
            )}

            {location.description && location.descriptionCopyright && (
              <p>説明文提供: {location.descriptionCopyright}</p>
            )}

            <div>
              ライセンス:
              <a
                href={location.licenceUri}
                target="_blank"
                rel="noopener noreferrer"
                className="link link-primary ml-1"
                aria-label={`ライセンス情報を開く（新しいタブで開きます）`}
              >
                {location.licence}
              </a>
            </div>
          </div>
        </div>

        {/* アクションボタン */}
        <div className="modal-action">
          <button
            className="btn btn-primary"
            onClick={() => {
              onGoToLocation(location);
              onClose();
            }}
          >
            ここへ行く
          </button>
          <button
            className="btn"
            onClick={onClose}
            ref={lastFocusableElementRef}
          >
            閉じる
          </button>
        </div>
      </div>
      <div
        className="modal-backdrop bg-black bg-opacity-50 z-40"
        onClick={onClose}
        role="presentation"
      ></div>
    </div>
  );
}
