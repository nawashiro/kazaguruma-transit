"use client";

import Card from "@/components/common/Card";

export default function Usage() {
  return (
    <div className="container ruby-text">
      <header className="text-center my-4">
        <h1 className="text-3xl font-bold">ライセンス</h1>
      </header>

      <main className="max-w-md mx-auto space-y-4">
        <Card className="shadow-md" title="本ソフトウェア">
          <div className="space-y-4">
            <p>© Nawashiro</p>
            <p>これはOSSではありません。</p>
            <a
              href="https://nawashiro.dev"
              className="link"
              target="_blank"
              rel="noopener noreferrer"
            >
              Nawashiroウェブサイト
            </a>
          </div>
        </Card>

        <Card className="shadow-md" title="千代田区主要施設座標データ">
          <p>東京都千代田区内の主要な施設の座標をまとめた json データです。</p>
          <ul>
            <li>
              <a
                href="https://github.com/nawashiro/chiyoda_city_main_facilities"
                className="link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Github
              </a>
            </li>
            <li>
              <a
                href="https://opendatacommons.org/licenses/odbl/"
                className="link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Database License (ODbL) 1.0
              </a>
            </li>
          </ul>
        </Card>

        <Card className="shadow-md" title="千代田区町名 geojson">
          <p>
            千代田区の町名までを含む geojson データです。丁目以降を含みません。
          </p>
          <ul>
            <li>
              <a
                href="https://github.com/nawashiro/chiyoda_city_town_geojson?tab=readme-ov-file#%E5%8D%83%E4%BB%A3%E7%94%B0%E5%8C%BA%E7%94%BA%E5%90%8D-geojson"
                className="link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Github
              </a>
            </li>
            <li>
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/deed.ja"
                className="link"
                target="_blank"
                rel="noopener noreferrer"
              >
                CC BY-SA 4.0
              </a>
            </li>
          </ul>
        </Card>

        <Card
          className="shadow-md"
          title="千代田区地域福祉交通「風ぐるま」GTFSデータ"
        >
          <p>データソースとライセンスは以下の通りです。</p>
          <ul>
            <li>
              <a
                href="https://ckan.odpt.org/dataset/hitachi_automobile_transportation_chiyoda_alllines"
                className="link"
                target="_blank"
                rel="noopener noreferrer"
              >
                日立自動車交通株式会社 / Hitachi Motor Transportation Co. Ltd.
              </a>
            </li>
            <li>
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                className="link"
                target="_blank"
                rel="noopener noreferrer"
              >
                CC BY 4.0
              </a>
            </li>
          </ul>
        </Card>
      </main>
    </div>
  );
}
