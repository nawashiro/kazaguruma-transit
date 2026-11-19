# Design

## Context

場所データのビルドは `scripts/generate-location-artifact.ts` が担う。`prebuild` から呼ばれ、5つの公開ソースを取得・検証し、`public/generated/location-data.json` を一度だけ原子的に書く。`transport` と `writeArtifact` を注入できるため、単体テストはネットワークなしで動く。実行時は `src/lib/location/location-artifact.ts` が同じartifactを読み、一覧と詳細が `<img src={imageUri}>` でWikimediaの原寸を直接参照している。

制約は次のとおり。

- 場所写真は38件あり、すべて `upload.wikimedia.org/wikipedia/commons/` の原寸JPEGである。実測29件で82.6MB、最大7.8MB。
- Wikimediaは直接取得できるサムネイル幅を標準サイズ（20・40・60・120・250・330・500・960・1280・1920・3840px）に限る。これ以外の幅は400を返す。短時間の連続取得には429を返す。
- `Special:FilePath/<file>?width=1280` は1280px以下の標準サムネイルへリダイレクトし、元画像が1280px未満なら原寸を返す。直接の `thumb/.../1280px-` URLは、元画像が小さい場合に拡大した画像を返す（850pxの元画像から1280pxのサムネイルが生成されることを確認済み）。
- Nextは `public/` 配下のファイルへ `/_next/static` のような長期キャッシュを自動では付けない。`next.config.ts` の `headers()` で明示する必要がある。
- `sharp` 0.35.5 は `next` の依存として解決済みで、`next/image` を使う既存ページの実行時最適化にも使われる。`package.json` の `overrides` で固定している。
- 一覧と詳細は `force-dynamic` で、画像はビルド成果物として配信する。artifactは `public/generated/` にあり、git管理外である。

## Goals / Non-Goals

**Goals:**

- 写真の取得・変換・配信をビルド時に完結させ、HTMLにWikimediaのURLを残さない。
- モバイルで1ページあたり数百KB以下に収める。
- 派生画像を内容に応じたURLと長期キャッシュで配信する。
- 写真1枚の失敗でビルドや他の写真を巻き込まない。

**Non-Goals:**

- AVIFの生成。WebPで十分な削減ができ、エンコード時間と `<picture>` の分岐が増える。
- `next/image` への移行。最適化済みの静的ファイルを再エンコードする二重処理になる。
- 帰属表示の文言変更。作者・ライセンスの表示は現状を維持する。
- `force-dynamic` の解除、artifactのJSONキャッシュ、画像CDNの導入。
- 場所ページ以外の画像最適化。

## Decisions

### 1. 既存のartifact生成に画像解決を組み込む

画像の取得と変換を `generateLocationArtifact` の中で行い、`location-data.json` を一度だけ書く。取得は既存の `transport` と同じ形のバイナリ取得関数、変換はエンコード関数として注入し、単体テストではsharpを動かさない。

代替案は、artifact生成の後に別スクリプトで画像を作り、2つ目のマニフェストを読む方法である。ファイルは分かれるが、場所と写真の対応を二重に検証し、ページで2つのartifactを突き合わせる必要がある。仕様が「ビルド時に写真を解決する」と定める以上、1つのartifactにまとめるほうが検証も読み込みも1回で済む。

### 2. 取得元は `Special:FilePath` の1280pxを使う

各写真の取得URLは、`contentUrl` のファイル名から `https://commons.wikimedia.org/wiki/Special:FilePath/<file>?width=1280` を組み立てる。これにより、標準サイズの制約を守りながら、元画像が小さい場合の拡大を避けられる。

代替案は、直接の `thumb/.../1280px-` URLである。ビルド通信は最小になるが、元画像が1280px未満の写真で拡大画像をつかむ。もう一つの代替案は原寸の取得で、29枚だけで82.6MBになるため採らない。

`upload.wikimedia.org/wikipedia/commons/` 以外の写真は対象外とし、失敗として扱う。現在のデータに存在せず、対応するウィキを決める情報をartifactが持たないためである。

取得は同時2接続、間隔を空け、`KazagurumaTransit/1.0 (+https://github.com/nawashiro/kazaguruma-transit)` のUser-Agentを送る。429または5xxでは `Retry-After` を尊重し、指数バックオフで最大3回再試行する。

### 3. 派生画像はWebP 480・960・1280px、内容ハッシュ名

`sharp` でEXIFの向きを適用したうえで、幅480・960・1280pxのWebP（品質80）を生成する。元画像の幅が候補より小さい場合は、その幅を候補に置き換える（700pxの写真なら480pxと700px）。元画像を拡大しない（`withoutEnlargement`）。ファイル名は出力バイトのSHA-256先頭16桁と幅から `public/generated/location-images/<hash>-<width>.webp` とする。

URLのハッシュを内容ハッシュにする理由は、Commonsでは同じURLのままファイルが差し替わり得るためである。URL由来の名前だと、差し替え後もimmutableキャッシュが古い画像を返し続ける。内容ハッシュなら再生成でURLが変わり、キャッシュが自然に無効化される。

1280pxで止める理由は、詳細ページの最大表示幅が `max-w-4xl` から `px-4` を引いた864pxで、1280pxはDPR2で約1.5倍に相当するためである。1920pxはバイト数が倍近く増え、この画面では差が見えにくい。

代替案のAVIFは960pxで1枚あたり約1.6秒かかり、38枚で1分以上増える。WebPで480px 16KB・960px 46KB（512KBの元画像）まで下がるため、今回はWebPだけにする。

### 4. artifactには派生画像の情報だけを追加する

`LocationEntry` に任意の `image` を追加する。

