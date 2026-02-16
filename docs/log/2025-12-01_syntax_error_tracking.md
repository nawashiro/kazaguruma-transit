# Syntax Error Tracking (tsc --noEmit)

- Command: `npx tsc --noEmit`
- Result: `src/lib/auth/auth-context.tsx(72,45): error TS2345: Argument of type 'Event[]' is not assignable to parameter of type 'Event'.`

## (1) 該当部分の実装意図
- `src/lib/auth/auth-context.tsx:67-79` の `loadProfile` で、ログイン済みユーザーの pubkey を基に Nostr プロファイルを取得し、`parseProfileEvent` でパースして `user.profile` に格納するのが目的。
- `nostrService.getProfile([pubkey])` を「単一ユーザーの最新プロフィールを返す」前提で呼び出している。

## (2) なぜ発生するか
- `nostrService.getProfile` は `Promise<Event[]>`（配列）を返す実装になっており、AuditLog 等では配列前提で利用している。
- `parseProfileEvent` のシグネチャは `Event` 単体を要求するため、`Event[]` を渡す現在の呼び出しは型不整合となり `TS2345` で落ちる。コンパイルさえ通れば実行時にも `Array` に対して `event.kind` を読む箇所で例外になり得る。

## (3) 修正にかかる工数（目安）
- 最小対応（推奨・~0.5h): `loadProfile` で `getProfile` の戻り値から先頭要素を取り、存在チェックした上で `parseProfileEvent` に渡す。型注釈も `Event[]` 前提に合わせる。あわせて簡易ユニットテスト/型チェックで再発防止を確認。
- より広範な整理（~1-2h): `getProfile` の返り値を `Event | null` に変更し、AuditLog など配列前提箇所を `getProfiles` へ移行 or `getProfile` を分岐させる。影響範囲が広くなるため追加テストと動作確認が必要。
