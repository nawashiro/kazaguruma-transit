import { useEffect, useRef } from "react";
import { KeyLocation } from "@/utils/addressLoader";

interface LocationDetailModalProps {
  location: KeyLocation | null;
  onClose: () => void;
  onGoToLocation: (location: KeyLocation) => void;
  areaName: string | null;
}

export default function LocationDetailModal({
  location,
  onClose,
  onGoToLocation,
  areaName,
}: LocationDetailModalProps) {
  const modalRef = useRef<HTMLDialogElement>(null);

  // モーダルの開閉状態を制御
  useEffect(() => {
    if (location && modalRef.current) {
      modalRef.current.showModal();
    } else if (modalRef.current) {
      modalRef.current.close();
    }
  }, [location]);

  // ESCキーでモーダルを閉じる機能はdialog要素に組み込まれているので、追加実装は不要

  if (!location) return null;

  return (
    <dialog
      ref={modalRef}
      id="location_detail_modal"
      className="modal modal-bottom sm:modal-middle"
      onClose={onClose}
    >
      <div className="modal-box max-w-3xl">
        {/* 閉じるボタン */}
        <form method="dialog">
          <button
            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
            aria-label="閉じる"
          >
            ✕
          </button>
        </form>

        {/* タイトルと画像 */}
        <h3 className="font-bold text-xl mb-2 ">{location.name}</h3>
        {areaName && <p className="text-sm /60 mb-2">{areaName}</p>}

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
          <div className="mt-4 ruby-text">
            <h4 className="font-semibold text-lg mb-2 ">説明</h4>
            <p className="text-sm ">{location.description}</p>
          </div>
        )}

        {/* リンク */}
        {location.uri && (
          <div className="mt-4">
            <a
              href={location.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="link"
            >
              ウェブサイトを
              <ruby>
                見<rt>み</rt>
              </ruby>
              る
            </a>
          </div>
        )}

        {/* 著作権情報 */}
        <div className="mt-6 bg-base-100 p-3 rounded-lg ruby-text">
          <h4 className="font-semibold text-sm mb-2 ">提供情報</h4>
          <div className="text-xs space-y-2">
            <p className="/90">座標データ提供: {location.nodeCopyright}</p>

            {location.imageCopyright && (
              <p className="/90">画像提供: {location.imageCopyright}</p>
            )}

            {location.description && location.descriptionCopyright && (
              <p className="/90">説明文提供: {location.descriptionCopyright}</p>
            )}

            <div className="/90">
              ライセンス:
              <a
                href={location.licenceUri}
                target="_blank"
                rel="noopener noreferrer"
                className="link ml-1"
              >
                {location.licence}
              </a>
            </div>
          </div>
        </div>

        {/* アクションボタン */}
        <div className="modal-action">
          <button
            className="btn btn-primary inline ruby-text rounded-full dark:rounded-sm min-h-10 h-fit"
            onClick={() => {
              onGoToLocation(location);
              onClose();
            }}
          >
            <span>ここへ行く</span>
          </button>
          <form method="dialog">
            <button className="btn inline ruby-text rounded-full dark:rounded-sm min-h-10 h-fit">
              <span>閉じる</span>
            </button>
          </form>
        </div>
      </div>

      {/* 背景をクリックしても閉じられるようにする */}
      <form method="dialog" className="modal-backdrop">
        <button>閉じる</button>
      </form>
    </dialog>
  );
}
