# Location Detail Accessibility Contract

**Source**: [spec.md](../spec.md)
**Plan**: [plan.md](../plan.md)
**Data model**: [data-model.md](../data-model.md)

この契約は、実装方式ではなく、`/location-detail/[id]`で観測できるDOM、metadata、遷移、状態、サイズ、色を固定する。テストは可能な限り実際のページcomponentを共通`main`ホスト内でrenderし、裸のcomponent wrapperが本番layoutの欠陥を隠さないようにする。

## 1. Host and route contract

| Item | Contract |
|---|---|
| route | `/location-detail/[id]` |
| host landmark | `SidebarLayout`内の`main#main-content`を1つだけ使用。routeは`main`を追加しない |
| page shell | 上部戻りリンク → `PageHeader` → detail/state content |
| return link | accessible name `場所一覧に戻る`、native `a`、`href=/locations`、各stateに1つだけ |
| direct access | URL IDから既存loader/resolverで解決。list selection stateに依存しない |
| Ko-fi | `KoFiSupport`のcard/iframeはchildren後に残し、本文のprovided-information card除去と混同しない |

## 2. Heading contract

Success:

- exactly one `h1` with accessible name equal to `location.name`;
- exactly one `h2` named `提供情報` when provided-information exists;
- no `h2`/`h3` whose name equals `location.name`;
- no heading named `説明`;
- heading order is `h1` then `h2` without a duplicate location heading.

Non-success states:

- exactly one state-purpose `h1`;
- the same top-only return-link position as success;
- no empty success detail rendered.

## 3. Definition-list contract

Region:

```html
<dl>
  <dt>地域</dt>
  <dd>...</dd>
</dl>
```

Provided information:

```html
<h2>提供情報</h2>
<dl>
  <dt>座標データ提供</dt>
  <dd>...</dd>
  <dt>画像提供</dt>
  <dd>...</dd>
  <dt>説明文提供</dt>
  <dd>...</dd>
  <dt>ライセンス</dt>
  <dd><a>...</a></dd>
</dl>
```

Rules:

- every emitted `dt` is immediately followed by its `dd`;
- optional fields omit both pair members when absent;
- normal provided-information ancestors have no `card`, `card-body`, `bg-base-100`, or equivalent card presentation;
- Ko-fi's existing `section.card` is outside this contract and remains unchanged.

## 4. Image and link contract

Image:

- native `img` with `alt=""`;
- no explicit `role="img"`;
- inside a `figure` with an explicit responsive ratio, planned as `aspect-[4/3]`;
- no fixed `h-64` cropping contract.

Destination:

- accessible name `ここへ行く`;
- `tagName === "A"`, not button;
- `href` exactly equals the existing encoded `convertToLocation(location)` destination query;
- appears before the `提供情報` heading;
- no `useRouter`/`onClick` navigation dependency.

External/license links:

- native anchors with non-empty href;
- website link name `ウェブサイトを見る`;
- license link name includes the license value;
- existing `target="_blank"` and `rel="noopener noreferrer"` remain where currently used;
- focus-visible styling remains available from `globals.css`.

## 5. Typography and color contract

Static:

- normal UI in `src/app`, `src/components`, and included CSS is 16px equivalent or larger;
- `text-sm`, `text-xs`, arbitrary values below 16px, unknown font-size values, and fail-open parser branches are violations;
- only exact `src/app/globals.css` `rt { font-size: 70%; }` is permitted as ruby assistance;
- normal text uses `text-base-content` or an equivalent theme-safe token;
- low-opacity/low-contrast utilities such as `text-black/60` are absent from normal detail text and controls;
- non-canonical arbitrary color notation such as `text-(color:--color)` and `text-[red]` is outside this static color contract; `text-[length:...]` belongs to the separate typography contract;
- DaisyUI button default text size is not relied upon; ordinary controls have explicit 16px-equivalent sizing. The button contract recognizes canonical named utilities such as `text-base` and larger; non-canonical arbitrary font-size notation such as `text-[...]`, `text-(...)`, or `text-[theme(...)]` is outside this button contract and is not reported here. The current production source inventory has no composition-helper callsites; loop-binding shadowing of helper names is therefore an intentionally out-of-scope, non-typical boundary for this slice.

Runtime:

- representative normal text and controls compute to at least 16px in desktop and narrow mobile viewports;
- light and dark themes meet WCAG 2.2 AA contrast: normal text `>=4.5:1`, large text `>=3:1`, and applicable non-text controls/indicators `>=3:1`. Large text means at least 18pt regular or 14pt bold (approximately 24px or 18.66px bold at 96 CSS px/in);
- keyboard focus is visible;
- main links/CTA have rendered bounding rectangles at least 44 CSS px wide and 44 CSS px high.

## 6. State contract

| Input | Required observable result |
|---|---|
| clean valid location | success document, location `h1`, details, destination link |
| optional image/description/area absent | primary data and required source/license remain; absent pairs/links/image omitted |
| unknown ID after successful load | Japanese not-found `h1`/alert, no detail, one top return link |
| invalid or duplicate ID | Japanese invalid/duplicate error, no silent first-match success, one top return link |
| loader/CDN/HTTP/JSON failure | Japanese data-load-error, not-found wording absent, one top return link |
| loading | Japanese loading heading/message, no empty success document, same return-link position |

## 7. Metadata contract

- successful named location: `${location.name} - 場所詳細`;
- exact fixture: `千代田区役所` → `千代田区役所 - 場所詳細`;
- invalid/unknown/duplicate/load error: `場所詳細 | 風ぐるま乗換案内`, without untrusted raw ID;
- metadata and page use the same validated identity/data boundary and do not create a second payload format.

## 8. Test matrix and exact public assertions

| Test path | Contract focus |
|---|---|
| `src/app/location-detail/[id]/__tests__/page.test.tsx` | metadata, heading uniqueness, state shells, top return link, native destination href/order, direct page rendering |
| `src/components/features/__tests__/LocationDetailContent.test.tsx` | temporary component boundary: `dl`, empty alt/no role, optional omission, provided-info structure, CTA, card absence; migrate/delete after integration |
| `src/app/__tests__/font-size-compliance.test.ts` | global named/arbitrary utility and CSS `font-size` 16px contract, exact ruby exception |
| `src/app/__tests__/color-compliance.test.ts` | low-contrast color/opacity static contract and detail text token |
| `src/app/__tests__/button-font-size-compliance.test.ts` | ordinary button/control explicit 16px contract using canonical named utilities; non-canonical arbitrary font-size notation is out of scope |
| `src/app/__tests__/accessibility-source-contract.test.ts` | no nested `main`, no modal-only role in detail route, native navigation markers; update only if settled public contract requires it |
| `src/components/layouts/__tests__/SidebarLayout.test.tsx` | exactly one main and unchanged Ko-fi placement/card contract |

A test writer may edit only the named test paths for its slice. A reviewer reads without writing. Any test edit after review invalidates that review and requires a fresh RED and review.
