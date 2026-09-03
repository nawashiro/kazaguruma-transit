# Issue #87 公開アプリ設定移行 Quickstart

## 前提

- Node.js 22.23.2
- リポジトリルート `/opt/data/kazaguruma-transit`
- 公開設定は`app-config.json`を編集する
- GTFS importを実行する場合は、既存どおりserver-sideの`transit-config.json`を用意する
- Google Mapsを使う場合は`.env.local`に`GOOGLE_MAPS_API_KEY`を設定する

`NEXT_PUBLIC_*`環境変数、Docker build args、Dockerfileが生成する`.env`は使用しない。

## 設定

1. `app-config.json`を配布先の公開設定に編集する。
2. `discussion`を利用しない場合は`enabled: false`とし、list naddrは空にする。
3. Ko-fi表示を変更する場合は`support.enabled`、`support.koFiUsername`、`support.heading`、
   `support.message`を変更する。`FUNDING.yml`の`ko_fi`はアプリ表示を制御しない。
4. GTFS設定は`transit-config.json.example`から別途作成する。これは公開JSONへコピーしない。

## focused validation

```bash
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm install
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand --runTestsByPath \
  src/lib/config/__tests__/app-config.test.ts \
  __tests__/app-config-contract.test.ts \
  src/lib/config/__tests__/discussion-config.test.ts \
  src/lib/config/__tests__/ko-fi-config.test.ts \
  __tests__/ko-fi-content-config.test.ts \
  __tests__/docker-secret-handling.test.ts
```

期待結果: 設定schema、consumer mapping、public env除去、Ko-fi移行、Docker secret契約がすべてpass。
外部relay、Google Analytics、Google Maps API、Ko-fi iframeへの実送信はこのfocused validationに含めない。

## 全検証

```bash
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npx tsc --noEmit --incremental false
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm run lint
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm run build
```

`npm run build`はPrisma generate、schema push、GTFS import、Next production buildを含む。`transit-config.json`
がない環境では既存GTFS importの設定エラー表示が出る可能性があるため、終了コードとNext buildの完了を
分けて記録する。今回の変更由来でないwarningを成功と混同しない。

## Docker確認

Dockerを使う場合も公開設定は`COPY`された`app-config.json`から読まれる。Composeへ公開値をbuild argとして
渡さず、`transit-config.json`だけを既存secret mountでbuild/runtimeへ渡す。次を確認する。

```bash
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand --runTestsByPath \
  __tests__/app-config-contract.test.ts __tests__/docker-secret-handling.test.ts
```

期待結果: Dockerfile/Composeに`NEXT_PUBLIC_*`のARGや`.env`生成がなく、transit secretの除外・mount契約は
維持される。