```
image?: {
  width: number;   // 元画像の幅（EXIF適用後）
  height: number;
  variants: Array<{ width: number; path: "/generated/location-images/<hash>-<width>.webp" }>;
}
```

既存の `imageUri`・`imageCreator`・`imageLicense` は残す。`imageUri` は取得元の記録であり、ページは参照しない。`image` がない場所は写真を表示しない。`path` は同一オリジンのパスで、`/generated/location-images/` の外や `..` を含む値はartifactの検証で不正とする。

代替案は別ファイルのマニフェストだが、決定1と同じ理由で採らない。`imageUri` を削る案は、取得元とライセンスの追跡ができなくなるため採らない。

### 5. ページは派生画像を `srcset` で選ぶ

`resolveLocationImage` は作者・ライセンス・派生画像を返し、派生画像が1つもない場合は `null` を返す。一覧カードと詳細は通常の `<img>` を使い、`next/image` は使わない。`srcset` は生成済みの幅を小さい順に並べ、`sizes` は次のとおり。

- 一覧カード: `(min-width: 1024px) 277px, (min-width: 768px) calc((100vw - 48px) / 2), calc(100vw - 32px)`
- 場所詳細: `(min-width: 896px) 864px, calc(100vw - 32px)`

カードは `loading="lazy"`、詳細の先頭写真は `loading="eager"` と `fetchpriority="high"` にする。どちらも `width`・`height` に元画像の寸法を入れ、`decoding="async"`、`alt=""` を付ける。表示の大きさは既存のCSSクラスが決めるため、属性は領域確保のためだけに使う。

`next/image` を使わない理由は、静的ファイルを `/_next/image` で再度エンコードする二重処理になり、リモート最適化に切り替えると実行時取得の禁止に反するためである。

### 6. キャッシュは `headers()` で `location-images` だけに付ける

`next.config.ts` に `/generated/location-images/:path*` の `Cache-Control: public, max-age=31536000, immutable` を追加する。`public/` 全体に付けないのは、`location-data.json` をブラウザへ長期キャッシュさせないためである。

### 7. 写真の失敗はその写真だけ落とす

取得・変換に失敗した写真は `image` なしでartifactに載せ、警告に「取得できなかった写真の件数」を出す。ビルドは続行し、原寸URLへのフォールバックはしない。原寸へ戻すと、そのページだけ通信量が元に戻り、失敗が利用者に見えないまま残るためである。

代替案のビルド失敗は、1枚の429で配信を止めることになり、写真が本質でない場所ページには過剰である。全滅した場合は警告の件数が38に近づくため、CIのログとドキュメントの件数で気づける。

### 8. ビルドのたびに生成し、生成物はリポジトリとDockerの文脈に残さない

`prebuild` で毎回取得・生成する。画像だけ古いまま残る状態を作らず、取得元の変化を次のビルドで拾える。開発はREADMEのとおり `npm run build` の後に `npm run dev` を起動するため、直前のビルド成果物をそのまま使う。生成の前に `public/generated/location-images/` を空にし、参照されない古いファイルを残さない。

`public/generated/` を `.dockerignore` に追加し、ローカルに残った生成物がDockerのビルド文脈に入らないようにする。Docker内のビルドは常に新しい成果物を作る。

### 9. sharpを直接依存にする

`sharp` を `dependencies` に追加する。ビルドスクリプトが使うだけでなく、既存の `next/image` ページ（`/usage`、`/award`）の実行時最適化にも必要で、`npm prune --production` の後も残す必要がある。バージョンは既存の `overrides` と同じ0.35.5に合わせる。

## Risks / Trade-offs

- [Wikimediaの429や遮断で写真が欠ける] → 同時2接続・間隔・`Retry-After` 尊重の再試行で抑える。失敗件数を警告し、ドキュメントの「38件」と照合する。全滅しても場所ページ自体は動く。
- [ビルド時間が1〜2分延びる] → ダウンロードは約8MB、エンコードは38枚×3幅で数十秒の見込み。CIのタイムアウト20分に対して余裕がある。
- [Commonsで同じURLのファイルが差し替わる] → 内容ハッシュ名なのでURLが変わる。次のビルドで新しい派生画像が配信される。
- [帰属表示とCC BYの「変更の表示」] → 作者とライセンスの表示は維持する。解像度変換は著作者の同一性を変えない技術的変更として扱い、文言は変えない。必要になれば別の変更で注記を追加する。
- [`Special:FilePath` のリダイレクトが遅い、または塞がれる] → 失敗として扱い、その写真だけ落とす。直接サムネイルURLへのフォールバックは、拡大画像の混入と二重実装を避けるため持たない。
- [既存テストが原寸URLの `src` を期待している] → 同じ変更で、派生画像のパス・`srcset`・`loading` を確認する期待へ更新する。
- [Commons以外のウィキの写真がデータに増える] → 対象外として警告に出る。必要になった時点で、ウィキごとの取得先を設計する。

## Migration Plan

1. `sharp` を依存に追加し、`.dockerignore` に `public/generated/` を追加する。
2. ビルドスクリプトとartifactの検証を先に変え、`npm run build` で `public/generated/location-data.json` に `image` が入ることを確認する。
3. ページを派生画像の配信へ切り替え、派生画像のキャッシュヘッダーを追加する。
4. `docs/how-to/update-location-data.md` の件数と確認手順を更新する。
5. デプロイ後、一覧と詳細のNetworkパネルで `upload.wikimedia.org` へのリクエストが0件であること、写真の合計が数百KB以下であることを確認する。

ロールバックは変更をrevertして再ビルドする。artifactは毎回生成されるため、データ移行はない。
