# Implementation Plan: ブックマーク可能な経路検索結果

**Branch**: `dev` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

## Summary

入力ページは検索条件を正規化した `/routes` URLを生成して遷移するだけにし、結果ページがURLを検証してGET APIで検索・変換・表示する。既存POST APIは互換用に残し、GETとPOSTは同じTransitService処理を再利用する。URLの直列化・解析を副作用のない単一モジュールに集約し、KISS/DRYを守る。

## Technical Context

**Language/Version**: TypeScript 5 strict、React 19、Next.js 15 App Router  
**Primary Dependencies**: Tailwind CSS 4、DaisyUI 5、既存TransitService、Jest、React Testing Library  
**Storage**: 新規永続化なし  
**Testing**: Jest、React Testing Library、TypeScript noEmit、Next.js lint、production build  
**Target Platform**: レスポンシブWeb  
**Project Type**: Next.js App Router Web application  
**Performance Goals**: 追加のAPI往復なし。既存のAPI応答p95 200ms目標を維持  
**Constraints**: 既存POST互換、rate limit、PDF/カレンダー/議論表示、14px下限、44px touch targetを維持  
**Scale/Scope**: 入力ページ、結果ページ、transit GET、URL境界。GTFS・DB・認証は対象外

## Constitution Check

- **Clear Naming**: PASS。`RouteSearchQuery`、`buildRouteResultsUrl()`、`parseRouteSearchParams()`で意図を表す。
- **Simple Logic / KISS**: PASS。新規の包括的ルーターや汎用codecは作らず、経路条件だけを扱う純粋関数に限定する。
- **DRY**: PASS。結果ページURLとAPI URLは同一serializerを利用し、GET/POSTは同一サービス関数へ委譲する。
- **Structured Organization**: PASS。入力、URL境界、取得・表示を分離し、UIはDBへアクセスしない。
- **Type Safety**: PASS。`any`を追加せず、範囲検証済みの型だけを検索へ渡す。
- **Test-First Development**: PASS。URL契約、GET契約、ページ遷移・直接表示のテストを実装前に失敗させる。
- **Accessibility & UX**: PASS。結果のloading/errorをlive regionで通知し、入力へ戻るリンクを提供する。
- **Documentation**: PASS。URLパラメータ契約と互換範囲を文書化する。

## Project Structure

```text
src/
├── app/page.tsx
├── app/routes/page.tsx
├── app/routes/__tests__/page.test.tsx
├── app/api/transit/route.ts
├── app/api/__tests__/transit-get.test.ts
├── components/features/RouteSearchResults.tsx
├── lib/transit/route-search-query.ts
├── lib/transit/route-result-model.ts
└── lib/transit/__tests__/route-search-query.test.ts
```

**Structure Decision**: URL codecとAPI応答変換は`src/lib/transit`、結果取得と表示はfeature component、公開pageは構成だけにする。既存入力コンポーネントと表示コンポーネントは再利用する。

## Phase 0: Research

[research.md](./research.md)にURL形式、GET/POST互換、クライアント結果ページの選択を記録する。

## Phase 1: Design & Contracts

[data-model.md](./data-model.md)、[route-search-url.md](./contracts/route-search-url.md)、[quickstart.md](./quickstart.md)で検証境界とE2E確認を固定する。

## Post-Design Constitution Re-Check

全gateはPASS。URL codecと結果変換はそれぞれ単一目的で、入力ページと結果ページの重複状態を作らない。既存DaisyUI Buttonを再利用し、結果ページの新規操作は通常リンクだけである。

## Complexity Tracking

No constitution violations requiring justification.
