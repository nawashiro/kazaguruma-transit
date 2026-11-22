# Tasks

## 1. 母集団の絞り込み

- [x] 1.1 RED: `scripts/__tests__/generate-location-artifact.test.ts` に、目録にないrecordが`sources.locations`から落ちること、目録にだけあるOSM名なしentryが入らないこと、そのときもビルドが成功することを検査するテストを追加する。あわせて「projects all records with OSM names into dictionary-ordered locations」の名前と期待値を目録基準へ変え、実装前に失敗することを確認する。
- [x] 1.2 GREEN: `scripts/generate-location-artifact.ts` の`buildLocations`へ目録のID集合を渡し、集合外のrecordを`continue`で除外する。距離計算・停留所の読み込み・新しい取得元を追加していないことを確認する。
- [x] 1.3 `scripts/__tests__/generate-location-artifact.test.ts` を通し、`sources.routeDestinations`の件数とカテゴリ順が変わっていないことをテストで確認する。

## 2. artifact検証と地域導出

- [x] 2.1 `src/lib/location/__tests__/location-artifact.test.ts` に、`sources.locations`と`derivedRegions`のID集合が一致し、目録外IDが`derivedRegions`に残らないことを検査するテストを追加する。
- [x] 2.2 実データで`npx tsx scripts/generate-location-artifact.ts`または`npm run build`を実行し、`sources.locations`が目録の候補のうちOSM名がある集合（現データでは83件・18カテゴリ）と一致し、`derivedRegions`も同じID集合になることを確認する。ネットワーク取得ができない環境ではfixtureテストの結果を根拠にし、その旨を報告に残す。

## 3. ページと静的パラメータ

- [x] 3.1 カテゴリページ・詳細ページのテストフィクスチャから目録外の場所を外し、目録外IDの詳細要求が404になるテストを追加して、`src/app/locations/**/__tests__`を通す。
- [x] 3.2 `generateStaticParams`がartifactのカテゴリだけを返し、目録外カテゴリのページを作らないことをカテゴリページのテストで確認する。
- [x] 3.3 `src/app/__tests__/location-*`を通し、目録外の場所が一覧にも詳細にも現れないことを確認する。

## 4. ドキュメント

- [x] 4.1 `docs/how-to/update-location-data.md`の母集団の説明を「目的地目録の候補」へ更新し、公開JSON-LDに増えたrecordが`update-destinations`の実行まで一覧に出ないことと、件数の目安を更新後のartifactに合わせて直す。記載したコマンドをそのまま実行して、件数確認が動くことを確かめる。

## Workflow follow-up

- Archive the change after the spec delta and the docs are reviewed.
