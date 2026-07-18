import Image from "next/image";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import {
  AWARD_BADGE_IMAGE_URL,
  AWARD_BADGE_URL,
  AWARD_FINALIST_CATEGORY,
  AWARD_ISSUED_DATE,
  AWARD_ISSUER,
  AWARD_NAME,
  AWARD_PRIZE,
  AWARD_PROJECT_URL,
} from "@/lib/award/award-data";

export default function AwardPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 ruby-text">
      <header className="space-y-3 text-center">
        <p className="text-base font-semibold">{AWARD_NAME}</p>
        <h1 className="text-3xl font-bold">受賞について</h1>
        <p className="text-lg">
          「風ぐるま乗換案内」の取組が、{AWARD_PRIZE}を受賞しました。
        </p>
      </header>

      <section className="card card-border bg-base-100 shadow-sm md:card-side">
        <figure className="shrink-0 bg-base-200 p-6 md:w-72">
          <a
            href={AWARD_BADGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="オープンバッジを確認する（新しいタブで開く）"
          >
            <Image
              src={AWARD_BADGE_IMAGE_URL}
              alt={`${AWARD_PRIZE}のオープンバッジ`}
              width={250}
              height={250}
              unoptimized
              className="h-auto w-48 md:w-56"
            />
          </a>
        </figure>

        <div className="card-body gap-4 text-base">
          <div>
            <h2 className="card-title text-xl">
              <span className="ruby-text">{AWARD_PRIZE}</span>
            </h2>
          </div>

          <dl className="grid gap-3">
            <div>
              <dt className="font-semibold">大会での選出</dt>
              <dd>{AWARD_FINALIST_CATEGORY}</dd>
            </div>
            <div>
              <dt className="font-semibold">授与日</dt>
              <dd>{AWARD_ISSUED_DATE}</dd>
            </div>
            <div>
              <dt className="font-semibold">発行者</dt>
              <dd>{AWARD_ISSUER}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="card card-border bg-base-100 shadow-sm">
        <div className="card-body gap-4 text-base">
          <h2 className="card-title">
            <span className="ruby-text">評価された取組</span>
          </h2>
          <p>
            複雑な時刻表をわかりやすくする経路検索、オープンデータを活用した
            千代田区の施設案内、利用者の経験を共有する意見交換機能を、一つの
            ウェブサービスとして提供している点が紹介されています。
          </p>
          <p>
            このサービスは非公式ですが、行政や利用者との対話を重ねながら、
            地域福祉交通をより使いやすくするために開発を続けています。
          </p>

          <div className="card-actions flex-col items-stretch sm:flex-row">
            <a
              href={AWARD_PROJECT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-neutral rounded-full text-base dark:rounded-sm"
            >
              <span className="ruby-text">東京都の作品紹介を見る</span>
              <ArrowTopRightOnSquareIcon className="h-5 w-5" aria-hidden="true" />
            </a>
            <a
              href={AWARD_BADGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline rounded-full text-base dark:rounded-sm"
            >
              <span className="ruby-text">オープンバッジを確認する</span>
              <ArrowTopRightOnSquareIcon className="h-5 w-5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
