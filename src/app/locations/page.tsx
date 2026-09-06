import generatedLocationData from "@/generated/location-data.json";
import PageHeader from "@/components/layouts/PageHeader";
import Card from "@/components/ui/Card";
import CarouselCard from "@/components/ui/CarouselCard";
import type { LocationDataSnapshot } from "@/types/location-pages";

const locationData: LocationDataSnapshot = generatedLocationData;

export default function LocationsPage() {
  return (
    <>
      <PageHeader
        title="場所をさがす"
        description="位置とカテゴリから千代田区のスポットをさがす"
      />

      <div className="space-y-4">
        <Card title="カテゴリを選択">
          <nav aria-label="施設カテゴリ">
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {locationData.categories.map((category) => (
                <li key={category.id}>
                  <a
                    href={`/locations/${encodeURIComponent(category.id)}`}
                    className="link block min-h-[44px] rounded-lg border border-base-300 p-3 text-base"
                  >
                    {category.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </Card>

        <div className="carousel w-full">
          <CarouselCard
            id="slide1"
            title="悩みがあるけど、どうしたらいい？"
            prevSlideId="slide3"
            nextSlideId="slide2"
          >
            <p className="text-base mb-2">
              支援が欲しいけど、なにがあるのかわからない。
              <br />
              あてはまる悩みにチェックをつけると、役立つ支援がわかります。
            </p>
            <a
              href="https://compass.graffer.jp/handbook/landing"
              target="_blank"
              rel="noopener noreferrer"
              className="btn text-base btn-outline gap-0 w-fit h-fit rounded-full dark:rounded-sm"
            >
              お悩みハンドブックウェブサイトへ
            </a>
          </CarouselCard>

          <CarouselCard
            id="slide2"
            title="今夜、安心して泊まれる場所がない"
            prevSlideId="slide1"
            nextSlideId="slide3"
          >
            <p className="text-base mb-2">
              帰る家はありますか？
              <br />
              あったとして、安心できる場所ですか？
              <br />
              こちらから緊急お助けパックを受け取ってください。
            </p>
            <a
              href="https://sekaibivouac.jp/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn text-base btn-outline gap-0 w-fit h-fit py-2 inline rounded-full dark:rounded-sm"
            >
              <p>せかいビバークウェブサイトへ</p>
            </a>
          </CarouselCard>

          <CarouselCard
            id="slide3"
            title="イベントを知る"
            prevSlideId="slide2"
            nextSlideId="slide1"
          >
            <p className="text-base mb-2">
              千代田区で開催されるイベント情報はこちら。
            </p>
            <a
              href="https://chiyolab.jp/comunity_event"
              target="_blank"
              rel="noopener noreferrer"
              className="btn text-base btn-outline gap-0 w-fit h-fit py-2 inline rounded-full dark:rounded-sm"
            >
              ちよだコミュニティラボ
            </a>
            <a
              href="https://visit-chiyoda.tokyo/app/event"
              target="_blank"
              rel="noopener noreferrer"
              className="btn text-base btn-outline gap-0 w-fit h-fit py-2 inline rounded-full dark:rounded-sm"
            >
              千代田区観光協会
            </a>
            <a
              href="https://www.city.chiyoda.lg.jp/cgi-bin/event_cal_multi/calendar.cgi"
              target="_blank"
              rel="noopener noreferrer"
              className="btn text-base btn-outline gap-0 w-fit h-fit py-2 inline rounded-full dark:rounded-sm"
            >
              千代田区ウェブサイト
            </a>
          </CarouselCard>
        </div>

        <Card title="データ提供元" className="ruby-text">
          <p>
            この場所データは、ボランティアがつくった
            <a
              href="https://github.com/nawashiro/chiyoda_city_main_facilities"
              target="_blank"
              rel="noopener noreferrer"
              className="link"
            >
              千代田区主要施設座標データ
            </a>
            による「
            <ruby>
              風<rt>かざ</rt>
            </ruby>
            ぐるまの停留所から徒歩圏内（600m以内）であることがわかっている場所」を使用しています。
          </p>
          <p>
            誤りが含まれていたり、古いデータが残っていたり、新たに加えてほしい場所があるときは、直接プルリクエストを送るか、
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSeZ1eufe_2aZkRWQwr-RuCceUYUMJ7WmSfUr1ZsX5QTDRqFKQ/viewform?usp=header"
              target="_blank"
              rel="noopener noreferrer"
              className="link"
            >
              こちらのフォーム
            </a>
            からお知らせください。
          </p>
          <p>写真のご提供も歓迎しています。</p>
        </Card>
      </div>
    </>
  );
}
