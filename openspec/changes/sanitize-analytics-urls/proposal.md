# Proposal

## Why

GAの手動ページビューに、出発地・目的地の座標を含むクエリが渡っている。検索URLの共有機能を保ちつつ、GAへの座標送信を防ぐ。

## What Changes

- GAへ送るURLからクエリとフラグメントを除く。
- 初期表示と画面遷移のページビューを明示的に送信する。
- GA管理画面の自動計測を確認し、URLを別経路で送る計測を無効化する。

## Capabilities

### New Capabilities

- `analytics-privacy`: GAに送信するURLの制限。

### Modified Capabilities

なし。

## Impact

`src/lib/analytics/useGA.ts` とGAウェブストリームの設定が対象。ブラウザーのURL、検索API、共有・ブックマークの動作は維持する。依存パッケージは追加しない。
