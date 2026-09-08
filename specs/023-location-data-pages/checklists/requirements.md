# Specification Quality Checklist: 場所データページのJavaScript削減

**Purpose**: Issue #79のうち、場所データ・カテゴリナビゲーション・場所詳細ページのJavaScript削減要求と、`dev`準拠の場所ページ表示・狭い画面での横あふれ防止を確認する。カテゴリナビゲーションはカテゴリページだけに表示し、場所詳細ページには表示しない
**Created**: 2026-09-07
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) beyond the explicitly requested page/data boundary
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic where the user-visible outcome permits
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded; route-form work is explicitly deferred
- [x] Dependencies and assumptions identified
- [x] The `dev` visual baseline, responsive viewport range, and no-horizontal-scroll behavior are explicit and testable

## Visual and Responsive Coverage

- [x] The specification distinguishes `dev` visual parity from the URL, GPS-only, no-address-search, and ordinary-link behavior that must remain authoritative
- [x] Category navigation keeps labels on one line without omission for the current data, wraps navigation items into multiple rows within the content area at the listed widths, and explicitly prohibits horizontal scrolling
- [x] Location cards, images, long labels, controls, focus visibility, and vertical reading order have explicit responsive acceptance criteria
- [x] The constitution's 16px minimum, WCAG 2.2 AA contrast boundary, and focus-visibility boundary are explicit, including precedence over the visual reference
- [x] Page-header text, unique-H1 structure, operation/data-provider cards, button/link semantics, and the exclusion of the `dev` carousel are explicit
- [x] Category-navigation scope is explicit: category pages expose it, detail pages do not, while detail-page return and primary-operation links remain
- [x] Distance-mode presentation is explicit: locations are grouped into ascending rounded-kilometer sections with `Nキロ離れています` headings, while town-mode area sections remain distinct
- [x] Area-name provenance and display normalization are explicit: `key_locations.json` has no area field, so GeoJSON-derived labels use the `dev`-aligned short display name without a leading `東京都千代田区`, while source data and full addresses remain unchanged

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary location-data flows
- [x] Feature meets measurable outcomes defined in Success Criteria now that Q1–Q21 are resolved
- [x] No unrequested implementation details leak into the specification

## Notes

- Q1 was resolved on 2026-09-06: use `/locations/location-detail/[id]` as the only canonical detail URL and do not add a compatibility redirect from `/location-detail/[id]`.
- Q2 was revised on 2026-09-07: acquire and validate all location data during the build, fail the build on acquisition/validation failure, and use only generated artifacts after build; runtime `origin` sorting may execute over those artifacts but must not refetch external data.
- Q3 was resolved on 2026-09-06: use the existing `category:en` value URL-encoded as `[category-id]`; do not add a separate slug mapping.
- Q4 was resolved on 2026-09-06 and constrained by Q21 on 2026-09-07: JavaScript reduction and build-time data fixation are goals; necessary interaction JavaScript and runtime `origin` calculation are not removed, but runtime external data fetching is prohibited.
- Q5 was revised on 2026-09-06: keep nearby-location display as a GPS-only operation with two display controls; remove name/address search, Google Maps/geocoding dependency, and its dedicated address-search rate-limit flow.
- Q6 was resolved on 2026-09-06: make category tabs a shared-layout URL navigation and use `/discussions` management navigation as the reference implementation.
- Q7 was resolved on 2026-09-06: resolve `/locations` to the first category's canonical URL and mark the first navigation item active; the current first category is `city_office_and_branch_offices` / `区役所・出張所`.
- Q8 was resolved on 2026-09-06: add `origin=<latitude>,<longitude>` to the current category URL and use the existing latitude/longitude order; place the GPS operation below the category navigation.
- Q9 was resolved on 2026-09-06: keep `origin` in the current category URL, preserve it across category navigation, and remove it for detail/other links and the default「町字で並べる」operation; do not persist it.
- Q10 was resolved on 2026-09-06: provide「町字で並べる」and「近い順に並べる」below the category navigation, with the former clearing `origin` and the latter obtaining GPS and setting it.
- Q11 was resolved on 2026-09-06: missing `origin` uses「町字で並べる」; numeric coordinates outside Chiyoda are accepted; unparseable values show a Japanese error while keeping the normal town-grouped list, and invalid `origin` is not propagated to category links.
- Q12 was resolved on 2026-09-06: retain an unparseable `origin` in the current URL while showing the error and town-grouped list; remove it only when「町字で並べる」is explicitly selected.
- Q13 was resolved on 2026-09-06: preserve an existing valid `origin` and distance-sorted list when GPS re-acquisition fails, and show only the re-acquisition error.
- Q14 was resolved on 2026-09-06 and refined by Q21 on 2026-09-07: return the standard 404 for nonexistent or malformed category/detail URLs; fail the public build for source acquisition, duplicate-ID, and malformed-data failures; keep unexpected post-build artifact failures as separate Japanese data-error states.
- Q15 was resolved on 2026-09-07: use the existing `dev` location-page presentation as the visual baseline, including the page header, operation/category cards, location cards, regional list, and data-provider card; keep the URL, GPS-only, no-address-search, and ordinary-link decisions from Q1–Q14, do not restore client-only tab state, and exclude the `dev` carousel.
- Q16 was resolved on 2026-09-07: keep current category labels on one line without omission, wrap the navigation items into multiple rows within the content area, and prohibit horizontal scrolling and forced single-line/minimum-width presentation.
- Q17 was resolved on 2026-09-07: verify the location-page layout at 320px, 375px, 390px, 768px, 1024px, and 1440px with no unintended horizontal overflow; use vertical expansion where necessary and keep long labels/cards usable without clipping.
- Q18 was resolved on 2026-09-07: do not display the shared category navigation on `/locations/location-detail/[id]`; retain the detail page's information, category return link, destination-setting operation, and external links.
- Q19 was resolved on 2026-09-07: in valid-`origin` distance mode, group locations into ascending rounded-kilometer sections with `Nキロ離れています` headings and the `dev` card grid; do not flatten distance mode into one card list, and keep town-mode area sections separate.
- Q20 was resolved on 2026-09-07: `key_locations.json` has no area field; derive area labels from GeoJSON and align them with `dev` by removing only the leading `東京都千代田区` at display time (for example, `東京都千代田区神田和泉町` → `神田和泉町`) across category regional headings, cards that show a region, and detail-page region output; preserve source data and full addresses.
- Q21 was resolved on 2026-09-07: acquire and validate home facilities, `key_locations.json`, and town GeoJSON during the build; fail the public build if any required acquisition or validation fails; after a successful build, read all location data from generated artifacts only, with no runtime CDN/data-source refetch. Runtime `origin` distance calculation and display switching may use the artifacts.
- The home route-search form remains a separate feature and must not be added to this specification.
