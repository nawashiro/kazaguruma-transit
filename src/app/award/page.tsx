import Image from "next/image";
import PageHeader from "@/components/layouts/PageHeader";

export default function AwardPage() {
  return (
    <div className="space-y-6 ruby-text">
      <PageHeader
        eyebrow="都知事杯オープンデータ・ハッカソン2025"
        title="受賞について"
        description={
          <>
          「風ぐるま乗換案内」の取組が、行政課題解決賞を受賞しました。
          </>
        }
      />

      <section className="card card-border bg-base-100 shadow-sm md:card-side">
        <figure className="shrink-0 bg-base-200 p-6 md:w-72">
          <a
            href="https://www.openbadge-global.com/ns/portal/openbadge/public/assertions/detail/RWRseGxrR0NmM0Q5QnAwdTdjeHFHdz09"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="オープンバッジを確認する（新しいタブで開く）"
          >
            <Image
              src="https://nlp.netlearning.co.jp/api/v1.0/openbadge/v2/Assertion/RWRseGxrR0NmM0Q5QnAwdTdjeHFHdz09/image"
              alt="行政課題解決賞のオープンバッジ"
              width={250}
              height={250}
              unoptimized
              className="h-auto w-48 md:w-56"
            />
          </a>
        </figure>

        <div className="card-body gap-4">
          <div>
            <h2 className="card-title inline text-xl ruby-text gap-0">
              行政課題解決賞
            </h2>
          </div>

          <dl className="grid gap-3">
            <div>
              <dt className="font-semibold">大会での選出</dt>
              <dd>サービス開発部門 ファイナリスト</dd>
            </div>
            <div>
              <dt className="font-semibold">授与日</dt>
              <dd>2025年10月25日</dd>
            </div>
            <div>
              <dt className="font-semibold">発行者</dt>
              <dd>東京都デジタルサービス局（都知事杯オープンデータ・ハッカソン運営事務局）</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="card card-border bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <h2 className="card-title inline ruby-text gap-0">評価された取組</h2>
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
              href="https://odhackathon.metro.tokyo.lg.jp/collection/54/?year=2025"
              target="_blank"
              rel="noopener noreferrer"
              className="btn text-base btn-neutral ruby-text gap-0 rounded-full dark:rounded-sm"
            >
              東京都の作品紹介を見る
            </a>
            <a
              href="https://www.openbadge-global.com/ns/portal/openbadge/public/assertions/detail/RWRseGxrR0NmM0Q5QnAwdTdjeHFHdz09"
              target="_blank"
              rel="noopener noreferrer"
              className="btn text-base btn-outline ruby-text gap-0 rounded-full dark:rounded-sm"
            >
              オープンバッジを確認する
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
