# Phase 0 Research - Discussion NDK Migration

## Inputs Reviewed

- Feature spec: `/specs/008-document-discussion-spec/spec.md`
- Constitution: `/.specify/memory/constitution.md`
- Legacy docs:
  - `/docs/discussion/spec.md`
  - `/docs/discussion/spec_v2.md`
  - `/docs/discussion/NIP-01.md`
  - `/docs/discussion/NIP-18.md`
  - `/docs/discussion/NIP-25.md`
  - `/docs/discussion/NIP-72.md`
- External docs:
  - DaisyUI LLM guide: `https://daisyui.com/llms.txt`
  - NDK docs index: `https://nostr-dev-kit.github.io/ndk/`
  - NDK repo docs: `https://github.com/nostr-dev-kit/ndk/tree/master/docs`
  - NDK guides/examples mirror:
    - `https://ndk.fyi/docs/`
    - `https://ndk.fyi/docs/core/events`
    - `https://ndk.fyi/docs/core/signers`
    - `https://ndk.fyi/docs/events/kinds`

## Decision 1: `nostr-tools`を全面廃止し、Nostr責務をNDKへ集約

- Decision: `nostr-tools`への直接依存を撤去し、`@nostr-dev-kit/ndk`を唯一のNostr SDKとして採用する。
- Rationale:
  - NDKは接続・購読・イベント生成・署名連携を統合して提供し、既存の独自ラッパー重複を削減できる。
  - "NDK責務を侵さない"という必須条件に直接整合する。
  - 通信フローをNDK中心へ寄せることで、今後のNIP拡張追従を容易化できる。
- Alternatives considered:
  - `nostr-tools`継続 + 自前抽象化維持: 既存の漏れ込みと責務重複を解消できないため不採用。
  - `nostr-tools`とNDKの併用: 二重依存と境界曖昧化を生むため不採用。

## Decision 2: UIはDaisyUIの責務を優先し、独自UIは最小化

- Decision: discussion UIはDaisyUIコンポーネントを第一選択とし、同等責務の独自実装を禁止する。
- Rationale:
  - 要件で明示された`MUST`に一致。
  - llms.txtの推奨（既存コンポーネント活用、アクセシブルな属性利用）と整合。
  - 一貫したUI状態表現（loading/empty/error/disabled）を低コストで維持できる。
- Alternatives considered:
  - 全面独自UI: 要件違反、保守性低下のため不採用。
  - DaisyUIと独自UI混在（役割重複）: ルック&フィール崩壊のため不採用。

## Decision 3: `src/lib/nostr`外へのNostr実装漏れを段階的に回収

- Decision: `src/lib/nostr`外の`nostr-tools`型/関数参照を全件洗い出し、アプリ共通DTOまたはNDKラッパー経由へ移行する。
- Rationale:
  - 漏れ込み調査で、UI/auth/discussion/typesまで`nostr-tools`型依存が拡散していることを確認。
  - NDK置換時に境界外依存を残すと再び責務侵害が発生する。
- Alternatives considered:
  - `src/lib/nostr`内だけ置換: 参照先で`nostr-tools`が残留し、全面廃止要件を満たせないため不採用。

## Decision 4: NIP整合性は「NDK上でのイベント契約テスト」で担保

- Decision: NIP-01/18/25/72の整合性は、NDKイベント生成時のkind/tag/content規約を契約テストで固定化する。
- Rationale:
  - 現行要件はkind/tag構成に強く依存（1111, 34550, 4550, 7, q/a/e/p/k）。
  - SDK置換時の最大リスクはイベント形式崩れであり、契約テストが最短で検出可能。
- Alternatives considered:
  - 手動目視レビューのみ: 回帰検知が遅く漏れやすいため不採用。

## Decision 5: 通信フローは「UI -> UseCase -> NDK Gateway -> Relay」で統一

- Decision: 画面層からrelayへ直接アクセスせず、ユースケース層経由でNDK Gatewayに集約する。
- Rationale:
  - 通信フローをプラン明記する必須条件を満たす。
  - 権限判定/UI状態管理とNostrイベント入出力を分離できる。
- Alternatives considered:
  - 画面ごとにNDK直呼び: 重複・不整合増加のため不採用。

## NDK Capability Mapping (for this feature)

- Relay接続管理: NDKのリレー管理機能を利用（接続・再接続・複数relay扱い）。
- 購読/取得: 会話、投稿、承認、評価、監査イベントをNDK購読/クエリAPIで取得。
- イベント生成: NIP準拠kind/tagをNDKイベントモデルで生成。
- 署名: NDK signerを採用し、既存Passkey運用との接続ポイントをGateway層で統一。
- 発行: 署名済みイベントをNDK publishフローで送信。

## Nostr Leakage Scan (outside `src/lib/nostr`)

直接`nostr-tools`参照検出（主要）:

- `src/types/discussion.ts`
- `src/lib/auth/auth-context.tsx`
- `src/lib/discussion/user-creation-flow.ts`
- `src/components/discussion/*.tsx`（複数）
- `src/app/discussions/**/*.tsx`（複数）
- `src/app/settings/page.tsx`

移行方針:

1. 共有型`Event`依存をアプリDTOへ置換。
2. ページ/コンポーネントはNDK固有型を持たず、`src/lib/nostr`のGateway戻り値のみ受け取る。
3. `nostr-tools` importが0件になるまでCIで検証。

## Resolved Clarifications

- NDK docs参照元: 取得可能な公式 docs / repo docs / ndk.fyiを使用。
- DaisyUI参照元: `llms.txt`を指針として採用。
- NIPs参照元: nostrbook.dev の `llms.txt` を指針として採用。
- 通信フロー明記: plan.mdとquickstart.mdに記載。
- `nostr-tools`廃止範囲: discussion機能全体と漏れ込み箇所を対象に全面撤去。

## Addendum (2026-03-01): NDKシングルトン推奨の確認

- NDK公式README（npm公開ドキュメント）では、利用時に「単一インスタンスを生成して使い回す」方針が明示されている。
- 根拠:
  - https://www.npmjs.com/package/@nostr-dev-kit/ndk
  - 上記ページのREADMEセクション（"Users of NDK should instantiate a single NDK instance ..."）
- 設計反映方針:
  1. 画面/コンポーネントごとの `createNostrService()` 多重生成を避ける。
  2. relay接続と購読管理を単一NDKインスタンスへ集約し、遷移方式（ナビゲーション/再読込/直アクセス）による挙動差を縮小する。
  3. 非ストリーミング前提の画面（会話一覧・会話詳細・設定・監査初回表示）は read API を優先し、リアルタイム購読は必須要件として扱わない。
