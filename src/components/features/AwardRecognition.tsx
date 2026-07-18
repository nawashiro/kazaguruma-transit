import Image from "next/image";
import Link from "next/link";
import {
  AWARD_BADGE_IMAGE_URL,
  AWARD_NAME,
  AWARD_PRIZE,
} from "@/lib/award/award-data";

/** ホーム画面で受賞実績を簡潔に伝えるカード。 */
export default function AwardRecognition() {
  return (
    <aside
      aria-label="受賞のお知らせ"
      className="card card-border bg-base-100 shadow-sm"
    >
      <div className="flex items-center">
        <figure className="w-24 shrink-0 p-3 pr-0">
          <Image
            src={AWARD_BADGE_IMAGE_URL}
            alt={`${AWARD_PRIZE}のオープンバッジ`}
            width={76}
            height={76}
            unoptimized
            className="h-auto w-full"
          />
        </figure>
        <div className="card-body gap-1 p-4 text-base ruby-text">
          <p className="font-semibold">{AWARD_NAME}</p>
          <p className="font-bold">{AWARD_PRIZE}を受賞しました</p>
          <Link href="/award" className="link w-fit font-medium">
            受賞について詳しく見る
          </Link>
        </div>
      </div>
    </aside>
  );
}
